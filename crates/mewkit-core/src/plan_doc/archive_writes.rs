//! What `plan archive` REWRITES before it moves a plan, and the pointer it
//! clears.
//!
//! Split from the archive's own resolution and reporting because these three
//! are the only writes, and each one has a narrow promise it must keep: the
//! status rewrite touches one LINE's value and nothing else (so a plan written
//! on Windows keeps its line endings), the checkpoint rewrite touches
//! `phases[*].status` and preserves every other key, and the pointer clear is
//! exact-match only.
//!
//! Every one of them is advisory about failure: a plan that cannot be rewritten
//! is reported as unchanged, never as an archive that half happened.
use std::path::Path;
use std::sync::LazyLock;

use regex::Regex;
use serde_json::{Map, Value};

use crate::task_store::{
    ActiveTaskPointerRead, clear_active_task_pointer, read_active_task_pointer,
};

const COMPLETED: &str = "completed";

static FIRST_BLOCK: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^---\r?\n([\s\S]*?)\r?\n---").expect("static fence pattern"));
static STATUS_IN_BLOCK: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?m)^status:").expect("static status-key pattern"));
/// The value of the first line-anchored `status:`, leaving any trailing `\r`
/// intact so the file's line endings survive the rewrite.
static STATUS_LINE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?m)^status:[^\r\n]*").expect("static status-line pattern"));

/// Set `status:` to `completed` inside the FIRST frontmatter block only.
///
/// The frontmatter sits at the top of the file, so the first line-anchored
/// `status:` IS the frontmatter's — an identical `status:` in the body is never
/// reached. Returns true when a change was made.
pub(super) fn set_frontmatter_status_completed(md_path: &Path, write: bool) -> bool {
    let Ok(content) = std::fs::read_to_string(md_path) else {
        return false;
    };
    let Some(block) = FIRST_BLOCK
        .captures(&content)
        .and_then(|c| c.get(1).map(|m| m.as_str().to_string()))
    else {
        return false;
    };
    if !STATUS_IN_BLOCK.is_match(&block) {
        return false; // no frontmatter status to set
    }
    let next = STATUS_LINE
        .replacen(&content, 1, format!("status: {COMPLETED}").as_str())
        .into_owned();
    if next == content {
        return false;
    }
    if write && std::fs::write(md_path, next).is_err() {
        return false;
    }
    true
}

/// Mark every `phases[*].status` completed in `.plan-state.json`, preserving
/// every other key. Returns true when a change was made.
pub(super) fn mark_plan_state_completed(plan_state: &Path, write: bool) -> bool {
    let Ok(text) = std::fs::read_to_string(plan_state) else {
        return false;
    };
    // A malformed checkpoint is left alone — the markdown is authoritative.
    let Ok(mut data) = serde_json::from_str::<Map<String, Value>>(&text) else {
        return false;
    };
    let Some(phases) = data.get_mut("phases").and_then(Value::as_object_mut) else {
        return false;
    };
    let mut changed = false;
    for phase in phases.values_mut() {
        if let Some(record) = phase.as_object_mut()
            && record.get("status").and_then(Value::as_str) != Some(COMPLETED)
        {
            record.insert("status".into(), Value::String(COMPLETED.to_string()));
            changed = true;
        }
    }
    if changed && write {
        let serialized = serde_json::to_string_pretty(&data).unwrap_or_default();
        let _ = std::fs::write(plan_state, format!("{serialized}\n"));
    }
    changed
}

/// Clear the active-task pointer only when it canonically points at THIS plan.
///
/// The match is on the pointer's `planSlug`, and the clear is by the pointer's
/// OWN `taskId`: a task whose id was normalised away from its slug must still
/// be the one cleared. Advisory — a failure never blocks the archive.
pub(super) fn clear_pointer_if_here(project_root: &Path, slug: &str, write: bool) -> bool {
    if !write {
        return false;
    }
    let Ok(Some(ActiveTaskPointerRead::Canonical(pointer))) =
        read_active_task_pointer(project_root)
    else {
        return false;
    };
    if pointer.plan_slug.as_deref() != Some(slug) {
        return false;
    }
    clear_active_task_pointer(project_root, &pointer.task_id).unwrap_or(false)
}
