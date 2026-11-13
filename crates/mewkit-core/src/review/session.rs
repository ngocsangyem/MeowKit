//! Where a review session's artifacts live, and the few file shapes every
//! command in the pipeline reads or writes.
//!
//! The session directory is `tasks/reviews/<id>/` under the INVOCATION
//! directory — not a discovered project root. The npm CLI resolves it from
//! `process.cwd()`, and a review's audit trail must land where the operator ran
//! the command, not in whichever ancestor happens to hold `.claude/`.
use std::path::{Component, Path, PathBuf};

use serde_json::Value;

/// `tasks/reviews/<session>/` under `cwd`.
pub fn session_dir(cwd: &Path, session: &str) -> PathBuf {
    cwd.join("tasks").join("reviews").join(session)
}

/// `path.relative(from, to)` for the paths this pipeline prints: both are
/// absolute and normalised, and the result uses the platform separator, so a
/// message reads the same from either CLI.
pub fn relative(from: &Path, to: &Path) -> String {
    let (from, to) = (normalise(from), normalise(to));
    let mut f = from.components().peekable();
    let mut t = to.components().peekable();
    while f.peek().is_some() && f.peek() == t.peek() {
        f.next();
        t.next();
    }
    let up = f.count();
    let mut parts: Vec<String> = std::iter::repeat_n("..".to_string(), up).collect();
    parts.extend(t.map(|c| c.as_os_str().to_string_lossy().into_owned()));
    if parts.is_empty() {
        return String::new();
    }
    parts.join(std::path::MAIN_SEPARATOR_STR)
}

/// Drop `.` components so `a/./b` and `a/b` compare equal, the way Node's
/// path.relative normalises before it diffs.
fn normalise(path: &Path) -> PathBuf {
    path.components()
        .filter(|c| !matches!(c, Component::CurDir))
        .collect()
}

/// Parse a JSON file, or `None` when it is missing or malformed. Every caller
/// here treats both the same way: an unreadable artifact is an absent one.
pub fn read_json(path: &Path) -> Option<Value> {
    let text = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&text).ok()
}

/// `JSON.stringify(value, null, 2)` plus the trailing newline every record the
/// npm CLI writes ends with.
pub fn write_json_pretty(path: &Path, value: &Value) -> std::io::Result<()> {
    let text = serde_json::to_string_pretty(value).unwrap_or_else(|_| "null".into());
    std::fs::write(path, format!("{text}\n"))
}

/// Every parsable line of a `.jsonl` file. A line that does not parse is
/// SKIPPED rather than fatal: evidence is append-only and a half-written final
/// line must not hide the reads that came before it.
pub fn read_jsonl(path: &Path) -> Vec<Value> {
    let Ok(text) = std::fs::read_to_string(path) else {
        return Vec::new();
    };
    text.split('\n')
        .filter(|line| !line.is_empty())
        .filter_map(|line| serde_json::from_str(line).ok())
        .collect()
}

/// The string at `key`, or `""` — matching `String(value ?? "")` at the call
/// sites that compare a field against a literal.
pub fn str_field<'a>(value: &'a Value, key: &str) -> &'a str {
    value.get(key).and_then(Value::as_str).unwrap_or_default()
}

#[cfg(test)]
#[path = "session_tests.rs"]
mod tests;
