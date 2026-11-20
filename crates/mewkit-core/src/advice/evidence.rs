//! The workflow evidence index: reading it, revising it, writing it back.
//!
//! `RETURN_TO_EXECUTOR` sends work back to its owner, the owner changes source,
//! and the verification output and review verdict recorded earlier now describe
//! code that no longer exists. Binding evidence to a revision is what makes
//! "this proof is out of date" expressible.
//!
//! Two revisions, because two things go stale at different moments:
//! `evidenceRevision` is bumped by ANY source correction, `scopeRevision` only
//! when the plan or scope itself changed, so a reader can tell an ordinary fix
//! from a change to what the plan covers.

use std::path::Path;

use serde_json::{Map, Value};

/// What kind of change a returned correction produced.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CorrectionKind {
    Source,
    Scope,
}

/// A rejected read names the file, because the caller passed the path.
pub type JsonRead = Result<Map<String, Value>, String>;

/// Read the index, refusing anything that is not a JSON object.
///
/// Both failure paths are loud: a correction that silently failed to mark
/// evidence superseded would leave stale proof reading as current at the next
/// gate, which is the failure the revision exists to prevent.
pub fn read_json_file(path: &Path) -> JsonRead {
    let shown = path.display();
    if !path.exists() {
        return Err(format!("evidence file not found: {shown}"));
    }
    let raw = std::fs::read_to_string(path).map_err(|e| format!("cannot read {shown}: {e}"))?;
    match serde_json::from_str::<Value>(&raw) {
        Ok(Value::Object(map)) => Ok(map),
        Ok(_) => Err(format!("{shown} is not a JSON object")),
        Err(_) => Err(format!("{shown} is not valid JSON")),
    }
}

/// Temp+rename so a crash mid-write cannot leave a half-written index.
pub fn write_json_atomic(path: &Path, data: &Map<String, Value>) -> std::io::Result<()> {
    let mut scratch = path.as_os_str().to_os_string();
    scratch.push(format!(".tmp-{}", std::process::id()));
    let scratch = std::path::PathBuf::from(scratch);
    let body = format!(
        "{}\n",
        serde_json::to_string_pretty(data).unwrap_or_else(|_| "{}".into())
    );
    std::fs::write(&scratch, body)?;
    std::fs::rename(&scratch, path)
}

/// `Number.isInteger(value)` — true for a float with no fractional part too,
/// which is what a JSON `1.0` reads as on the TypeScript side.
fn integer(value: Option<&Value>) -> Option<i64> {
    match value? {
        Value::Number(n) if n.is_i64() => n.as_i64(),
        Value::Number(n) => n.as_f64().filter(|f| f.fract() == 0.0).map(|f| f as i64),
        _ => None,
    }
}

/// Current source revision. Absent means 1, so every index written before this
/// mechanism existed reads as revision 1 with nothing superseded.
pub fn current_revision(index: &Map<String, Value>) -> i64 {
    integer(index.get("evidenceRevision")).unwrap_or(1)
}

/// Revision at which scope last changed. 0 means it never has.
fn scope_revision(index: &Map<String, Value>) -> i64 {
    integer(index.get("scopeRevision")).unwrap_or(0)
}

/// The object at `key`, or an empty one — `{...undefined}` in the TypeScript.
fn object_at(index: &Map<String, Value>, key: &str) -> Map<String, Value> {
    match index.get(key) {
        Some(Value::Object(map)) => map.clone(),
        _ => Map::new(),
    }
}

/// Advance the revision and mark downstream evidence superseded.
pub fn apply_correction(index: &Map<String, Value>, kind: CorrectionKind) -> Map<String, Value> {
    let next = current_revision(index) + 1;

    let superseded = |mut record: Map<String, Value>| {
        record.insert("status".into(), Value::String("superseded".into()));
        Value::Object(record)
    };
    // `serde_json`'s map preserves insertion order, so overwriting an existing
    // key leaves it where the source file had it — the object-spread semantics
    // the npm CLI relies on.
    let mut out = index.clone();
    out.insert("evidenceRevision".into(), Value::from(next));
    out.insert(
        "scopeRevision".into(),
        Value::from(match kind {
            CorrectionKind::Scope => next,
            CorrectionKind::Source => scope_revision(index),
        }),
    );
    out.insert(
        "verification".into(),
        superseded(object_at(index, "verification")),
    );
    out.insert("review".into(), superseded(object_at(index, "review")));
    out
}

#[cfg(test)]
#[path = "evidence_tests.rs"]
mod tests;
