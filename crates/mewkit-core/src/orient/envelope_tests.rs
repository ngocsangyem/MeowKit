use super::envelope::*;
use crate::schema::active_task_pointer::ActiveTaskPointer;
use crate::schema::task_record::{TaskRecord, TaskStatus};
use crate::task_store::{ActiveTaskPointerRead, ResumeState, TaskIssue};

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

fn canonical(task_id: &str) -> ActiveTaskPointerRead {
    ActiveTaskPointerRead::Canonical(ActiveTaskPointer {
        schema_version: "1.0".to_string(),
        task_id: task_id.to_string(),
        plan_path: None,
        plan_slug: None,
        extra: Default::default(),
    })
}

#[test]
fn no_state_is_none_and_corrupt_only_state_says_so() {
    let empty = build_orient_envelope(&resume(vec![], vec![]), None, &[]);
    assert_eq!(empty.outcome, OrientOutcome::None);
    assert_eq!(empty.pointer_kind, "none");

    let corrupt = build_orient_envelope(
        &resume(
            vec![],
            vec![TaskIssue {
                task_id: "broken".into(),
                problem: "unreadable".into(),
            }],
        ),
        None,
        &[],
    );
    assert_eq!(corrupt.outcome, OrientOutcome::CorruptOnly);
    assert_eq!(corrupt.issues.len(), 1);
}

#[test]
fn a_done_only_store_is_none_not_active() {
    let built = build_orient_envelope(
        &resume(vec![record("alpha", TaskStatus::Done)], vec![]),
        None,
        &[],
    );
    assert_eq!(built.outcome, OrientOutcome::None);
    assert!(built.active_task.is_none());
}

#[test]
fn a_blocked_task_resolves_but_reports_itself_as_blocked() {
    let built = build_orient_envelope(
        &resume(vec![record("alpha", TaskStatus::Blocked)], vec![]),
        None,
        &[],
    );
    assert_eq!(built.outcome, OrientOutcome::Active);
    assert_eq!(built.active_task.as_ref().unwrap().status(), "blocked");
}

#[test]
fn several_resumable_tasks_are_ambiguous_with_every_candidate_sorted() {
    let built = build_orient_envelope(
        &resume(
            vec![
                record("zeta", TaskStatus::Active),
                record("alpha", TaskStatus::Blocked),
            ],
            vec![],
        ),
        None,
        &[],
    );
    assert_eq!(built.outcome, OrientOutcome::Ambiguous);
    assert_eq!(built.candidates, ["alpha", "zeta"]);
    assert!(built.active_task.is_none(), "never silently pick one");
}

#[test]
fn the_pointer_disambiguates_and_a_done_target_does_not() {
    let records = vec![
        record("alpha", TaskStatus::Active),
        record("zeta", TaskStatus::Active),
    ];
    let built = build_orient_envelope(
        &resume(records.clone(), vec![]),
        Some(&canonical("zeta")),
        &[],
    );
    assert_eq!(built.outcome, OrientOutcome::Active);
    assert_eq!(built.candidates, ["zeta"]);
    assert_eq!(built.pointer_kind, "canonical");

    let mut done = records;
    done[1].status = TaskStatus::Done;
    let built = build_orient_envelope(&resume(done, vec![]), Some(&canonical("zeta")), &[]);
    // The pointer named a finished task, so the sole remaining one resolves.
    assert_eq!(built.active_task.unwrap().task_id, "alpha");
}

#[test]
fn a_legacy_reference_matches_a_plan_path_or_its_slug_exactly() {
    let records = vec![
        record("alpha", TaskStatus::Active),
        record("zeta", TaskStatus::Active),
    ];
    for plan_ref in ["tasks/plans/zeta-plan/plan.md", "zeta-plan"] {
        let built = build_orient_envelope(
            &resume(records.clone(), vec![]),
            Some(&ActiveTaskPointerRead::Legacy {
                plan_ref: plan_ref.to_string(),
            }),
            &[],
        );
        assert_eq!(built.active_task.unwrap().task_id, "zeta", "ref {plan_ref}");
    }
    // A substring must NOT match: an exact reference or nothing.
    let built = build_orient_envelope(
        &resume(records, vec![]),
        Some(&ActiveTaskPointerRead::Legacy {
            plan_ref: "zeta".to_string(),
        }),
        &[],
    );
    assert_eq!(built.outcome, OrientOutcome::Ambiguous);
    assert_eq!(built.pointer_kind, "legacy");
}
