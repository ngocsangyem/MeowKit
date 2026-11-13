use std::path::Path;

use serde_json::{Value, json};

use super::super::exec::{Exec, ExecResult};
use super::super::test_session::{Seed, seed_session};
use super::compose;

/// `gh` that is simply unavailable — the identity lookup fails, so self-PR
/// detection stays off and no network is involved.
struct NoGh;

impl Exec for NoGh {
    fn run(&self, _file: &str, _args: &[String], _cwd: &Path) -> ExecResult {
        ExecResult::failed("no gh")
    }
}

/// `gh api user` answers with a login, so a PR authored by that login is a
/// self-review.
struct Me(&'static str);

impl Exec for Me {
    fn run(&self, _file: &str, _args: &[String], _cwd: &Path) -> ExecResult {
        ExecResult {
            ok: true,
            out: format!("{}\n", self.0),
            err: String::new(),
        }
    }
}

fn bundle(root: &Path, session: &str) -> Value {
    let path = root
        .join("tasks/reviews")
        .join(session)
        .join(format!("{session}-verdict.json"));
    serde_json::from_str(&std::fs::read_to_string(path).expect("the proof bundle")).expect("parse")
}

#[test]
fn a_tampered_diff_refuses_before_any_verdict_exists() {
    let project = seed_session(&Seed {
        tamper_diff: true,
        ..Seed::complete("s1")
    });
    let result = compose(project.path(), "s1", &NoGh);
    assert_eq!(
        result.error.as_deref(),
        Some(
            "diff.patch hash does not match the manifest — the captured diff was modified; restart the review"
        )
    );
    assert!(
        !project
            .path()
            .join("tasks/reviews/s1/s1-verdict.json")
            .exists(),
        "a verdict was written for a tampered capture"
    );
}

#[test]
fn incomplete_coverage_hard_refuses_with_no_verdict() {
    let project = seed_session(&Seed {
        drop_reviewer: Some("security"),
        ..Seed::complete("s2")
    });
    let result = compose(project.path(), "s2", &NoGh);
    assert!(!result.ok);
    assert_eq!(
        result.error.as_deref(),
        Some(
            "coverage incomplete (1 gap(s)) — complete reviewer coverage before composing; run 'mewkit review coverage --session s2'"
        )
    );
    assert!(result.decision.is_none());
    assert!(
        !project
            .path()
            .join("tasks/reviews/s2/submit-payload.json")
            .exists()
    );
}

#[test]
fn attested_evidence_caps_the_outcome_below_approve() {
    let project = seed_session(&Seed::complete("s3"));
    let result = compose(project.path(), "s3", &NoGh);
    assert_eq!(result.decision.as_deref(), Some("PASS_WITH_RISK"));
    assert_ne!(result.event.as_deref(), Some("APPROVE"));
    assert_eq!(
        result.reasons.as_deref(),
        Some(["evidence level: attested — Approve unavailable".to_string()].as_slice())
    );
}

#[test]
fn a_clean_session_observed_session_reaches_pass_and_writes_the_bundle() {
    let project = seed_session(&Seed {
        hook_corroborated: true,
        ..Seed::complete("s4")
    });
    let result = compose(project.path(), "s4", &NoGh);
    assert_eq!(result.decision.as_deref(), Some("PASS"), "{result:?}");
    assert_eq!(result.event.as_deref(), Some("APPROVE"));
    let proof = bundle(project.path(), "s4");
    assert_eq!(proof["gate"], json!("review"));
    assert_eq!(proof["decision"], json!("PASS"));
    assert_eq!(proof["dimensions"][0]["verdict"], json!("PASS"));
    assert_eq!(
        proof["coverage"]["report"]["evidenceLevel"],
        json!("session-observed")
    );
    // The coverage hash covers the report as it is serialized, so a later edit
    // of the embedded report is detectable.
    assert_eq!(
        proof["coverage"]["sha256"],
        json!(crate::fsx::sha256_hex(
            serde_json::to_string(&proof["coverage"]["report"])
                .expect("serialize")
                .as_bytes()
        ))
    );
    let payload: Value = serde_json::from_str(
        &std::fs::read_to_string(project.path().join("tasks/reviews/s4/submit-payload.json"))
            .expect("the payload"),
    )
    .expect("parse");
    assert_eq!(payload["event"], json!("APPROVE"));
    assert_eq!(payload["body"], json!("PASS"));
    assert!(
        std::fs::read_to_string(project.path().join("tasks/reviews/s4/verdict.md"))
            .expect("the verdict note")
            .starts_with(
                "# Review verdict — PASS\n\nEvent: APPROVE\nEvidence level: session-observed\n"
            )
    );
}

#[test]
fn a_confirmed_critical_finding_blocks() {
    let project = seed_session(&Seed {
        hook_corroborated: true,
        findings: Some(json!([{
            "location": "src/a.ts:1",
            "failureScenario": "token leaks to the log",
            "severity": "CRITICAL",
            "confidence": "HIGH",
        }])),
        ..Seed::complete("s5")
    });
    let result = compose(project.path(), "s5", &NoGh);
    assert_eq!(result.decision.as_deref(), Some("BLOCKED"));
    assert_eq!(result.event.as_deref(), Some("REQUEST_CHANGES"));
    assert_eq!(
        bundle(project.path(), "s5")["dimensions"][0]["verdict"],
        json!("FAIL")
    );
}

#[test]
fn a_finding_without_a_failure_scenario_is_refused() {
    let project = seed_session(&Seed {
        hook_corroborated: true,
        findings: Some(json!([{
            "location": "src/a.ts:1",
            "severity": "MAJOR",
            "confidence": "LOW",
        }])),
        ..Seed::complete("s6")
    });
    let result = compose(project.path(), "s6", &NoGh);
    assert!(
        result
            .error
            .as_deref()
            .is_some_and(|e| e.starts_with("invalid finding:")),
        "{result:?}"
    );
}

#[test]
fn red_ci_and_a_self_authored_pr_each_cap_the_verdict() {
    let project = seed_session(&Seed {
        hook_corroborated: true,
        ci: Some("build\tfail\t1m\n"),
        ..Seed::complete("s7")
    });
    let result = compose(project.path(), "s7", &NoGh);
    assert_eq!(result.decision.as_deref(), Some("PASS_WITH_RISK"));
    assert_eq!(
        result.reasons.as_deref(),
        Some(["CI red".to_string()].as_slice())
    );

    let project = seed_session(&Seed {
        hook_corroborated: true,
        pr_author: Some("me"),
        ..Seed::complete("s8")
    });
    let result = compose(project.path(), "s8", &Me("me"));
    assert_eq!(
        result.reasons.as_deref(),
        Some(["self-authored PR".to_string()].as_slice())
    );
}

#[test]
fn all_skipped_ci_is_not_green() {
    let project = seed_session(&Seed {
        hook_corroborated: true,
        ci: Some("build\tskipped\t0s\nlint\tskipping\t0s\n"),
        ..Seed::complete("s9")
    });
    let result = compose(project.path(), "s9", &NoGh);
    assert_eq!(
        result.reasons.as_deref(),
        Some(["all CI checks skipped".to_string()].as_slice())
    );
}

#[test]
fn an_inline_finding_is_pinned_by_snippet_and_an_ambiguous_one_is_not() {
    let project = seed_session(&Seed {
        hook_corroborated: true,
        findings: Some(json!([
            {
                "location": "src/a.ts:99",
                "failureScenario": "x is unbounded",
                "severity": "MINOR",
                "confidence": "LOW",
                "snippet": "const x = 1;",
            },
            {
                "location": "src/a.ts:1",
                "failureScenario": "not in the diff",
                "severity": "MINOR",
                "confidence": "LOW",
                "snippet": "nothing like this",
            }
        ])),
        ..Seed::complete("s10")
    });
    compose(project.path(), "s10", &NoGh);
    let findings = bundle(project.path(), "s10")["findings"].clone();
    // The reported line 99 is ignored: the snippet decides.
    assert_eq!(findings[0]["anchor"]["line"], json!(1));
    assert_eq!(findings[1]["anchorUnresolved"], json!("not-found"));
    // Declared fields first, then the passed-through ones.
    let keys: Vec<&String> = findings[0].as_object().expect("an object").keys().collect();
    assert_eq!(
        keys,
        [
            "location",
            "failureScenario",
            "severity",
            "confidence",
            "snippet",
            "anchor"
        ]
    );
}

#[test]
fn a_degraded_capture_recorded_at_prepare_caps_the_verdict() {
    let project = seed_session(&Seed {
        hook_corroborated: true,
        context_unavailable: Some(vec!["ci-checks".into()]),
        ..Seed::complete("s11")
    });
    let result = compose(project.path(), "s11", &NoGh);
    assert_eq!(
        result.reasons.as_deref(),
        Some(["context unavailable: ci-checks".to_string()].as_slice())
    );
}

#[test]
fn a_session_that_was_never_prepared_cannot_be_composed() {
    let project = tempfile::tempdir().expect("a temp dir");
    assert_eq!(
        compose(project.path(), "ghost", &NoGh).error.as_deref(),
        Some(
            format!(
                "no review session at {}",
                ["tasks", "reviews", "ghost"].join(std::path::MAIN_SEPARATOR_STR)
            )
            .as_str()
        )
    );
}
