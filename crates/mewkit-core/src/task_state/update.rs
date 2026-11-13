//! `task-state update`: parse the transition metadata, merge it, write once.
//!
//! Everything is parsed and validated BEFORE any write, so bad input never
//! half-updates a record. List metadata MERGES rather than replaces, so
//! evidence, blockers, verifications and decisions accumulate across a task's
//! transitions instead of the last call erasing the earlier ones.
use std::path::Path;

use crate::schema::task_record::{CapabilityDecision, TaskRecord, TaskStatus, VerificationSummary};
use crate::task_store::{
    RecordWriteError, blank_record, clear_active_task_pointer, update_task_record,
};

use super::decisions::{parse_capability_decision, parse_verification};
use super::kit_version::kit_version;
use super::transition_trace::{self, Added};

/// What the verb was asked to record. Repeatable flags arrive as slices.
#[derive(Debug, Default)]
pub struct TaskStateUpdate<'a> {
    pub task_id: Option<&'a str>,
    pub status: Option<&'a str>,
    pub step: Option<&'a str>,
    pub next: Option<&'a str>,
    pub plan: Option<&'a str>,
    pub blockers: &'a [String],
    pub verifications: &'a [String],
    pub evidence_refs: &'a [String],
    pub capability_decisions: &'a [String],
    /// Invoking CLI version, for record provenance (never the compatibility gate).
    pub cli_version: Option<&'a str>,
    /// Injected clock, so the core never reads it itself.
    pub now: &'a str,
}

#[derive(Debug)]
pub struct UpdateOutput {
    pub stdout: String,
    /// An advisory warning for stderr: the durable write already succeeded, so
    /// a failed measurement must not fail the command being measured.
    pub warning: Option<String>,
}

/// Normalize a repeatable flag to clean, non-empty, trimmed values.
fn clean(values: &[String]) -> Vec<String> {
    values
        .iter()
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
        .collect()
}

/// Union additions into a list by identity, preserving order — so a repeated
/// blocker or evidence path is recorded once.
fn union_push<T, K: Eq>(existing: &[T], additions: Vec<T>, key: impl Fn(&T) -> K) -> Vec<T>
where
    T: Clone,
{
    let mut out = existing.to_vec();
    for addition in additions {
        if !out.iter().any(|seen| key(seen) == key(&addition)) {
            out.push(addition);
        }
    }
    out
}

fn parse_status(given: Option<&str>) -> Result<TaskStatus, String> {
    match given.unwrap_or("active") {
        "active" => Ok(TaskStatus::Active),
        "blocked" => Ok(TaskStatus::Blocked),
        "done" => Ok(TaskStatus::Done),
        other => Err(format!(
            "Invalid --status \"{other}\". Expected active|blocked|done.\n"
        )),
    }
}

/// Run the update. `Err` is the text to print on stderr before exiting 1.
pub fn update(project_root: &Path, args: &TaskStateUpdate<'_>) -> Result<UpdateOutput, String> {
    let Some(task_id) = args.task_id.filter(|id| !id.is_empty()) else {
        return Err("`task-state update` requires a task id.\n".to_string());
    };
    let status = parse_status(args.status)?;

    // Parsed BEFORE the write: a malformed decision token must not leave a
    // half-applied transition behind.
    let new_blockers = clean(args.blockers);
    let new_evidence = clean(args.evidence_refs);
    let new_verifications: Vec<VerificationSummary> = clean(args.verifications)
        .iter()
        .map(|raw| parse_verification(raw))
        .collect();
    let new_decisions: Vec<CapabilityDecision> = clean(args.capability_decisions)
        .iter()
        .map(|raw| parse_capability_decision(raw))
        .collect::<Result<_, String>>()
        .map_err(|message| format!("{message}\n"))?;

    let kit = kit_version(project_root);
    let status_given = args.status.is_some();
    let updated = update_task_record(project_root, task_id, |existing| {
        let base = existing.cloned().unwrap_or_else(|| blank_record(task_id));
        Ok(TaskRecord {
            status: if status_given { status } else { base.status },
            current_step: args.step.map_or(base.current_step.clone(), str::to_string),
            next_action: args.next.map_or(base.next_action.clone(), str::to_string),
            plan_path: args.plan.map(str::to_string).or(base.plan_path.clone()),
            blockers: union_push(&base.blockers, new_blockers.clone(), |b| b.clone()),
            evidence_refs: union_push(&base.evidence_refs, new_evidence.clone(), |e| e.clone()),
            verification_summaries: union_push(
                &base.verification_summaries,
                new_verifications.clone(),
                |v| format!("{}={}", v.reference, v.result),
            ),
            capability_decisions: union_push(
                &base.capability_decisions,
                new_decisions.clone(),
                |d| d.capability_id.clone(),
            ),
            written_by_cli: args
                .cli_version
                .map_or(base.written_by_cli.clone(), str::to_string),
            written_by_kit: if kit.is_empty() {
                base.written_by_kit.clone()
            } else {
                kit.clone()
            },
            updated_at: args.now.to_string(),
            ..base
        })
    })
    .map_err(|err| match err {
        // Never overwrite a record this binary cannot safely read.
        RecordWriteError::Incompatible(message) => format!("Refusing to update: {message}\n"),
        other => format!("Fatal: {other}\n"),
    })?;

    let stdout = format!(
        "Updated task record: {}\n",
        Path::new("tasks")
            .join("active")
            .join(format!("{}.json", updated.task_id))
            .display()
    );

    // Emitted ONLY after a successful state write, and advisory: a failed
    // append warns but never fails the command, because the durable state is
    // already committed.
    let warning = transition_trace::emit(
        project_root,
        &updated,
        &Added {
            blockers: &new_blockers,
            verifications: &new_verifications,
            evidence: &new_evidence,
            decisions: &new_decisions,
        },
    );

    // Completing the task clears ONLY its own pointer (exact id match) — never
    // another live task's. Advisory: a missing or other-task pointer is a
    // no-op, not an error.
    if updated.status == TaskStatus::Done {
        let _ = clear_active_task_pointer(project_root, task_id);
    }
    Ok(UpdateOutput { stdout, warning })
}
