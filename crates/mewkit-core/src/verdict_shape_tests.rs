//! Expected strings were captured from zod 3.25.76 (the npm CLI's pinned
//! major) running the TS `VerdictSchema` on the same inputs.
use serde_json::json;

use super::verdict_issues;

#[test]
fn a_non_object_root_names_its_type() {
    for (value, kind) in [
        (json!([]), "array"),
        (json!(null), "null"),
        (json!(5), "number"),
        (json!("x"), "string"),
        (json!(true), "boolean"),
    ] {
        assert_eq!(
            verdict_issues(&value),
            vec![format!("<root>: Expected object, received {kind}")]
        );
    }
}

#[test]
fn every_missing_required_key_is_reported_in_schema_order() {
    assert_eq!(
        verdict_issues(&json!({})),
        vec![
            "schema_version: Required",
            "slug: Required",
            "gate: Required",
            "decision: Required",
            "dimensions: Required",
            "created_at: Required",
        ]
    );
}

#[test]
fn nested_issues_match_zod_word_for_word() {
    let value = json!({
        "schema_version": 1, "slug": "", "gate": "x", "decision": 3,
        "dimensions": ["a", {"name": "", "verdict": "NO", "note": null}, {"verdict": true}, []],
        "evidence_refs": [1, "a", null, {}], "created_at": null
    });
    assert_eq!(
        verdict_issues(&value),
        vec![
            "schema_version: Expected string, received number",
            "slug: String must contain at least 1 character(s)",
            "gate: Invalid enum value. Expected 'review' | 'contract', received 'x'",
            "decision: Expected 'PASS' | 'PASS_WITH_RISK' | 'BLOCKED', received number",
            "dimensions.0: Expected object, received string",
            "dimensions.1.name: String must contain at least 1 character(s)",
            "dimensions.1.verdict: Invalid enum value. Expected 'PASS' | 'WARN' | 'FAIL', received 'NO'",
            "dimensions.1.note: Expected string, received null",
            "dimensions.2.name: Required",
            "dimensions.2.verdict: Expected 'PASS' | 'WARN' | 'FAIL', received boolean",
            "dimensions.3: Expected object, received array",
            "evidence_refs.0: Expected string, received number",
            "evidence_refs.2: Expected string, received null",
            "evidence_refs.3: Expected string, received object",
            "created_at: Expected string, received null",
        ]
    );
}

#[test]
fn wrong_container_types_and_an_explicit_null_optional() {
    let value = json!({
        "schema_version": "1", "slug": "s", "gate": "review", "decision": "PASS",
        "dimensions": {}, "evidence_refs": "x", "created_at": 1.5
    });
    assert_eq!(
        verdict_issues(&value),
        vec![
            "dimensions: Expected array, received object",
            "evidence_refs: Expected array, received string",
            "created_at: Expected string, received number",
        ]
    );
    let value = json!({
        "schema_version": "1", "slug": "s", "gate": "review", "decision": "PASS",
        "dimensions": [], "created_at": "t", "evidence_refs": null
    });
    assert_eq!(
        verdict_issues(&value),
        vec!["evidence_refs: Expected array, received null"]
    );
}

#[test]
fn a_valid_verdict_with_unknown_keys_passes() {
    let value = json!({
        "schema_version": "1", "slug": "s", "gate": "contract", "decision": "BLOCKED",
        "dimensions": [{"name": "Security", "verdict": "FAIL", "extra": 1}],
        "created_at": "t", "reviewer": "x"
    });
    assert!(verdict_issues(&value).is_empty());
}
