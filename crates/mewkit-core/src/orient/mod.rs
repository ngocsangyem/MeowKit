//! `orient` — provider-neutral orientation from durable task state ONLY.
//!
//! It reconstructs the active records plus the canonical pointer, probes each
//! recorded repo's CURRENT revision (read from git refs directly, never a `git`
//! binary), builds the pure envelope and renders it. Human output goes through
//! the bounded, control-stripped renderer; `--json` emits the full structured
//! envelope for tooling. Read-only with respect to task state: it never writes a
//! record, a pointer or a plan, and it never scans plans.
mod derived_fields;
mod envelope;
mod envelope_json;
mod render;

use std::collections::BTreeSet;
use std::path::Path;

use serde_json::{Map, json};

pub use envelope::{
    ORIENT_ENVELOPE_SCHEMA_VERSION, OrientActiveTask, OrientEnvelope, OrientOutcome,
    RepoRevisionProbe, build_orient_envelope, plan_slug_from_path,
};
pub use render::{
    MAX_FIELD_CHARS, MAX_TOTAL_CHARS, MAX_TOTAL_TOKENS, UNTRUSTED_HEADER, render_orient_context,
    sanitize_field,
};

use crate::repo_context::resolve_owning_repo;
use crate::schema::task_record::TaskStatus;
use crate::task_store::{PointerError, read_active_task_pointer, reconstruct_resume_state};
use crate::time_utc::now_millis;
use crate::trace::{TraceRecord, append_trace_record};

/// The hint printed under an ambiguous outcome. Dimmed by the npm CLI; this one
/// never emits colour, which is the whole difference.
const AMBIGUOUS_HINT: &str =
    "Multiple active tasks — resolve by setting the active-task pointer (activate one task).";

#[derive(Debug, Default, Clone, Copy)]
pub struct OrientOptions {
    pub json: bool,
    /// Record the advisory `orient_run` measurement. The CLI turns it on unless
    /// `--no-record` is passed, as the command's help has always said; the npm
    /// CLI recorded only on an explicit `--record`.
    pub record: bool,
}

/// Run orientation and return what to print on stdout.
///
/// The only failure is an unreadable pointer file: a corrupt RECORD is reported
/// inside the envelope, because the honest answer is "this one is unreadable,
/// here is the rest", while a pointer that cannot be read makes every answer a
/// guess about which task is current.
pub fn orient(project_root: &Path, opts: &OrientOptions) -> Result<String, PointerError> {
    let started = now_millis();
    let resume = reconstruct_resume_state(project_root)?;
    let pointer = read_active_task_pointer(project_root)?;

    // Probe the current revision of every repo a live (non-done) record names.
    let mut identities = BTreeSet::new();
    for record in &resume.records {
        if record.status == TaskStatus::Done {
            continue;
        }
        for repo in &record.repos {
            identities.insert(repo.identity.clone());
        }
    }
    let probes: Vec<RepoRevisionProbe> = identities
        .into_iter()
        .map(|identity| RepoRevisionProbe {
            current_revision: probe_revision(&identity),
            identity,
        })
        .collect();

    let envelope = build_orient_envelope(&resume, pointer.as_ref(), &probes);

    if opts.record {
        record_run(project_root, &envelope, now_millis() - started);
    }

    if opts.json {
        return Ok(serde_json::to_string_pretty(&envelope.to_json()).unwrap_or_default());
    }
    let mut out = render_orient_context(&envelope, Some(project_root));
    if envelope.outcome == OrientOutcome::Ambiguous {
        out.push('\n');
        out.push_str(AMBIGUOUS_HINT);
    }
    Ok(out)
}

/// Current revision of a recorded repo identity, or `None` — a non-git root, a
/// missing directory, or any read error. A stale or unreadable repo degrades to
/// "unknown"; it never fails orientation.
fn probe_revision(identity: &str) -> Option<String> {
    let path = Path::new(identity);
    if !path.exists() {
        return None;
    }
    resolve_owning_repo(path, None).revision
}

/// One advisory `orient_run` event per run, write-tolerant: a failed append
/// never fails orientation, and nothing here writes task state.
fn record_run(project_root: &Path, envelope: &OrientEnvelope, duration_ms: i64) {
    let mut data = Map::new();
    data.insert("outcome".into(), envelope.outcome.as_str().into());
    data.insert("staleWarnings".into(), json!(envelope.stale_warnings.len()));
    data.insert("durationMs".into(), json!(duration_ms.max(0)));
    let _ = append_trace_record(
        project_root,
        &TraceRecord {
            event: "orient_run".to_string(),
            data,
            // A task id only for an unambiguous active outcome, never for
            // none/ambiguous/corrupt-only.
            task_id: envelope.active_task.as_ref().map(|t| t.task_id.clone()),
            ..TraceRecord::default()
        },
    );
}

#[cfg(test)]
#[path = "envelope_tests.rs"]
mod envelope_tests;

#[cfg(test)]
#[path = "envelope_projection_tests.rs"]
mod envelope_projection_tests;

#[cfg(test)]
#[path = "render_tests.rs"]
mod render_tests;

#[cfg(test)]
#[path = "orient_tests.rs"]
mod orient_tests;
