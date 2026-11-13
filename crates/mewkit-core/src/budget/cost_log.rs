//! Finding and reading the cost log, the live budget state and the session id.
//!
//! The search walks UP from the working directory, so a command run deep inside
//! a project still reports that project's spend. The refusal names the path the
//! search actually looked for, from the same function the search uses — the
//! message used to name a different file entirely, which sent people to a
//! location this code has never read.
use std::path::{Path, PathBuf};

use serde_json::Value;

use crate::state_paths::{StateClass, resolve_session_state_file, resolve_state_dir};

/// The cost log this directory would hold, present or absent.
pub fn cost_log_candidate(dir: &Path) -> PathBuf {
    resolve_state_dir(dir, StateClass::Telemetry).join("cost-log.json")
}

/// The nearest cost log at or above `start`, or `None` at the filesystem root.
pub fn find_cost_log(start: &Path) -> Option<PathBuf> {
    let mut current = start.to_path_buf();
    loop {
        let candidate = cost_log_candidate(&current);
        if candidate.exists() {
            return Some(candidate);
        }
        let parent = current.parent()?;
        if parent == current {
            return None;
        }
        current = parent.to_path_buf();
    }
}

/// `<root>/.meowkit/telemetry/cost-log.json` → `<root>`.
pub fn project_root_from_cost_log(log_path: &Path) -> PathBuf {
    log_path
        .ancestors()
        .nth(3)
        .unwrap_or(log_path)
        .to_path_buf()
}

/// Why a cost log could not be turned into entries. Carried as the engine's own
/// wording, because that is what the npm CLI prints after `Failed to read`.
#[derive(Debug)]
pub struct CostLogError(pub String);

impl std::fmt::Display for CostLogError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

/// The log's entries. A document that is not an array is refused by shape, the
/// way a reader that is about to index it has to be.
pub fn read_cost_log(log_path: &Path) -> Result<Vec<Value>, CostLogError> {
    let bytes = std::fs::read(log_path).map_err(|error| CostLogError(error.to_string()))?;
    let text = String::from_utf8_lossy(&bytes);
    let parsed: Value =
        serde_json::from_str(&text).map_err(|error| CostLogError(error.to_string()))?;
    match parsed {
        Value::Array(entries) => Ok(entries),
        _ => Err(CostLogError(
            "cost-log.json must contain an array".to_string(),
        )),
    }
}

/// The session this run belongs to: the hook's variable, else the durable
/// marker, else nothing to filter by.
pub fn resolve_current_session_id(
    project_root: &Path,
    hook_session_id: Option<&str>,
) -> Option<String> {
    if let Some(id) = hook_session_id.map(str::trim).filter(|id| !id.is_empty()) {
        return Some(id.to_string());
    }
    let marker = resolve_session_state_file(project_root, "last-session-id");
    if !marker.exists() {
        return None;
    }
    let bytes = std::fs::read(&marker).ok()?;
    let id = String::from_utf8_lossy(&bytes).trim().to_string();
    (!id.is_empty()).then_some(id)
}

/// Where the live accumulator for this session lives, present or absent.
pub fn live_budget_state_file(project_root: &Path) -> PathBuf {
    resolve_session_state_file(project_root, "budget-state.json")
}

/// The live accumulator, or `None` when it is absent, unreadable, unparseable
/// or not an object — a half-written counter must not become a reported total.
///
/// An ARRAY passes the same guard it passes in JavaScript (`typeof []` is
/// `"object"`): every field then reads as absent and the summary is all zeros,
/// which is a different outcome from falling through to the cost log.
pub fn read_live_budget_state(project_root: &Path) -> Option<Value> {
    let file = live_budget_state_file(project_root);
    if !file.exists() {
        return None;
    }
    let bytes = std::fs::read(&file).ok()?;
    let parsed: Value = serde_json::from_str(&String::from_utf8_lossy(&bytes)).ok()?;
    (parsed.is_object() || parsed.is_array()).then_some(parsed)
}
