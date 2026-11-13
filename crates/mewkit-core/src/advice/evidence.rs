//! The workflow evidence index: reading it, revising it, writing it back.
//!
//! `RETURN_TO_EXECUTOR` sends work back to its owner, the owner changes source,
//! and the verification output and review verdict recorded earlier now describe
//! code that no longer exists. Binding evidence to a revision is what makes
//! "this proof is out of date" expressible.
//!
//! Two revisions, because two approvals go stale at different moments:
//! `evidenceRevision` is bumped by ANY source correction, `scopeRevision` only
//! when the plan or scope itself changed. One counter would force a fresh human
//! plan approval after every ordinary fix, which trains people to click through
//! the gate that matters.
//!
//! [`apply_correction`] can INVALIDATE an approval and never grants one: it
//! demotes `approved` back to `required` and has no path in the other direction.

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
///
/// Gate 2 is demoted from `approved` back to `required` because the verdict it
/// rests on is now stale; Gate 1 only for a scope correction, which is the one
/// that moves what Gate 1 approved.
pub fn apply_correction(index: &Map<String, Value>, kind: CorrectionKind) -> Map<String, Value> {
    let next = current_revision(index) + 1;
    let mut approvals = object_at(index, "approvals");
    if approvals.get("gate2").and_then(Value::as_str) == Some("approved") {
        approvals.insert("gate2".into(), Value::String("required".into()));
    }
    if kind == CorrectionKind::Scope
        && approvals.get("gate1").and_then(Value::as_str) == Some("approved")
    {
        approvals.insert("gate1".into(), Value::String("required".into()));
    }

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
    out.insert("approvals".into(), Value::Object(approvals));
    out
}

#[cfg(test)]
#[path = "evidence_tests.rs"]
mod tests;
