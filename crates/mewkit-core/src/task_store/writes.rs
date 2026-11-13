//! Writing a task record: atomic replace under a per-id lock.
//!
//! Port of the WRITE half of `core/task-record.ts`. Two properties the callers
//! depend on:
//!
//! * A reader never sees a half-written record — the bytes are published by
//!   `rename`, so a record is either the old one or the new one.
//! * A record this binary cannot READ is never clobbered. The compatibility
//!   gate runs inside the lock, before the replace, so an unsupported
//!   `schemaVersion` fails the command instead of being silently overwritten by
//!   a shape the writer happens to understand.
use std::path::{Path, PathBuf};

use serde_json::Value;

use crate::schema::task_record::{TaskRecord, check_record_schema_version, check_task_id};
use crate::sidecar_lock::{SidecarLock, SidecarLockError};

use super::records::active_dir;

#[derive(Debug, thiserror::Error)]
pub enum RecordWriteError {
    /// An on-disk record whose `schemaVersion` this binary cannot read. Loud
    /// and non-zero: never overwrite a record we cannot interpret.
    #[error("{0}")]
    Incompatible(String),
    /// The record (on disk or about to be written) does not validate.
    #[error("{0}")]
    Invalid(String),
    #[error("{0}")]
    Lock(#[from] SidecarLockError),
    #[error("{0}")]
    Io(#[from] std::io::Error),
}

/// Resolve a record path and assert it stays inside `tasks/active`.
///
/// The id pattern already bars separators and `..`; the containment check is
/// defense in depth, the way the TypeScript writer keeps both.
fn record_path(project_root: &Path, task_id: &str) -> Result<PathBuf, RecordWriteError> {
    check_task_id(task_id).map_err(RecordWriteError::Invalid)?;
    Ok(active_dir(project_root).join(format!("{task_id}.json")))
}

/// Create `tasks/active` and assert it does not escape the project root through
/// a symlink. Returns the resolved target path.
fn prepare_target(project_root: &Path, task_id: &str) -> Result<PathBuf, RecordWriteError> {
    let dir = active_dir(project_root);
    std::fs::create_dir_all(&dir)?;
    let real_root = project_root.canonicalize()?;
    let real_dir = dir.canonicalize()?;
    if !real_dir.starts_with(&real_root) {
        return Err(RecordWriteError::Invalid(
            "tasks/active escapes the project root".to_string(),
        ));
    }
    record_path(project_root, task_id)
}

/// The per-id lock. One lock per record, so two tasks never serialize against
/// each other, and two writers of the SAME task always do.
fn lock_path(project_root: &Path, task_id: &str) -> PathBuf {
    active_dir(project_root).join(format!(".{task_id}.lock"))
}

/// Read a record for a read-modify-write cycle: the compatibility gate first,
/// then the schema, so an unreadable version is named rather than reported as a
/// shape error.
fn read_for_update(target: &Path) -> Result<Option<TaskRecord>, RecordWriteError> {
    let text = match std::fs::read_to_string(target) {
        Ok(text) => text,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(e.into()),
    };
    let value: Value =
        serde_json::from_str(&text).map_err(|e| RecordWriteError::Invalid(e.to_string()))?;
    check_record_schema_version(&value).map_err(RecordWriteError::Incompatible)?;
    TaskRecord::parse(&value)
        .map(Some)
        .map_err(|errors| RecordWriteError::Invalid(errors.join("; ")))
}

/// `JSON.stringify(value, null, 2) + "\n"`, published by rename.
///
/// The scratch name carries this process id, so two writers that somehow both
/// reach the replace cannot publish each other's half-written file.
pub(super) fn atomic_write_json(target: &Path, payload: &Value) -> std::io::Result<()> {
    let serialized = format!(
        "{}\n",
        serde_json::to_string_pretty(payload).unwrap_or_default()
    );
    let tmp = {
        let mut name = target.as_os_str().to_os_string();
        name.push(format!(".tmp-{}", std::process::id()));
        PathBuf::from(name)
    };
    let result = std::fs::write(&tmp, serialized).and_then(|()| std::fs::rename(&tmp, target));
    if result.is_err() {
        let _ = std::fs::remove_file(&tmp);
    }
    result
}

/// Read → mutate → write one record under ONE lock, so concurrent updates to
/// the same id cannot lose each other's changes. The mutator sees the current
/// record (or `None` when absent) and returns the next one; a mutator that
/// refuses returns its own message.
pub fn update_task_record<F>(
    project_root: &Path,
    task_id: &str,
    mutate: F,
) -> Result<TaskRecord, RecordWriteError>
where
    F: FnOnce(Option<&TaskRecord>) -> Result<TaskRecord, String>,
{
    let target = prepare_target(project_root, task_id)?;
    let _held = SidecarLock::acquire(&lock_path(project_root, task_id))?;
    let existing = read_for_update(&target)?;
    let next = mutate(existing.as_ref()).map_err(RecordWriteError::Invalid)?;
    let validated = next.validate();
    if !validated.ok {
        return Err(RecordWriteError::Invalid(validated.errors.join("; ")));
    }
    let payload =
        serde_json::to_value(&next).map_err(|e| RecordWriteError::Invalid(e.to_string()))?;
    atomic_write_json(&target, &payload)?;
    Ok(next)
}

/// The low-level put: write `record` as it stands, refusing to overwrite an
/// on-disk record this binary cannot read. Prefer [`update_task_record`] for a
/// read-modify-write.
pub fn write_task_record(project_root: &Path, record: &TaskRecord) -> Result<(), RecordWriteError> {
    update_task_record(project_root, &record.task_id, |_| Ok(record.clone())).map(|_| ())
}

/// Remove a record file (rollback / cleanup). `true` when a file was removed.
pub fn remove_task_record(project_root: &Path, task_id: &str) -> Result<bool, RecordWriteError> {
    let target = record_path(project_root, task_id)?;
    match std::fs::remove_file(&target) {
        Ok(()) => Ok(true),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(e) => Err(e.into()),
    }
}
