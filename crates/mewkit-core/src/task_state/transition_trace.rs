//! The advisory `task_transition` measurement a successful update emits.
//!
//! Kept apart from the update itself because the two have opposite failure
//! rules: the record write is the command, and this is a measurement OF it. A
//! failed append is reported as a warning and nothing more — measurement must
//! never fail the thing being measured, and the durable state is already
//! committed by the time this runs.
use std::path::Path;

use serde_json::{Map, json};

use crate::schema::task_record::{CapabilityDecision, TaskRecord, TaskStatus, VerificationSummary};
use crate::trace::{TraceRecord, append_trace_record};

/// What a transition supplied, as opposed to what the record now holds: only
/// the values THIS call added appear in the trace line.
pub(super) struct Added<'a> {
    pub blockers: &'a [String],
    pub verifications: &'a [VerificationSummary],
    pub evidence: &'a [String],
    pub decisions: &'a [CapabilityDecision],
}

/// Append the line, and return the warning to print when that fails.
///
/// A list that was not supplied is ABSENT from the payload rather than an empty
/// array, so a reader can tell "no blockers were added" from "the blockers were
/// cleared".
pub(super) fn emit(project_root: &Path, record: &TaskRecord, added: &Added<'_>) -> Option<String> {
    let mut data = Map::new();
    data.insert("status".into(), status_name(record.status).into());
    data.insert("step".into(), record.current_step.clone().into());
    data.insert("next".into(), record.next_action.clone().into());
    if !added.blockers.is_empty() {
        data.insert("blockers".into(), json!(added.blockers));
    }
    if !added.verifications.is_empty() {
        data.insert("verifications".into(), json!(added.verifications));
    }
    if !added.evidence.is_empty() {
        data.insert("evidence".into(), json!(added.evidence));
    }
    if !added.decisions.is_empty() {
        data.insert("capabilityDecisions".into(), json!(added.decisions));
    }
    append_trace_record(
        project_root,
        &TraceRecord {
            event: "task_transition".to_string(),
            data,
            task_id: Some(record.task_id.clone()),
            plan_path: record.plan_path.clone(),
            ..TraceRecord::default()
        },
    )
    .err()
    .map(|e| format!("⚠ task-state updated, but trace emission failed: {e}\n"))
}

pub(super) fn status_name(status: TaskStatus) -> &'static str {
    match status {
        TaskStatus::Active => "active",
        TaskStatus::Blocked => "blocked",
        TaskStatus::Done => "done",
    }
}
