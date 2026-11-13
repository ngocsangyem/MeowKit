use crate::schema::review_session::EvidenceLevel;

use super::{Decision, ReviewEvent, VerdictInput, compute_verdict};

fn clean() -> VerdictInput {
    VerdictInput {
        confirmed_critical: false,
        coverage_complete: true,
        evidence_level: EvidenceLevel::SessionObserved,
        ci_red: false,
        ci_all_skipped: false,
        context_unavailable: Vec::new(),
        self_pr: false,
    }
}

#[test]
fn only_a_clean_session_observed_green_session_reaches_approve() {
    let verdict = compute_verdict(&clean());
    assert_eq!(verdict.decision, Decision::Pass);
    assert_eq!(verdict.event, ReviewEvent::Approve);
    assert!(verdict.reasons.is_empty());
}

#[test]
fn the_same_input_always_produces_the_same_verdict() {
    assert_eq!(compute_verdict(&clean()), compute_verdict(&clean()));
}

#[test]
fn a_confirmed_critical_blocks_and_nothing_else_is_reported() {
    let verdict = compute_verdict(&VerdictInput {
        confirmed_critical: true,
        coverage_complete: false,
        ci_red: true,
        ..clean()
    });
    assert_eq!(verdict.decision, Decision::Blocked);
    assert_eq!(verdict.event, ReviewEvent::RequestChanges);
    assert_eq!(verdict.reasons, ["confirmed Critical finding"]);
}

#[test]
fn each_risk_state_caps_below_approve_and_says_why() {
    for (input, reason) in [
        (
            VerdictInput {
                coverage_complete: false,
                ..clean()
            },
            "incomplete reviewer coverage",
        ),
        (
            VerdictInput {
                evidence_level: EvidenceLevel::Attested,
                ..clean()
            },
            "evidence level: attested — Approve unavailable",
        ),
        (
            VerdictInput {
                ci_red: true,
                ..clean()
            },
            "CI red",
        ),
        (
            VerdictInput {
                ci_all_skipped: true,
                ..clean()
            },
            "all CI checks skipped",
        ),
        (
            VerdictInput {
                context_unavailable: vec!["ci-checks".into()],
                ..clean()
            },
            "context unavailable: ci-checks",
        ),
        (
            VerdictInput {
                self_pr: true,
                ..clean()
            },
            "self-authored PR",
        ),
    ] {
        let verdict = compute_verdict(&input);
        assert_eq!(verdict.decision, Decision::PassWithRisk, "{reason}");
        assert_eq!(verdict.event, ReviewEvent::Comment, "{reason}");
        assert_eq!(verdict.reasons, [reason]);
    }
}

#[test]
fn a_decision_maps_to_one_dimension_state() {
    assert_eq!(Decision::Pass.dimension_verdict(), "PASS");
    assert_eq!(Decision::PassWithRisk.dimension_verdict(), "WARN");
    assert_eq!(Decision::Blocked.dimension_verdict(), "FAIL");
    assert_eq!(Decision::PassWithRisk.as_str(), "PASS_WITH_RISK");
    assert_eq!(ReviewEvent::RequestChanges.as_str(), "REQUEST_CHANGES");
}
