//! Ports of the `continuity dossier` suite in
//! `core/__tests__/athena-supervision-contract.test.ts`. The write/atomicity
//! cases belong to the `advice` verb; the shape, the authority refusal, the byte
//! cap and the path rule belong here.

use serde_json::{Value, json};

use super::super::dossier_doc::dossier_path;
use super::*;

fn dossier() -> Value {
    json!({
        "runId": "run-1",
        "skill": "mk:cook",
        "stage": "GUIDE",
        "lockedDecisionPointers": ["plan.md#locked-decisions"],
        "latestDirective": "start with the validator",
        "correctionCount": 0,
        "receiptPointers": [],
        "nextSafeAction": "implement packet schema",
        "checkpoint": null,
        "history": [],
        "escalatedToHuman": false
    })
}

fn with(key: &str, value: Value) -> Value {
    let mut out = dossier();
    out[key] = value;
    out
}

#[test]
fn accepts_a_compact_dossier() {
    let checked = validate_dossier(&dossier());
    assert!(checked.ok, "{:?}", checked.errors);
    assert!(checked.errors.is_empty());
}

#[test]
fn refuses_every_progress_verification_and_gate_field() {
    for field in FORBIDDEN_DOSSIER_FIELDS {
        let checked = validate_dossier(&with(field, json!("anything")));
        assert!(!checked.ok, "{field}");
        assert!(
            checked
                .errors
                .join(" ")
                .contains("belongs to the task record"),
            "{field}: {:?}",
            checked.errors
        );
    }
}

#[test]
fn names_the_authority_field_it_refused() {
    let checked = validate_dossier(&with("verdict", json!("PASS")));
    assert!(
        checked.errors.iter().any(|e| e.starts_with("\"verdict\"")),
        "{:?}",
        checked.errors
    );
}

#[test]
fn rejects_an_oversize_active_summary() {
    let checked = validate_dossier(&with(
        "latestDirective",
        json!("x".repeat(ACTIVE_SUMMARY_MAX_BYTES)),
    ));
    assert!(!checked.ok);
    assert!(
        checked
            .errors
            .iter()
            .any(|e| e.contains("B cap — shorten the directive")),
        "{:?}",
        checked.errors
    );
}

#[test]
fn rejects_an_unsafe_run_id_and_builds_a_deterministic_path() {
    let root = std::path::Path::new("/tmp/p");
    assert!(
        dossier_path(root, "../escape")
            .expect_err("a path-shaped run id is refused")
            .contains("invalid supervision run id")
    );
    assert_eq!(
        dossier_path(root, "run-1").expect("valid run id"),
        std::path::Path::new("/tmp/p/tasks/reports/run-1-athena-supervision.md")
    );
}

#[test]
fn rejects_an_unknown_field_rather_than_stripping_it() {
    assert!(!validate_dossier(&with("counselHistory", json!("…"))).ok);
}

#[test]
fn rejects_an_unknown_stage_and_a_negative_correction_count() {
    assert!(!validate_dossier(&with("stage", json!("PLAN"))).ok);
    assert!(!validate_dossier(&with("correctionCount", json!(-1))).ok);
}

#[test]
fn accepts_a_pending_and_a_committed_checkpoint_marker() {
    let pending = with(
        "checkpoint",
        json!({ "checkpointId": "c1", "stage": "REVIEW", "state": "pending" }),
    );
    assert!(validate_dossier(&pending).ok);

    let committed = with(
        "checkpoint",
        json!({ "checkpointId": "c1", "stage": "REVIEW", "state": "committed", "partition": "ship" }),
    );
    let parsed: Dossier = serde_json::from_value(committed).expect("valid marker");
    let marker = parsed.checkpoint.expect("marker");
    assert_eq!(marker.state, CheckpointState::Committed);
    assert_eq!(marker.partition.as_deref(), Some("ship"));
}

#[test]
fn rejects_an_unknown_checkpoint_state_and_an_empty_checkpoint_id() {
    assert!(
        !validate_dossier(&with(
            "checkpoint",
            json!({ "checkpointId": "c1", "stage": "REVIEW", "state": "approved" })
        ))
        .ok
    );
    assert!(
        !validate_dossier(&with(
            "checkpoint",
            json!({ "checkpointId": "", "stage": "REVIEW", "state": "pending" })
        ))
        .ok
    );
}

#[test]
fn keeps_the_history_the_caps_are_counted_against() {
    let checked = validate_dossier(&with(
        "history",
        json!([
            { "checkpointId": "c1", "stage": "REVIEW", "disposition": "RETURN_TO_EXECUTOR" },
            { "checkpointId": "c2", "stage": "RECHECK", "disposition": "READY_FOR_EXISTING_GATE", "partition": "ship" }
        ]),
    ));
    assert!(checked.ok, "{:?}", checked.errors);
}

#[test]
fn a_history_entry_with_no_partition_still_parses() {
    // An entry written before partitioning belongs to a per-run budget, which is
    // exactly what those runs had.
    let parsed: Dossier = serde_json::from_value(with(
        "history",
        json!([{ "checkpointId": "c1", "stage": "GUIDE", "disposition": "CONTINUE_WITH_DIRECTIVE" }]),
    ))
    .expect("valid history");
    assert_eq!(parsed.history[0].partition, None);
}

#[test]
fn escalated_to_human_records_that_supervision_stopped() {
    let parsed: Dossier =
        serde_json::from_value(with("escalatedToHuman", json!(true))).expect("valid dossier");
    assert!(parsed.escalated_to_human);
    assert!(validate_dossier(&with("escalatedToHuman", json!(true))).ok);
}

#[test]
fn rejects_a_candidate_that_is_not_an_object() {
    assert!(!validate_dossier(&json!("a dossier")).ok);
}
