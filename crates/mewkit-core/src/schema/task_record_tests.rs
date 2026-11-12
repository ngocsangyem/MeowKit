//! Ports of the accept/reject cases in `core/__tests__/task-record.test.ts` and
//! the `normalizeTaskId` cases in `core/__tests__/task-activation.test.ts`.

use serde_json::{Value, json};

use super::*;

fn record() -> Value {
    json!({
        "schemaVersion": "1.0",
        "taskId": "feat-x",
        "planPath": "plans/p1/plan.md",
        "status": "active",
        "currentStep": "",
        "repos": [{ "identity": "meowkit", "revision": "abc123" }],
        "blockers": [],
        "nextAction": "",
        "verificationSummaries": [],
        "evidenceRefs": [],
        "capabilityDecisions": [
            { "capabilityId": "mk:cook", "decision": "selected", "reason": "build" }
        ],
        "writtenByCli": "",
        "writtenByKit": "",
        "updatedAt": "2026-07-12T00:00:00.000Z"
    })
}

#[test]
fn accepts_a_well_formed_record() {
    let parsed = TaskRecord::parse(&record()).expect("valid record");
    assert_eq!(parsed.status, TaskStatus::Active);
    assert_eq!(
        parsed.capability_decisions[0].decision,
        CapabilityDecisionKind::Selected
    );
    assert_eq!(
        parsed.repos[0],
        RepoRef {
            identity: "meowkit".into(),
            revision: Some("abc123".into())
        }
    );
}

#[test]
fn applies_every_default_so_a_minimal_record_parses() {
    let parsed = TaskRecord::parse(&json!({
        "schemaVersion": "1.0",
        "taskId": "minimal",
        "status": "active",
        "updatedAt": "2026-07-12T00:00:00.000Z"
    }))
    .expect("defaults cover the optional fields");
    assert_eq!(parsed.plan_path, None);
    assert_eq!(parsed.current_step, "");
    assert!(parsed.repos.is_empty());
    assert!(parsed.blockers.is_empty());
}

#[test]
fn rejects_a_filename_unsafe_task_id() {
    let mut bad = record();
    bad["taskId"] = json!("../escape");
    let errors = TaskRecord::parse(&bad).expect_err("path-shaped id must be refused");
    assert!(
        errors.iter().any(|e| e.contains("invalid task id")),
        "{errors:?}"
    );
    assert_eq!(
        check_task_id("../escape").unwrap_err(),
        "invalid task id: \"../escape\""
    );
}

#[test]
fn rejects_a_status_outside_the_vocabulary() {
    let mut bad = record();
    bad["status"] = json!("paused");
    assert!(TaskRecord::parse(&bad).is_err());
}

#[test]
fn preserves_a_non_git_repo_with_a_null_revision() {
    let mut rec = record();
    rec["repos"] = json!([{ "identity": "local-dir", "revision": null }]);
    let parsed = TaskRecord::parse(&rec).expect("null revision is legal");
    assert_eq!(parsed.repos[0].revision, None);
    // A null revision round-trips as null — never as an invented value or a
    // dropped key.
    let back = serde_json::to_value(&parsed).expect("serializable");
    assert_eq!(back["repos"][0]["revision"], Value::Null);
}

#[test]
fn preserves_an_unknown_additive_field_through_a_round_trip() {
    let mut future = record();
    future["futureField"] = json!("keep-me");
    let parsed = TaskRecord::parse(&future).expect("a future additive field is not a refusal");
    assert_eq!(parsed.extra["futureField"], json!("keep-me"));
    let back = serde_json::to_value(&parsed).expect("serializable");
    assert_eq!(back["futureField"], json!("keep-me"));
}

#[test]
fn refuses_a_record_whose_schema_version_is_outside_the_supported_range() {
    let err = check_record_schema_version(&json!({ "schemaVersion": "99.0", "taskId": "future" }))
        .expect_err("an unreadable record must be loud");
    assert_eq!(
        err,
        "Incompatible task record: record schemaVersion \"99.0\" not in supported [\"1.0\"]"
    );
}

#[test]
fn accepts_a_supported_schema_version_and_an_absent_one() {
    assert!(check_record_schema_version(&record()).is_ok());
    // No `schemaVersion` key at all is left to the schema to refuse, exactly as
    // the TS gate does — the gate only answers "can this binary read it".
    assert!(check_record_schema_version(&json!({ "taskId": "x" })).is_ok());
}

#[test]
fn normalize_task_id_matches_the_ts_cases() {
    assert_eq!(
        normalize_task_id("260719-1604-Meow Kit!!"),
        "260719-1604-meow-kit"
    );
    assert_eq!(normalize_task_id("---"), "task");
    assert_eq!(normalize_task_id(""), "task");
    assert!(normalize_task_id(&"A".repeat(200)).len() <= 64);
    // A run of unusable characters collapses to ONE hyphen; an authored hyphen
    // beside one is its own character.
    assert_eq!(normalize_task_id("a-_b"), "a--b");
    assert_eq!(normalize_task_id("a  b"), "a-b");
}

#[test]
fn normalize_task_id_always_produces_a_usable_id() {
    for raw in [
        "260719-1604-Meow Kit!!",
        "---",
        "",
        &"A".repeat(200),
        "a-_b",
    ] {
        assert!(is_valid_task_id(&normalize_task_id(raw)), "{raw}");
    }
}
