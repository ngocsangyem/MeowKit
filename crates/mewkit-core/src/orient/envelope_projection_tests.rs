//! The projection half: revision staleness, plan slugs and the JSON document.
use super::envelope::*;
use crate::schema::task_record::{RepoRef, TaskRecord, TaskStatus};
use crate::task_store::{ResumeState, TaskIssue};

fn record(id: &str, status: TaskStatus) -> TaskRecord {
    TaskRecord {
        schema_version: "1.0".to_string(),
        task_id: id.to_string(),
        plan_path: Some(format!("tasks/plans/{id}-plan/plan.md")),
        status,
        current_step: "phase 3".to_string(),
        repos: Vec::new(),
        blockers: Vec::new(),
        next_action: "port orient".to_string(),
        verification_summaries: Vec::new(),
        evidence_refs: Vec::new(),
        capability_decisions: Vec::new(),
        written_by_cli: String::new(),
        written_by_kit: String::new(),
        updated_at: "2026-11-12T00:00:00Z".to_string(),
        extra: Default::default(),
    }
}

fn resume(records: Vec<TaskRecord>, issues: Vec<TaskIssue>) -> ResumeState {
    ResumeState {
        records,
        issues,
        active_plan_pointer: None,
    }
}

#[test]
fn only_a_definite_revision_mismatch_is_a_stale_warning() {
    let mut task = record("alpha", TaskStatus::Active);
    task.repos = vec![
        RepoRef {
            identity: "/repo/moved".into(),
            revision: Some("aaaaaaa".into()),
        },
        RepoRef {
            identity: "/repo/unknown-now".into(),
            revision: Some("bbbbbbb".into()),
        },
        RepoRef {
            identity: "/repo/never-recorded".into(),
            revision: None,
        },
    ];
    let probes = [
        RepoRevisionProbe {
            identity: "/repo/moved".into(),
            current_revision: Some("ccccccc".into()),
        },
        RepoRevisionProbe {
            identity: "/repo/unknown-now".into(),
            current_revision: None,
        },
        RepoRevisionProbe {
            identity: "/repo/never-recorded".into(),
            current_revision: Some("ddddddd".into()),
        },
    ];
    let built = build_orient_envelope(&resume(vec![task], vec![]), None, &probes);
    assert_eq!(
        built.stale_warnings,
        ["repo /repo/moved moved from aaaaaaa to ccccccc"]
    );
}

#[test]
fn a_plan_slug_is_the_directory_holding_plan_md() {
    assert_eq!(
        plan_slug_from_path(Some("tasks/plans/261112-demo/plan.md")).as_deref(),
        Some("261112-demo")
    );
    // Windows separators resolve the same way.
    assert_eq!(
        plan_slug_from_path(Some(r"tasks\plans\261112-demo\PLAN.MD")).as_deref(),
        Some("261112-demo")
    );
    // A bare file keeps its stem; a directory keeps its name.
    assert_eq!(
        plan_slug_from_path(Some("plan.md")).as_deref(),
        Some("plan")
    );
    assert_eq!(
        plan_slug_from_path(Some("tasks/plans/261112-demo")).as_deref(),
        Some("261112-demo")
    );
    assert_eq!(plan_slug_from_path(None), None);
    assert_eq!(plan_slug_from_path(Some("")), None);
}

#[test]
fn the_json_document_keeps_the_field_order_the_npm_cli_prints() {
    let built = build_orient_envelope(&resume(vec![], vec![]), None, &[]);
    assert_eq!(
        serde_json::to_string(&built.to_json()).unwrap(),
        r#"{"schemaVersion":"1.0","activeTask":null,"candidates":[],"staleWarnings":[],"issues":[],"pointerKind":"none","outcome":"none"}"#
    );
}
