//! The one trace-append primitive, ported from `core/trace-append.ts`.
//!
//! Every writer (task-state emission, orient, CLI friction) builds its line and
//! rotates through here, and the shell hook contends on the SAME sidecar lock
//! path with the same protocol — so there is one append implementation and one
//! lock object across the three languages. Records are secret-scrubbed before
//! the write, and a caller treats a failed append as ADVISORY: measurement must
//! never fail the command being measured.
use std::io::Write;
use std::path::{Path, PathBuf};

use serde_json::{Map, Value};

use crate::memory::scrub_secrets;
use crate::sidecar_lock::{SidecarLock, SidecarLockError};
use crate::state_paths::{StateClass, resolve_state_dir};
use crate::time_utc::{iso_seconds, now_millis, rotation_stamp};

pub const TRACE_SCHEMA_VERSION: &str = "1.0";
/// Append logs are telemetry in the `.meowkit/` taxonomy.
pub const TRACE_LOG_NAME: &str = "trace-log.jsonl";
pub const TRACE_LOCK_NAME: &str = ".trace-log.lock";
/// Shared rotation threshold — bash, TypeScript and this crate agree on 50MB.
pub const TRACE_MAX_BYTES: u64 = 50 * 1024 * 1024;

pub fn trace_log_path(project_root: &Path) -> PathBuf {
    resolve_state_dir(project_root, StateClass::Telemetry).join(TRACE_LOG_NAME)
}

pub fn trace_lock_path(project_root: &Path) -> PathBuf {
    resolve_state_dir(project_root, StateClass::Telemetry).join(TRACE_LOCK_NAME)
}

#[derive(Debug, thiserror::Error)]
pub enum TraceError {
    #[error("{0}")]
    Lock(#[from] SidecarLockError),
    #[error("cannot append to the trace log: {0}")]
    Io(#[from] std::io::Error),
}

/// One record to append. The provenance fields fall back to the environment,
/// the way the TypeScript writer reads `MEOWKIT_RUN_ID` and its siblings.
#[derive(Debug, Default)]
pub struct TraceRecord {
    pub event: String,
    pub data: Map<String, Value>,
    /// Canonical task identity — top level so a query can filter without
    /// reaching into `data`.
    pub task_id: Option<String>,
    pub plan_path: Option<String>,
    pub run_id: Option<String>,
    pub model: Option<String>,
    pub density: Option<String>,
    pub harness_version: Option<String>,
    /// Injected clock (milliseconds since the epoch); defaults to now.
    pub now_millis: Option<i64>,
    /// Injected rotation threshold, so the rotation path is testable without
    /// writing 50MB. Defaults to [`TRACE_MAX_BYTES`].
    pub max_bytes: Option<u64>,
}

/// EVERY string field is scrubbed, not only `data`: `run_id`, `model`,
/// `task_id` and `plan_path` are caller- or environment-supplied, so a
/// credential pasted into any of them reached the log verbatim while the same
/// string nested under `data` was correctly redacted. `ts` and the schema
/// version are generated here and need no scrub.
fn build(record: &TraceRecord, millis: i64) -> Value {
    // An env var SET to the empty string wins over the fallback, because the
    // TypeScript writer reaches it through `??`, which only skips null.
    let env =
        |name: &str, fallback: &str| std::env::var(name).unwrap_or_else(|_| fallback.to_string());
    let field = |given: &Option<String>, name: &str, fallback: &str| {
        scrub_secrets(&given.clone().unwrap_or_else(|| env(name, fallback)))
    };
    let mut out = Map::new();
    out.insert("schema_version".into(), TRACE_SCHEMA_VERSION.into());
    out.insert("ts".into(), iso_seconds(millis).into());
    out.insert("event".into(), scrub_secrets(&record.event).into());
    out.insert(
        "run_id".into(),
        field(&record.run_id, "MEOWKIT_RUN_ID", "").into(),
    );
    out.insert(
        "harness_version".into(),
        field(&record.harness_version, "MEOWKIT_HARNESS_VERSION", "3.0.0").into(),
    );
    out.insert(
        "model".into(),
        field(&record.model, "MEOWKIT_MODEL_HINT", "").into(),
    );
    out.insert(
        "density".into(),
        field(&record.density, "MEOWKIT_AUTOBUILD_MODE", "").into(),
    );
    for (key, value) in [
        ("task_id", &record.task_id),
        ("plan_path", &record.plan_path),
    ] {
        if let Some(text) = value.as_deref().filter(|t| !t.is_empty()) {
            out.insert(key.into(), scrub_secrets(text).into());
        }
    }
    out.insert(
        "data".into(),
        scrub_deep(&Value::Object(record.data.clone())),
    );
    Value::Object(out)
}

/// Recursively scrub every string before it is persisted — KEYS included. A
/// caller that builds a map keyed by user-supplied text (an env var name, a
/// header, a path fragment) puts that text in the key position, where a secret
/// used to reach the log verbatim.
fn scrub_deep(value: &Value) -> Value {
    match value {
        Value::String(text) => Value::String(scrub_secrets(text)),
        Value::Array(items) => Value::Array(items.iter().map(scrub_deep).collect()),
        Value::Object(fields) => Value::Object(
            fields
                .iter()
                .map(|(k, v)| (scrub_secrets(k), scrub_deep(v)))
                .collect(),
        ),
        other => other.clone(),
    }
}

/// Append one record under the shared sidecar lock, rotating an oversized log.
pub fn append_trace_record(project_root: &Path, record: &TraceRecord) -> Result<(), TraceError> {
    let millis = record.now_millis.unwrap_or_else(now_millis);
    let line = build(record, millis).to_string();
    let lock_path = trace_lock_path(project_root);
    if let Some(dir) = lock_path.parent() {
        std::fs::create_dir_all(dir)?;
    }
    let _held = SidecarLock::acquire(&lock_path)?;
    let log = trace_log_path(project_root);
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log)?;
    writeln!(file, "{line}")?;
    drop(file);
    // Rotation is best effort: a failed rotate must never lose the line just
    // appended.
    let max = record.max_bytes.unwrap_or(TRACE_MAX_BYTES);
    if std::fs::metadata(&log).is_ok_and(|m| m.len() > max) {
        let _ = rotate(&log, millis);
    }
    Ok(())
}

/// Move an oversized log to `trace-log.<stamp>.jsonl.gz` and start a fresh one.
fn rotate(log: &Path, millis: i64) -> std::io::Result<()> {
    let dir = log.parent().unwrap_or(Path::new("."));
    let rotated = dir.join(format!("trace-log.{}.jsonl", rotation_stamp(millis)));
    std::fs::rename(log, &rotated)?;
    let mut encoder = flate2::write::GzEncoder::new(
        std::fs::File::create(rotated.with_extension("jsonl.gz"))?,
        flate2::Compression::default(),
    );
    encoder.write_all(&std::fs::read(&rotated)?)?;
    encoder.finish()?;
    std::fs::remove_file(&rotated)?;
    std::fs::write(log, b"")
}

#[cfg(test)]
#[path = "trace_tests.rs"]
mod tests;
