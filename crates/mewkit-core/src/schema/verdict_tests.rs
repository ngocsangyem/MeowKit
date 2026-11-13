//! Accept/reject cases for the verdict proof bundle. The decision vocabulary
//! cases mirror `review/__tests__/schema.test.ts` ("rejects a decision-level
//! WARN"); the passthrough case covers the review-session bundle that
//! `.claude/hooks/lib/validate-review-coverage.cjs` reads out of `review_session`
//! and `coverage` — fields this schema does not name and must not strip.

use serde_json::json;

use super::*;

fn verdict() -> serde_json::Value {
    json!({
        "schema_version": "1.0.0",
        "slug": "261112-rust-port",
        "gate": "review",
        "decision": "PASS",
        "dimensions": [{ "name": "Correctness", "verdict": "PASS" }],
        "created_at": "2026-11-12T00:00:00.000Z"
    })
}

#[test]
fn accepts_a_well_formed_verdict() {
    let parsed = Verdict::parse(&verdict()).expect("valid verdict");
    assert_eq!(parsed.decision, VerdictDecision::Pass);
    assert_eq!(parsed.gate, VerdictGate::Review);
    assert!(!parsed.decision_blocks());
    assert!(parsed.failed_dimensions().is_empty());
}

#[test]
fn reports_a_blocked_decision_and_failed_dimensions_without_deciding_the_gate() {
    let mut blocked = verdict();
    blocked["decision"] = json!("BLOCKED");
    blocked["dimensions"] = json!([
        { "name": "Security", "verdict": "FAIL", "note": "missing auth guard" },
        { "name": "Tests", "verdict": "WARN" }
    ]);
    let parsed = Verdict::parse(&blocked).expect("valid verdict");
    assert!(parsed.decision_blocks());
    assert_eq!(parsed.failed_dimensions(), vec!["Security"]);
}

#[test]
fn accepts_pass_with_risk_but_rejects_a_decision_level_warn() {
    let mut risky = verdict();
    risky["decision"] = json!("PASS_WITH_RISK");
    assert_eq!(
        Verdict::parse(&risky).expect("valid").decision,
        VerdictDecision::PassWithRisk
    );
    // There is no decision-level WARN: residual risk maps to PASS_WITH_RISK, so
    // a verdict cannot be half-approved.
    let mut bad = verdict();
    bad["decision"] = json!("WARN");
    assert!(Verdict::parse(&bad).is_err());
}

#[test]
fn rejects_an_unknown_gate_and_an_unknown_dimension_state() {
    let mut bad = verdict();
    bad["gate"] = json!("vibes");
    assert!(Verdict::parse(&bad).is_err());

    let mut bad = verdict();
    bad["dimensions"][0]["verdict"] = json!("MOSTLY");
    assert!(Verdict::parse(&bad).is_err());
}

#[test]
fn rejects_an_empty_slug_and_an_empty_dimension_name() {
    let mut bad = verdict();
    bad["slug"] = json!("");
    assert!(Verdict::parse(&bad).is_err());

    let mut bad = verdict();
    bad["dimensions"][0]["name"] = json!("");
    assert!(Verdict::parse(&bad).is_err());
}

#[test]
fn rejects_a_verdict_missing_a_structurally_load_bearing_field() {
    for field in ["decision", "dimensions", "created_at", "gate", "slug"] {
        let mut bad = verdict();
        bad.as_object_mut().expect("object").remove(field);
        assert!(Verdict::parse(&bad).is_err(), "{field} must be required");
    }
}

#[test]
fn keeps_the_review_session_proof_bundle_fields_the_coverage_hook_reads() {
    let mut bundle = verdict();
    bundle["review_session"] = json!("s17");
    bundle["coverage"] = json!({
        "report": { "complete": true, "gaps": [], "evidenceLevel": "session-observed" },
        "sha256": "f".repeat(64)
    });
    let parsed = Verdict::parse(&bundle).expect("valid bundle");
    assert_eq!(parsed.extra["review_session"], json!("s17"));
    let back = serde_json::to_value(&parsed).expect("serializable");
    assert_eq!(back["coverage"]["report"]["complete"], json!(true));
}

fn native(path: &str) -> String {
    path.replace('/', std::path::MAIN_SEPARATOR_STR)
}

#[test]
fn resolve_verdict_path_handles_a_slug_a_markdown_sibling_and_an_explicit_path() {
    assert_eq!(
        resolve_verdict_path("261112-rust-port"),
        native("tasks/reviews/261112-rust-port-verdict.json")
    );
    assert_eq!(
        resolve_verdict_path("x/../y"),
        native("tasks/reviews/y-verdict.json")
    );
    assert_eq!(
        resolve_verdict_path("tasks/reviews/x-verdict.md"),
        "tasks/reviews/x-verdict.json"
    );
    assert_eq!(
        resolve_verdict_path("/abs/x-verdict.json"),
        "/abs/x-verdict.json"
    );
}
