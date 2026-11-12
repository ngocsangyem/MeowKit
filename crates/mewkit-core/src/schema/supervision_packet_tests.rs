//! Ports of the `input packet validation` suite in
//! `core/__tests__/athena-supervision-contract.test.ts`, using the same
//! `validInput` fixture.

use serde_json::{Value, json};

use super::*;

fn valid_input() -> Value {
    json!({
        "runId": "run-1",
        "skill": "mk:cook",
        "stage": "GUIDE",
        "checkpointId": "cook-guide-1",
        "mission": "Add opt-in supervision to the cook pipeline",
        "lockedDecisions": ["explicit flag only"],
        "currentState": "Gate 1 approved; build not started",
        "workerSummary": "plan approved, no source edits yet",
        "evidenceRefs": [{
            "path": "tasks/plans/x/plan.md",
            "relevance": "approved scope",
            "provenance": "planner",
            "summary": "7 phases"
        }],
        "priorDirective": null,
        "question": "Which risk should the build address first?",
        "riskAndReversibility": "reversible; no public contract touched"
    })
}

fn with(base: Value, key: &str, value: Value) -> Value {
    let mut out = base;
    out[key] = value;
    out
}

#[test]
fn accepts_a_well_formed_input_packet() {
    let checked = validate_input_packet(&valid_input());
    assert!(checked.ok, "{:?}", checked.errors);
    assert!(checked.errors.is_empty());
}

#[test]
fn rejects_an_evidence_pointer_missing_provenance() {
    let checked = validate_input_packet(&with(
        valid_input(),
        "evidenceRefs",
        json!([{ "path": "a.md", "relevance": "x", "provenance": "", "summary": "y" }]),
    ));
    assert!(!checked.ok);
    assert!(
        checked.errors.join(" ").contains("provenance"),
        "{:?}",
        checked.errors
    );
}

#[test]
fn rejects_more_than_the_pointer_budget() {
    let refs: Vec<Value> = (0..=MAX_EVIDENCE_POINTERS)
        .map(|i| json!({ "path": format!("f{i}.md"), "relevance": "r", "provenance": "p", "summary": "s" }))
        .collect();
    assert!(!validate_input_packet(&with(valid_input(), "evidenceRefs", json!(refs))).ok);
}

#[test]
fn rejects_an_oversize_packet() {
    let checked = validate_input_packet(&with(
        valid_input(),
        "currentState",
        json!("x".repeat(INPUT_PACKET_MAX_BYTES + 1)),
    ));
    assert!(!checked.ok);
    assert!(
        checked.errors.iter().any(|e| e.contains("B cap")),
        "{:?}",
        checked.errors
    );
}

#[test]
fn rejects_a_pasted_diff_transcript_memory_dump_and_stack_log() {
    for payload in [
        "diff --git a/x b/x\n+++ b/x\n@@ -1 +1 @@",
        "User: do the thing\nAssistant: ok\nUser: again\nAssistant: sure",
        "##decision: a\n##pattern: b\n##note: c\n##decision: d",
        "    at foo (/a/b.ts:1:2)\n    at bar (/a/c.ts:3:4)\n    at baz (/a/d.ts:5:6)",
    ] {
        let checked = validate_input_packet(&with(valid_input(), "workerSummary", json!(payload)));
        assert!(!checked.ok, "{payload:?}");
    }
}

#[test]
fn rejects_credentials_in_any_prose_field() {
    for secret in [
        "-----BEGIN PRIVATE KEY-----",
        "AKIAIOSFODNN7EXAMPLE",
        "Authorization: Bearer abcdefghijklmnopqrstuvwxyz0123",
        "ghp_abcdefghijklmnopqrstuvwxyz0123",
        "api_key = \"abcdef1234567890\"",
    ] {
        let checked = validate_input_packet(&with(
            valid_input(),
            "currentState",
            json!(format!("state {secret}")),
        ));
        assert!(!checked.ok, "{secret}");
        assert!(
            checked.errors.join(" ").contains("never carry credentials"),
            "{secret}"
        );
    }
}

#[test]
fn does_not_flag_an_evidence_path_that_merely_mentions_a_diff() {
    let checked = validate_input_packet(&with(
        valid_input(),
        "evidenceRefs",
        json!([{
            "path": "tasks/reports/fix-diff.md",
            "relevance": "the diff under review",
            "provenance": "developer",
            "summary": "3 files"
        }]),
    ));
    assert!(checked.ok, "{:?}", checked.errors);
}

#[test]
fn tolerates_a_single_quoted_dialogue_line_as_evidence() {
    assert!(
        validate_input_packet(&with(
            valid_input(),
            "workerSummary",
            json!("User: \"it still fails\"")
        ))
        .ok
    );
}

#[test]
fn rejects_a_credential_smuggled_through_an_evidence_pointer_path() {
    let checked = validate_input_packet(&with(
        valid_input(),
        "evidenceRefs",
        json!([{
            "path": "-----BEGIN RSA PRIVATE KEY-----MIIabc",
            "relevance": "x",
            "provenance": "p",
            "summary": "y"
        }]),
    ));
    assert!(!checked.ok);
    assert!(checked.errors.join(" ").contains("never carry credentials"));
}

#[test]
fn rejects_a_multi_line_payload_disguised_as_a_pointer_path() {
    let checked = validate_input_packet(&with(
        valid_input(),
        "evidenceRefs",
        json!([{
            "path": "notes.md\ndiff --git a/x b/x",
            "relevance": "x",
            "provenance": "p",
            "summary": "y"
        }]),
    ));
    assert!(!checked.ok);
    assert!(
        checked.errors.join(" ").contains("single-line path"),
        "{:?}",
        checked.errors
    );
}

#[test]
fn rejects_unknown_keys_instead_of_silently_stripping_them() {
    let checked = validate_input_packet(&with(
        valid_input(),
        "smuggled",
        json!("-----BEGIN RSA PRIVATE KEY-----"),
    ));
    assert!(!checked.ok);
}

#[test]
fn an_input_packet_round_trips_through_its_wire_shape() {
    let packet: InputPacket = serde_json::from_value(valid_input()).expect("valid packet");
    assert_eq!(packet.stage, super::SupervisionStage::Guide);
    let back = serde_json::to_value(&packet).expect("serializable");
    assert_eq!(back["checkpointId"], json!("cook-guide-1"));
    assert_eq!(back["priorDirective"], Value::Null);
    assert!(packet_bytes(&packet) < INPUT_PACKET_MAX_BYTES);
}
