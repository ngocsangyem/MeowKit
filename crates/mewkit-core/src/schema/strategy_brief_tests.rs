//! Ports of the `strategy brief shape` suite in
//! `core/__tests__/athena-direct-consult.test.ts`.
//!
//! The TS "non-enumerable property" case has no Rust analogue: a JSON object has
//! no hidden keys, and `serde_json::Map` cannot carry one, so the hole that test
//! closes does not exist here.

use serde_json::{Value, json};

use super::*;

fn brief() -> Value {
    json!({
        "situation": "two services write the same row and the later write silently wins",
        "decisionRecommendation": "serialize on an advisory lock in the owning service; the evidence supports it over a retry loop",
        "rejectedAlternatives": "optimistic retry — it hides the conflict rather than ordering it",
        "nextFalsifiableCheck": "run the concurrent reassign test; a lost update proves this wrong",
        "risksAndRollback": "lock contention under load; drop the lock and the old behavior returns",
        "escalationPoint": "if the fix needs a schema change, that is the owner's call",
        "assumptions": "both writers live in one deployment unit",
        "confidence": "medium",
        "evidenceRead": ["src/reassign.ts", "tasks/reports/concurrency-note.md"]
    })
}

fn with(key: &str, value: Value) -> Value {
    let mut out = brief();
    out[key] = value;
    out
}

#[test]
fn accepts_a_well_formed_brief() {
    let checked = validate_strategy_brief(&brief());
    assert!(checked.ok, "{:?}", checked.errors);
    assert!(checked.errors.is_empty());
}

#[test]
fn requires_the_fields_that_stop_it_becoming_an_opinion() {
    for field in [
        "situation",
        "decisionRecommendation",
        "nextFalsifiableCheck",
        "escalationPoint",
    ] {
        assert!(
            !validate_strategy_brief(&with(field, json!(""))).ok,
            "{field}"
        );
        let mut missing = brief();
        missing.as_object_mut().expect("object").remove(field);
        assert!(!validate_strategy_brief(&missing).ok, "{field} missing");
    }
    let mut no_confidence = brief();
    no_confidence
        .as_object_mut()
        .expect("object")
        .remove("confidence");
    assert!(!validate_strategy_brief(&no_confidence).ok);
}

#[test]
fn refuses_every_forbidden_field_by_name() {
    for field in FORBIDDEN_BRIEF_FIELDS {
        let checked = validate_strategy_brief(&with(field, json!("anything")));
        assert!(!checked.ok, "{field}");
        assert!(
            checked
                .errors
                .join(" ")
                .contains("belongs to embedded supervision"),
            "{field}: {:?}",
            checked.errors
        );
    }
}

#[test]
fn refuses_a_disposition_even_when_it_is_a_legal_embedded_value() {
    // The value is legal at REVIEW; what makes it illegal HERE is that there is
    // no run to route.
    let checked = validate_strategy_brief(&with("disposition", json!("READY_FOR_EXISTING_GATE")));
    assert!(!checked.ok);
    assert!(checked.errors.join(" ").contains("disposition"));
}

#[test]
fn refuses_an_unknown_field_outright() {
    assert!(!validate_strategy_brief(&with("somethingElse", json!(1))).ok);
}

#[test]
fn holds_a_consult_to_the_same_authority_language_bar_as_a_checkpoint() {
    let checked = validate_strategy_brief(&with(
        "decisionRecommendation",
        json!("this is approved, merge is authorized"),
    ));
    assert!(!checked.ok);
    let joined = checked.errors.join(" ").to_lowercase();
    assert!(
        joined.contains("approve") || joined.contains("clear"),
        "{joined}"
    );
}

#[test]
fn refuses_credentials_in_prose_or_in_the_evidence_it_read() {
    assert!(
        !validate_strategy_brief(&with(
            "situation",
            json!("token: ghp_abcdefghijklmnopqrstuvwxyz01")
        ))
        .ok
    );
    assert!(
        !validate_strategy_brief(&with(
            "evidenceRead",
            json!(["-----BEGIN PRIVATE KEY-----"])
        ))
        .ok
    );
}

#[test]
fn caps_length_because_volume_is_not_rigor() {
    let checked = validate_strategy_brief(&with("situation", json!("word ".repeat(700))));
    assert!(!checked.ok);
    assert!(
        checked.errors.iter().any(|e| e.contains("word cap")),
        "{:?}",
        checked.errors
    );
}

#[test]
fn rejects_a_candidate_that_is_not_an_object() {
    assert!(!validate_strategy_brief(&json!("a brief")).ok);
    assert!(!validate_strategy_brief(&json!(null)).ok);
}
