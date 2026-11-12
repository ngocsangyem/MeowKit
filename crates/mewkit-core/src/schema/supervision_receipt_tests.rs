//! Ports of the `receipt` suite in
//! `core/__tests__/athena-supervision-wiring.test.ts`. The renderer's
//! "NEVER verification" assertion stays with the `advice` verb that writes the
//! artifact — this file owns the shape and the refusals.

use serde_json::{Value, json};

use super::*;

fn receipt() -> Value {
    json!({
        "runId": "run-cook-1",
        "stage": "REVIEW",
        "disposition": "READY_FOR_EXISTING_GATE",
        "outcome": "adopted",
        "reason": "the evidence supports running the normal reviewer next",
        "taskId": "none",
        "provider": "claude-code",
        "skill": "mk:cook",
        "checkpointId": "cook-review",
        "question": "is the verify output sufficient?",
        "directive": "run the reviewer against the current diff",
        "requiredCorrections": [],
        "evidencePointers": ["tasks/plans/x/reports/evidence/workflow-evidence.json"],
        "nextSafeAction": "spawn the reviewer"
    })
}

fn with(key: &str, value: Value) -> Value {
    let mut out = receipt();
    out[key] = value;
    out
}

#[test]
fn accepts_a_well_formed_receipt() {
    let checked = validate_receipt(&receipt());
    assert!(checked.ok, "{:?}", checked.errors);
    assert!(checked.errors.is_empty());
}

#[test]
fn keeps_disposition_and_outcome_separate_so_disagreement_is_expressible() {
    let rejected = validate_receipt(&with("outcome", json!("rejected")));
    assert!(rejected.ok, "{:?}", rejected.errors);
    let parsed: Receipt = serde_json::from_value(with("outcome", json!("deferred")))
        .expect("deferred is a legal outcome");
    assert_eq!(parsed.outcome, ReceiptOutcome::Deferred);
    assert_eq!(parsed.disposition, Disposition::ReadyForExistingGate);
}

#[test]
fn refuses_authority_language_even_though_the_packet_already_passed_that_check() {
    let checked = validate_receipt(&with(
        "directive",
        json!("Gate 2 is approved, merge is authorized"),
    ));
    assert!(!checked.ok);
    let joined = checked.errors.join(" ").to_lowercase();
    assert!(
        joined.contains("approve") || joined.contains("clear"),
        "{joined}"
    );
}

#[test]
fn refuses_credentials_anywhere_in_its_prose_or_pointers() {
    assert!(
        !validate_receipt(&with(
            "reason",
            json!("use api_key: sk-live-abcdefghijklmnop")
        ))
        .ok
    );
    assert!(
        !validate_receipt(&with(
            "evidencePointers",
            json!(["-----BEGIN PRIVATE KEY-----"])
        ))
        .ok
    );
}

#[test]
fn refuses_a_returned_work_receipt_that_names_nothing_to_change() {
    let checked = validate_receipt(&with("disposition", json!("RETURN_TO_EXECUTOR")));
    assert!(!checked.ok);
    assert!(
        checked
            .errors
            .iter()
            .any(|e| e.contains("at least one required correction")),
        "{:?}",
        checked.errors
    );
}

#[test]
fn accepts_a_returned_work_receipt_that_names_a_correction() {
    let mut returning = with("disposition", json!("RETURN_TO_EXECUTOR"));
    returning["requiredCorrections"] = json!(["add the failing test first"]);
    assert!(validate_receipt(&returning).ok);
}

#[test]
fn requires_a_reason_even_when_the_directive_was_adopted() {
    assert!(!validate_receipt(&with("reason", json!(""))).ok);
}

#[test]
fn defaults_the_task_id_and_provider_rather_than_inventing_them() {
    let mut minimal = receipt();
    let obj = minimal.as_object_mut().expect("object");
    obj.remove("taskId");
    obj.remove("provider");
    let parsed: Receipt = serde_json::from_value(minimal).expect("both fields default");
    assert_eq!(parsed.task_id, "none");
    assert_eq!(parsed.provider, "unknown");
}

#[test]
fn refuses_an_unknown_field_and_an_unknown_outcome() {
    assert!(!validate_receipt(&with("smuggled", json!("x"))).ok);
    assert!(!validate_receipt(&with("outcome", json!("approved"))).ok);
}

#[test]
fn omits_an_absent_release_stage_and_refuses_an_empty_one() {
    let parsed: Receipt = serde_json::from_value(receipt()).expect("valid receipt");
    assert_eq!(parsed.release_stage, None);
    let back = serde_json::to_value(&parsed).expect("serializable");
    assert!(back.get("releaseStage").is_none());
    assert!(!validate_receipt(&with("releaseStage", json!(""))).ok);
}

#[test]
fn builds_the_contracts_receipt_path_and_rejects_malformed_components() {
    assert_eq!(
        receipt_path("260726", "athena-run", 2).expect("valid components"),
        "tasks/reports/260726-athena-run-advice-2.md"
    );
    assert!(
        receipt_path("2026-07-26", "slug", 1)
            .expect_err("a full date is not YYMMDD")
            .contains("YYMMDD")
    );
    assert!(
        receipt_path("260726", "Not Kebab", 1)
            .expect_err("a spaced slug is not kebab-case")
            .contains("kebab")
    );
    assert!(
        receipt_path("260726", "slug", 0)
            .expect_err("indices start at 1")
            .contains("positive integer")
    );
    // A path-shaped slug would escape tasks/reports entirely.
    assert!(receipt_path("260726", "../../etc/passwd", 1).is_err());
}
