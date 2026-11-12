//! Ports of the `output packet validation` suite in
//! `core/__tests__/athena-supervision-contract.test.ts`, using the same
//! `validOutput` fixture.

use serde_json::{Value, json};

use super::*;

fn valid_output() -> Value {
    json!({
        "disposition": "CONTINUE_WITH_DIRECTIVE",
        "strategicAssessment": "The boundary validator is the highest-leverage constraint.",
        "decisionRecommendation": "Constrain the packet boundary before adding checkpoint wiring.",
        "strategicDirective": "Start with the packet validator; it constrains everything downstream.",
        "requiredCorrections": [],
        "nextFalsifiableCheck": "run the focused contract test",
        "risksAndRollback": "revert the flag route",
        "rejectedAlternatives": "a new supervise skill — more surface, no added safety",
        "assumptions": "Node 24 available",
        "confidence": "medium",
        "evidenceRead": ["tasks/plans/x/plan.md"]
    })
}

fn with(base: Value, key: &str, value: Value) -> Value {
    let mut out = base;
    out[key] = value;
    out
}

#[test]
fn accepts_a_well_formed_output_packet() {
    let checked = validate_output_packet(&valid_output());
    assert!(checked.ok, "{:?}", checked.errors);
}

#[test]
fn rejects_approval_clearance_and_gate_advancing_language() {
    for phrase in [
        "This is approved, proceed to ship.",
        "You are cleared to proceed past review.",
        "This advances Gate 2 once tests pass.",
        "Merge is approved.",
        "This counts as verification.",
    ] {
        let checked =
            validate_output_packet(&with(valid_output(), "strategicDirective", json!(phrase)));
        assert!(!checked.ok, "{phrase}");
    }
}

#[test]
fn permits_evidence_framed_wording() {
    assert!(
        validate_output_packet(&with(
            valid_output(),
            "decisionRecommendation",
            json!("The evidence supports landing the validator first.")
        ))
        .ok
    );
}

#[test]
fn rejects_return_to_executor_with_no_corrections() {
    let checked = validate_output_packet(&with(
        valid_output(),
        "disposition",
        json!("RETURN_TO_EXECUTOR"),
    ));
    assert!(!checked.ok);
    assert!(
        checked
            .errors
            .contains(&"RETURN_TO_EXECUTOR requires at least one required correction".to_string()),
        "{:?}",
        checked.errors
    );
}

#[test]
fn rejects_more_than_the_correction_budget() {
    let corrections: Vec<Value> = (0..=MAX_REQUIRED_CORRECTIONS)
        .map(|i| json!({ "change": format!("c{i}"), "proofRequired": "test" }))
        .collect();
    let packet = with(
        with(valid_output(), "disposition", json!("RETURN_TO_EXECUTOR")),
        "requiredCorrections",
        json!(corrections),
    );
    assert!(!validate_output_packet(&packet).ok);
}

#[test]
fn requires_proof_for_every_correction() {
    let packet = with(
        with(valid_output(), "disposition", json!("RETURN_TO_EXECUTOR")),
        "requiredCorrections",
        json!([{ "change": "fix it", "proofRequired": "" }]),
    );
    assert!(!validate_output_packet(&packet).ok);
}

#[test]
fn rejects_output_over_the_word_cap() {
    let checked = validate_output_packet(&with(
        valid_output(),
        "strategicDirective",
        json!("word ".repeat(OUTPUT_PACKET_MAX_WORDS + 5)),
    ));
    assert!(!checked.ok);
    assert!(
        checked.errors.iter().any(|e| e.contains("-word cap")),
        "{:?}",
        checked.errors
    );
}

#[test]
fn rejects_an_illegal_disposition_value() {
    assert!(!validate_output_packet(&with(valid_output(), "disposition", json!("APPROVED"))).ok);
}

#[test]
fn rejects_a_credential_echoed_back_in_returned_prose() {
    let checked = validate_output_packet(&with(
        valid_output(),
        "assumptions",
        json!("the config sets api_key = \"abcdef1234567890\""),
    ));
    assert!(!checked.ok);
    assert!(checked.errors.join(" ").contains("never carry credentials"));
}

#[test]
fn rejects_a_credential_in_the_evidence_read_list() {
    assert!(
        !validate_output_packet(&with(
            valid_output(),
            "evidenceRead",
            json!(["AKIAIOSFODNN7EXAMPLE"])
        ))
        .ok
    );
}
