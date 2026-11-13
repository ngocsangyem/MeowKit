//! The task-record files under `tasks/active/`, and resume reconstruction.
use std::path::{Path, PathBuf};

use crate::schema::task_record::{TaskRecord, check_record_schema_version, is_valid_task_id};

use super::pointer::{PointerError, read_active_plan_pointer};

/// `<project_root>/tasks/active` — the durable task-record home.
///
/// The SAME path for a flat-copy and a plugin install: task records are the
/// consumer PROJECT's state, keyed to the project the agent works in, not
/// plugin-owned state. `tasks/` is framework-internal state that keeps its path,
/// so it does not move under a plugin data root, where consumer records would be
/// misplaced.
pub fn active_dir(project_root: &Path) -> PathBuf {
    project_root.join("tasks").join("active")
}

/// One record that could not be read, surfaced instead of thrown away.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TaskIssue {
    pub task_id: String,
    pub problem: String,
}

/// Everything a fresh session needs to resume, read from files only.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResumeState {
    pub records: Vec<TaskRecord>,
    pub issues: Vec<TaskIssue>,
    /// The active-plan pointer (the checkpoint join): a record whose `planPath`
    /// matches it is the current one.
    pub active_plan_pointer: Option<String>,
}

/// Every id with a record file in `tasks/active`, sorted. An id that is not
/// filename-safe is skipped rather than read: the regex is the containment gate.
pub fn list_task_record_ids(project_root: &Path) -> std::io::Result<Vec<String>> {
    let dir = active_dir(project_root);
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut ids: Vec<String> = std::fs::read_dir(&dir)?
        .filter_map(Result::ok)
        .map(|entry| entry.file_name().to_string_lossy().into_owned())
        .filter_map(|name| name.strip_suffix(".json").map(str::to_string))
        .filter(|id| is_valid_task_id(id))
        .collect();
    // Task ids are `[a-z0-9-]`, so a byte sort is the code-unit sort the
    // JavaScript reader applies.
    ids.sort();
    Ok(ids)
}

/// Read one record, version-checked. `Ok(None)` means no such file; `Err`
/// carries the problem to surface as an issue.
pub fn read_task_record(project_root: &Path, task_id: &str) -> Result<Option<TaskRecord>, String> {
    if !is_valid_task_id(task_id) {
        return Err(format!("invalid task id: {task_id:?}"));
    }
    let path = active_dir(project_root).join(format!("{task_id}.json"));
    match std::fs::read_to_string(&path) {
        Ok(text) => parse_and_check(&text).map(Some),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// The compatibility gate runs BEFORE the schema, so a record this binary
/// cannot read is refused with its version named rather than reported as a
/// shape error.
fn parse_and_check(text: &str) -> Result<TaskRecord, String> {
    let value: serde_json::Value = serde_json::from_str(text).map_err(|e| e.to_string())?;
    check_record_schema_version(&value)?;
    TaskRecord::parse(&value).map_err(|errors| errors.join("; "))
}

/// Read every active task record. A corrupt or incompatible record becomes an
/// issue rather than a failure, so one bad file never blocks resuming the
/// others; the LISTING itself is guarded too, so a directory removed mid-read
/// cannot crash the reconstruction.
pub fn reconstruct_resume_state(project_root: &Path) -> Result<ResumeState, PointerError> {
    let mut records = Vec::new();
    let mut issues = Vec::new();
    let ids = match list_task_record_ids(project_root) {
        Ok(ids) => ids,
        Err(e) => {
            issues.push(TaskIssue {
                task_id: "(listing)".to_string(),
                problem: e.to_string(),
            });
            Vec::new()
        }
    };
    for id in ids {
        match read_task_record(project_root, &id) {
            Ok(Some(record)) => records.push(record),
            Ok(None) => {}
            Err(problem) => issues.push(TaskIssue {
                task_id: id,
                problem,
            }),
        }
    }
    Ok(ResumeState {
        records,
        issues,
        active_plan_pointer: read_active_plan_pointer(project_root)?,
    })
}
