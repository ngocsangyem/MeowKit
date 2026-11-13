//! What `task-state show` prints: the JSON document, and the human block.
use serde_json::{Map, Value, json};

use crate::orient::plan_slug_from_path;
use crate::schema::task_record::TaskRecord;
use crate::task_store::{ActiveTaskPointerRead, ResumeState};

/// The resume state as the npm CLI serializes it: `{records, issues,
/// activePlanPointer}`, pretty-printed with two spaces.
///
/// The key order is the TypeScript object's own, and the record order inside is
/// the schema's field order — which is what `JSON.stringify` of a parsed record
/// emits, so a tool diffing the two outputs sees no reordering.
pub fn show_json(state: &ResumeState) -> String {
    let mut out = Map::new();
    out.insert(
        "records".into(),
        Value::Array(
            state
                .records
                .iter()
                .map(|r| serde_json::to_value(r).unwrap_or(Value::Null))
                .collect(),
        ),
    );
    out.insert(
        "issues".into(),
        Value::Array(
            state
                .issues
                .iter()
                .map(|i| json!({ "taskId": i.task_id, "problem": i.problem }))
                .collect(),
        ),
    );
    out.insert(
        "activePlanPointer".into(),
        state
            .active_plan_pointer
            .clone()
            .map_or(Value::Null, Value::String),
    );
    serde_json::to_string_pretty(&Value::Object(out)).unwrap_or_default()
}

/// Resolve the current task by EXACT identity — the canonical pointer by task
/// id, or a legacy pointer by exact plan-path/slug match. NEVER a substring: a
/// pointer naming `auth` must not claim `auth-rework`.
fn is_current(record: &TaskRecord, pointer: Option<&ActiveTaskPointerRead>) -> bool {
    match pointer {
        Some(ActiveTaskPointerRead::Canonical(p)) => record.task_id == p.task_id,
        Some(ActiveTaskPointerRead::Legacy { plan_ref }) => {
            record.plan_path.as_deref() == Some(plan_ref.as_str())
                || plan_slug_from_path(record.plan_path.as_deref()).as_deref()
                    == Some(plan_ref.as_str())
        }
        None => false,
    }
}

/// The human block. Colour is never emitted — the npm CLI's own output is
/// uncoloured whenever stdout is not a terminal, which is every case a hook or
/// a test reads.
pub fn render_show(state: &ResumeState, pointer: Option<&ActiveTaskPointerRead>) -> String {
    let mut out = String::from("Durable task state\n");
    if let Some(plan) = &state.active_plan_pointer {
        out.push_str(&format!("  active plan: {plan}\n"));
    }
    if state.records.is_empty() {
        out.push_str("  No active task records.\n");
    }
    for record in &state.records {
        let marker = if is_current(record, pointer) {
            " ◀ current"
        } else {
            ""
        };
        let plan = record
            .plan_path
            .as_deref()
            .filter(|p| !p.is_empty())
            .map(|p| format!(" {p}"))
            .unwrap_or_default();
        out.push_str(&format!(
            "  {} [{}]{plan}{marker}\n",
            record.task_id,
            status_of(record)
        ));
        out.push_str(&format!(
            "    step: {}  next: {}\n",
            blank_as_none(&record.current_step),
            blank_as_none(&record.next_action)
        ));
        if !record.repos.is_empty() {
            let repos: Vec<String> = record
                .repos
                .iter()
                .map(|r| {
                    format!(
                        "{}@{}",
                        r.identity,
                        r.revision.as_deref().unwrap_or("(no-rev)")
                    )
                })
                .collect();
            out.push_str(&format!("    repos: {}\n", repos.join(", ")));
        }
        if !record.blockers.is_empty() {
            out.push_str(&format!("    blockers: {}\n", record.blockers.join("; ")));
        }
        // Evidence paths are pointers a resuming session can open — the record
        // deliberately stores no content, so listing them is the only way they
        // are discoverable without reading the JSON by hand. They are POINTERS,
        // never a verification result.
        if !record.evidence_refs.is_empty() {
            out.push_str(&format!(
                "    evidence: {}\n",
                record.evidence_refs.join(", ")
            ));
        }
        if !record.capability_decisions.is_empty() {
            let decisions: Vec<String> = record
                .capability_decisions
                .iter()
                .map(|d| format!("{}={}", d.capability_id, decision_of(d.decision)))
                .collect();
            out.push_str(&format!("    decisions: {}\n", decisions.join(", ")));
        }
    }
    for issue in &state.issues {
        out.push_str(&format!("  [ISSUE] {}: {}\n", issue.task_id, issue.problem));
    }
    out
}

/// `(none)` for an unset field, so a reader can tell "nothing recorded" from a
/// field that was never printed.
fn blank_as_none(value: &str) -> &str {
    if value.is_empty() { "(none)" } else { value }
}

fn status_of(record: &TaskRecord) -> &'static str {
    use crate::schema::task_record::TaskStatus;
    match record.status {
        TaskStatus::Active => "active",
        TaskStatus::Blocked => "blocked",
        TaskStatus::Done => "done",
    }
}

fn decision_of(kind: crate::schema::task_record::CapabilityDecisionKind) -> &'static str {
    use crate::schema::task_record::CapabilityDecisionKind as K;
    match kind {
        K::Selected => "selected",
        K::Skipped => "skipped",
        K::Unavailable => "unavailable",
        K::Unsupported => "unsupported",
    }
}
