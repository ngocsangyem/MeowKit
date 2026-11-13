use super::*;
use serde_json::json;

fn object(value: serde_json::Value) -> Map<String, Value> {
    value.as_object().expect("an object").clone()
}

#[test]
fn an_empty_input_packet_names_every_missing_field_in_schema_order() {
    assert_eq!(
        shape_issues(PacketKind::Input, &object(json!({}))),
        vec![
            "runId: Required",
            "skill: Required",
            "stage: Required",
            "checkpointId: Required",
            "mission: Required",
            "currentState: Required",
            "question: Required",
            "riskAndReversibility: Required",
        ]
    );
}

#[test]
fn wrong_types_unknown_stages_and_extra_keys_report_the_way_the_schema_does() {
    let issues = shape_issues(
        PacketKind::Input,
        &object(json!({
            "runId": 1, "skill": "", "stage": "BOGUS", "checkpointId": "c", "mission": "m",
            "currentState": "s", "question": "q", "riskAndReversibility": "r",
            "lockedDecisions": "nope", "evidenceRefs": [{ "path": "", "relevance": "r" }],
            "extraKey": 1, "another": 2
        })),
    );
    assert_eq!(
        issues,
        vec![
            "runId: Expected string, received number",
            "skill: String must contain at least 1 character(s)",
            "stage: Invalid enum value. Expected 'GUIDE' | 'RESCUE' | 'REVIEW' | 'RECHECK', received 'BOGUS'",
            "lockedDecisions: Expected array, received string",
            "evidenceRefs.0.path: String must contain at least 1 character(s)",
            "evidenceRefs.0.path: must be a single-line path",
            "evidenceRefs.0.provenance: Required",
            "evidenceRefs.0.summary: Required",
            "(root): Unrecognized key(s) in object: 'extraKey', 'another'",
        ]
    );
}

#[test]
fn the_pointer_budget_is_checked_before_the_pointers() {
    let pointer = json!({ "path": "p", "relevance": "r", "provenance": "p", "summary": "s" });
    let packet = object(json!({
        "runId": "r", "skill": "s", "stage": "GUIDE", "checkpointId": "c", "mission": "m",
        "currentState": "s", "question": "q", "riskAndReversibility": "r",
        "evidenceRefs": vec![pointer; 6]
    }));
    assert_eq!(
        shape_issues(PacketKind::Input, &packet),
        vec!["evidenceRefs: Array must contain at most 5 element(s)"]
    );
}

#[test]
fn a_nullable_prior_directive_accepts_null_and_refuses_a_number() {
    let base = json!({
        "runId": "r", "skill": "s", "stage": "GUIDE", "checkpointId": "c", "mission": "m",
        "currentState": "s", "question": "q", "riskAndReversibility": "r"
    });
    let mut null = object(base.clone());
    null.insert("priorDirective".into(), Value::Null);
    assert!(shape_issues(PacketKind::Input, &null).is_empty());

    let mut number = object(base);
    number.insert("priorDirective".into(), json!(5));
    assert_eq!(
        shape_issues(PacketKind::Input, &number),
        vec!["priorDirective: Expected string, received number"]
    );
}

#[test]
fn the_output_packet_strips_unknown_keys_rather_than_refusing_them() {
    let packet = object(json!({
        "disposition": "APPROVED", "confidence": "sure",
        "requiredCorrections": [{ "change": "", "proofRequired": 5 }],
        "evidenceRead": [1], "strayKey": true
    }));
    assert_eq!(
        shape_issues(PacketKind::Output, &packet),
        vec![
            "disposition: Invalid enum value. Expected 'CONTINUE_WITH_DIRECTIVE' | 'READY_FOR_EXISTING_GATE' | 'RETURN_TO_EXECUTOR' | 'ESCALATE_TO_HUMAN' | 'BLOCKED_MISSING_EVIDENCE', received 'APPROVED'",
            "requiredCorrections.0.change: String must contain at least 1 character(s)",
            "requiredCorrections.0.proofRequired: Expected string, received number",
            "confidence: Invalid enum value. Expected 'low' | 'medium' | 'high', received 'sure'",
            "evidenceRead.0: Expected string, received number",
        ],
        "no unrecognised-key issue: the output schema is not strict"
    );
}

#[test]
fn a_brief_that_claims_supervision_is_told_which_field_claimed_it() {
    let brief = object(json!({
        "situation": "s", "decisionRecommendation": "d", "nextFalsifiableCheck": "n",
        "escalationPoint": "e", "confidence": "high",
        "disposition": "RETURN_TO_EXECUTOR", "stray": 1
    }));
    assert_eq!(
        forbidden_brief_fields(&brief),
        vec![
            "\"disposition\" belongs to embedded supervision — a direct consult is stateless and routes no workflow"
        ]
    );
    assert_eq!(
        shape_issues(PacketKind::Brief, &brief),
        vec!["(root): Unrecognized key(s) in object: 'disposition', 'stray'"]
    );
}

#[test]
fn a_complete_brief_has_no_shape_problem() {
    let brief = object(json!({
        "situation": "s", "decisionRecommendation": "d", "nextFalsifiableCheck": "n",
        "escalationPoint": "e", "confidence": "high"
    }));
    assert!(shape_issues(PacketKind::Brief, &brief).is_empty());
    assert!(forbidden_brief_fields(&brief).is_empty());
}

#[test]
fn an_over_long_pointer_path_reports_the_ceiling() {
    let packet = object(json!({
        "runId": "r", "skill": "s", "stage": "GUIDE", "checkpointId": "c", "mission": "m",
        "currentState": "s", "question": "q", "riskAndReversibility": "r",
        "evidenceRefs": [{
            "path": "a".repeat(MAX_POINTER_PATH_LENGTH + 1),
            "relevance": "r", "provenance": "p", "summary": "s"
        }]
    }));
    assert_eq!(
        shape_issues(PacketKind::Input, &packet),
        vec!["evidenceRefs.0.path: String must contain at most 512 character(s)"]
    );
}
