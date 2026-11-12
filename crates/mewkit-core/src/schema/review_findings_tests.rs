//! Ports of the `FindingSchema` and `VerdictStateSchema` cases in
//! `review/__tests__/schema.test.ts`, plus scenario 12 of
//! `review/parity/parity.test.ts` ("reject a finding without a failure
//! scenario").

use serde_json::json;

use super::*;

#[test]
fn accepts_a_finding_with_severity_and_confidence() {
    let finding = Finding::parse(&json!({
        "location": "src/a.ts:12",
        "failureScenario": "empty input → throws",
        "severity": "CRITICAL",
        "confidence": "HIGH"
    }))
    .expect("valid finding");
    assert_eq!(finding.severity, Severity::Critical);
    assert_eq!(finding.confidence, Confidence::High);
}

#[test]
fn rejects_an_out_of_vocabulary_severity() {
    assert!(
        Finding::parse(&json!({
            "location": "src/a.ts:12",
            "failureScenario": "x",
            "severity": "BLOCKER",
            "confidence": "HIGH"
        }))
        .is_err()
    );
}

#[test]
fn rejects_a_finding_without_a_failure_scenario() {
    assert!(
        Finding::parse(&json!({
            "location": "a.ts:1",
            "severity": "MAJOR",
            "confidence": "LOW"
        }))
        .is_err()
    );
}

#[test]
fn accepts_pass_with_risk_with_a_warn_dimension() {
    let state = VerdictState::parse(&json!({
        "decision": "PASS_WITH_RISK",
        "dimensions": [{ "name": "Correctness", "verdict": "WARN" }]
    }))
    .expect("WARN maps to PASS_WITH_RISK at decision level");
    assert_eq!(state.decision, super::VerdictDecision::PassWithRisk);
    assert!(state.findings.is_empty());
}

#[test]
fn rejects_a_decision_level_warn() {
    assert!(VerdictState::parse(&json!({ "decision": "WARN", "dimensions": [] })).is_err());
}
