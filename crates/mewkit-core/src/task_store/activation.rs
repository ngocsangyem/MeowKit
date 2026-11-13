//! Committing durable authority for a task: the record, then the pointer.
//!
//! Port of `activateTask`. Activation is ONE all-or-fail operation from the
//! caller's view: if the pointer commit fails and this call created the record,
//! the record is rolled back, so a caller is never told a task is active when
//! nothing names it. The pointer writes themselves live in
//! [`super::pointer_write`].
use std::path::Path;

use crate::schema::task_record::{TASK_RECORD_SCHEMA_VERSION, TaskRecord, TaskStatus};

use super::pointer_write::write_active_task_pointer;
use super::writes::{RecordWriteError, remove_task_record, update_task_record};

/// Raised when the POINTER commit fails; carries whether the rollback ran.
#[derive(Debug)]
pub struct ActivationError {
    pub task_id: String,
    pub rolled_back: bool,
    pub message: String,
}

/// Why activation did not happen.
///
/// The two are reported differently on purpose, and conflating them misleads:
/// a [`ActivationFailure::Record`] wrote NOTHING, so telling the operator a
/// partial record may remain sends them looking for a file that does not exist.
/// Only a failed pointer commit leaves a record behind to roll back.
#[derive(Debug, thiserror::Error)]
pub enum ActivationFailure {
    /// The record write itself failed — nothing was activated, and there is
    /// nothing to roll back.
    #[error("{0}")]
    Record(#[from] RecordWriteError),
    /// The record was written and the pointer that names it was not.
    #[error("{}", .0.message)]
    Pointer(ActivationError),
}

/// What a caller asks activation to record.
#[derive(Debug, Default)]
pub struct ActivateTask<'a> {
    pub task_id: &'a str,
    pub plan_path: Option<&'a str>,
    pub plan_slug: Option<&'a str>,
    /// Injected clock — the core never reads it itself.
    pub now: &'a str,
    pub cli_version: Option<&'a str>,
    pub kit_version: Option<&'a str>,
    pub current_step: Option<&'a str>,
    pub next_action: Option<&'a str>,
}

pub struct Activation {
    pub record: TaskRecord,
    /// True when THIS call created the record, as opposed to reactivating an
    /// existing one (activation is idempotent).
    pub created_record: bool,
}

/// A fresh record for a task nothing has recorded yet.
pub fn blank_record(task_id: &str) -> TaskRecord {
    TaskRecord {
        schema_version: TASK_RECORD_SCHEMA_VERSION.to_string(),
        task_id: task_id.to_string(),
        plan_path: None,
        status: TaskStatus::Active,
        current_step: String::new(),
        repos: Vec::new(),
        blockers: Vec::new(),
        next_action: String::new(),
        verification_summaries: Vec::new(),
        evidence_refs: Vec::new(),
        capability_decisions: Vec::new(),
        written_by_cli: String::new(),
        written_by_kit: String::new(),
        updated_at: String::new(),
        extra: Default::default(),
    }
}

/// Commit durable authority for a task: write (or idempotently update) the
/// active record, then the canonical pointer.
///
/// `created_record` is decided INSIDE the lock, from the mutator's view of the
/// current record, so a concurrent same-id creator can never make this call
/// believe it created a record it did not — which would let the rollback delete
/// their record. Trace emission is the caller's separate, advisory step.
pub fn activate_task(
    project_root: &Path,
    input: &ActivateTask<'_>,
) -> Result<Activation, ActivationFailure> {
    let mut created_record = false;
    let record = update_task_record(project_root, input.task_id, |current| {
        created_record = current.is_none();
        let base = current
            .cloned()
            .unwrap_or_else(|| blank_record(input.task_id));
        Ok(TaskRecord {
            status: TaskStatus::Active,
            plan_path: input
                .plan_path
                .map(str::to_string)
                .or(base.plan_path.clone()),
            current_step: input
                .current_step
                .map_or(base.current_step.clone(), str::to_string),
            next_action: input
                .next_action
                .map_or(base.next_action.clone(), str::to_string),
            written_by_cli: input
                .cli_version
                .map_or(base.written_by_cli.clone(), str::to_string),
            written_by_kit: input
                .kit_version
                .map_or(base.written_by_kit.clone(), str::to_string),
            updated_at: input.now.to_string(),
            ..base
        })
    })?;

    if let Err(err) = write_active_task_pointer(
        project_root,
        input.task_id,
        input.plan_path,
        input.plan_slug,
    ) {
        let rolled_back =
            created_record && remove_task_record(project_root, input.task_id).unwrap_or(false);
        return Err(ActivationFailure::Pointer(ActivationError {
            task_id: input.task_id.to_string(),
            rolled_back,
            message: format!(
                "activation pointer commit failed for task \"{}\": {err}",
                input.task_id
            ),
        }));
    }
    Ok(Activation {
        record,
        created_record,
    })
}
