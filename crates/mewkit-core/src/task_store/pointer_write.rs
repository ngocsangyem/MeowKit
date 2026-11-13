//! Writing and clearing the pointer that names the current task.
//!
//! Port of `writeActiveTaskPointer` and `clearActiveTaskPointer`. Separate from
//! the reader beside it because the write carries one extra obligation: the
//! LEGACY MIRROR. The installed checkpoint reader still reads
//! `active-plan.json` → `path`, so a writer that emitted only the canonical
//! shape would leave that reader blind to the current task.
use std::path::{Path, PathBuf};

use serde_json::{Map, Value};

use crate::schema::active_task_pointer::ACTIVE_TASK_POINTER_SCHEMA_VERSION;
use crate::schema::task_record::check_task_id;
use crate::sidecar_lock::SidecarLock;
use crate::state_paths::{StateClass, resolve_session_state_file, resolve_state_dir};

use super::pointer::{ActiveTaskPointerRead, read_active_task_pointer};
use super::writes::{RecordWriteError, atomic_write_json};

/// Session-marker directory: the one write target for every pointer.
fn pointer_dir(project_root: &Path) -> PathBuf {
    resolve_state_dir(project_root, StateClass::State)
}

fn pointer_lock(project_root: &Path) -> PathBuf {
    pointer_dir(project_root).join(".active-plan.lock")
}

/// Write the canonical active-task pointer atomically under its lock.
///
/// Always writes the canonical `{schemaVersion, taskId, planPath, planSlug}`
/// shape and MIRRORS `path`/`slug`, because the installed checkpoint reader
/// reads `active-plan.json` → `path`; dropping the mirror would blind it to the
/// current task. The plain-text legacy pointer is never written.
pub fn write_active_task_pointer(
    project_root: &Path,
    task_id: &str,
    plan_path: Option<&str>,
    plan_slug: Option<&str>,
) -> Result<(), RecordWriteError> {
    check_task_id(task_id).map_err(RecordWriteError::Invalid)?;
    let dir = pointer_dir(project_root);
    std::fs::create_dir_all(&dir)?;
    let mut payload = Map::new();
    payload.insert(
        "schemaVersion".into(),
        ACTIVE_TASK_POINTER_SCHEMA_VERSION.into(),
    );
    payload.insert("taskId".into(), task_id.into());
    payload.insert("planPath".into(), plan_path.map_or(Value::Null, Into::into));
    payload.insert("planSlug".into(), plan_slug.map_or(Value::Null, Into::into));
    // The mirror is omitted when there is no plan association, so a no-plan
    // activation does not leave the checkpoint reader a pointer to nothing.
    if let Some(path) = plan_path.filter(|p| !p.is_empty()) {
        payload.insert("path".into(), path.into());
    }
    if let Some(slug) = plan_slug.filter(|s| !s.is_empty()) {
        payload.insert("slug".into(), slug.into());
    }
    let _held = SidecarLock::acquire(&pointer_lock(project_root))?;
    atomic_write_json(&dir.join("active-plan.json"), &Value::Object(payload))?;
    Ok(())
}

/// Clear the pointer ONLY when it names `task_id` (exact match). A pointer
/// naming a different task is left untouched: completing one task never
/// silently clears another's pointer. `true` when one was removed.
pub fn clear_active_task_pointer(
    project_root: &Path,
    task_id: &str,
) -> Result<bool, RecordWriteError> {
    // Cleared wherever the pointer actually IS: a pre-move pointer left in
    // place would keep naming a task that is finished.
    let json_path = resolve_session_state_file(project_root, "active-plan.json");
    if !json_path.exists() {
        return Ok(false);
    }
    let _held = SidecarLock::acquire(&pointer_lock(project_root))?;
    let current = read_active_task_pointer(project_root)
        .map_err(|e| RecordWriteError::Invalid(e.to_string()))?;
    if let Some(ActiveTaskPointerRead::Canonical(pointer)) = current
        && pointer.task_id == task_id
    {
        std::fs::remove_file(&json_path)?;
        return Ok(true);
    }
    Ok(false)
}
