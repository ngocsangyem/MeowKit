//! `review read`, `review coverage` and `review compose` against both CLIs.
//!
//! These stages touch no network at all: they read a prepared session and
//! write the evidence, the coverage report and the proof bundle. The bundle is
//! what a human reads at Gate 2, so the file-tree comparison — which includes
//! `s1-verdict.json` byte for byte — is the point of the compose cases.
use crate::parity;

#[test]
#[ignore = "needs node and the TS build"]
fn a_read_prints_the_artifact_and_appends_a_receipt() {
    let Some((ts, _)) = parity::case("review-read-diff")
        .fixture("review-attested")
        .args(&[
            "review",
            "read",
            "--session",
            "s1",
            "--as",
            "security",
            "diff.patch",
        ])
        .writes(&["tasks/reviews/s1/evidence.jsonl"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(ts.stdout.starts_with("diff --git"), "{}", ts.describe());

    let Some((ts, _)) = parity::case("review-read-brief")
        .fixture("review-attested")
        .args(&[
            "review",
            "read",
            "--session",
            "s1",
            "--as",
            "security",
            "briefs/security.md",
        ])
        .run()
    else {
        return;
    };
    assert!(
        ts.stdout.contains("# Review brief — security"),
        "{}",
        ts.describe()
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_read_outside_the_confined_roots_is_refused() {
    let Some((ts, _)) = parity::case("review-read-escape")
        .fixture("review-attested")
        .args(&[
            "review",
            "read",
            "--session",
            "s1",
            "--as",
            "security",
            "../../../etc/hosts",
        ])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stderr.contains("symlinks may not escape them"),
        "{}",
        ts.describe()
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn an_absent_id_is_refused_and_a_numeric_path_crashes_both_the_same_way() {
    for (name, args, expected) in [
        (
            "review-read-no-session",
            vec!["review", "read"],
            "✗ invalid --session \"undefined\"",
        ),
        (
            "review-read-no-reviewer",
            vec!["review", "read", "--session", "s1"],
            "✗ invalid --as reviewer id \"undefined\"",
        ),
        (
            "review-read-numeric-path",
            vec!["review", "read", "--session", "s1", "--as", "sec", "123"],
            "Fatal: The \"paths[1]\" argument must be of type string. Received type number (123)",
        ),
    ] {
        let Some((ts, _)) = parity::case(name)
            .fixture("review-attested")
            .args(&args)
            .run()
        else {
            return;
        };
        assert_eq!((ts.code, ts.stderr.trim()), (1, expected));
    }
}

#[test]
#[ignore = "needs node and the TS build"]
fn coverage_reports_a_complete_session_as_attested_without_hook_corroboration() {
    let Some((ts, _)) = parity::case("review-coverage-attested")
        .fixture("review-attested")
        .args(&["review", "coverage", "--session", "s1"])
        .run()
    else {
        return;
    };
    assert_eq!(
        (ts.code, ts.stdout.trim()),
        (0, "✓ coverage complete · level=attested · 0 gap(s)")
    );

    let Some((ts, _)) = parity::case("review-coverage-observed-json")
        .fixture("review-observed")
        .args(&["review", "coverage", "--session", "s1", "--json"])
        .run()
    else {
        return;
    };
    assert!(
        ts.stdout
            .contains("\"evidenceLevel\": \"session-observed\"")
            && ts.stdout.contains("\"approveEligible\": true"),
        "{}",
        ts.describe()
    );
}

/// A session artifact that is not JSON refuses in both CLIs, but each quotes
/// its own parser's complaint — Node's `JSON.parse` there, serde here. Only
/// the refusal and the exit code are the contract.
#[test]
#[ignore = "needs node and the TS build"]
fn an_unparsable_impact_map_refuses_in_both_clis() {
    let Some((ts, rust)) = parity::case("review-coverage-broken-impact-map")
        .fixture("review-broken-impact")
        .args(&["review", "coverage", "--session", "s1"])
        .ignore_stderr("each CLI quotes its own JSON parser's message")
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    for run in [&ts, &rust] {
        assert!(
            run.stderr.contains("cannot read impact-map.json"),
            "{}",
            run.describe()
        );
    }
}

/// minimist reads flags wherever they sit and keeps an undeclared one as data,
/// so a hook that wrote `review --json coverage` or passed a stray flag must
/// keep working against the port.
#[test]
#[ignore = "needs node and the TS build"]
fn flags_are_read_wherever_they_sit_and_a_stray_one_is_ignored() {
    let Some((ts, _)) = parity::case("review-json-before-sub-verb")
        .fixture("review-attested")
        .args(&["review", "--json", "coverage", "--session", "s1"])
        .run()
    else {
        return;
    };
    assert!(ts.stdout.trim_start().starts_with('{'), "{}", ts.describe());

    let Some((ts, _)) = parity::case("review-stray-flag-and-equals-form")
        .fixture("review-attested")
        .args(&["review", "coverage", "--session=s1", "--bogus", "x"])
        .run()
    else {
        return;
    };
    assert_eq!(
        (ts.code, ts.stdout.trim()),
        (0, "✓ coverage complete · level=attested · 0 gap(s)")
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn an_incomplete_or_absent_session_exits_non_zero() {
    let Some((ts, _)) = parity::case("review-coverage-incomplete")
        .fixture("review-incomplete")
        .args(&["review", "coverage", "--session", "s1", "--json"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stdout.contains("\"type\": \"reviewer-never-launched\""),
        "{}",
        ts.describe()
    );

    let Some((ts, _)) = parity::case("review-coverage-no-session")
        .args(&["review", "coverage", "--session", "ghost"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stderr.contains("no impact-map.json"),
        "{}",
        ts.describe()
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_missing_session_flag_dies_in_the_path_api_in_both_clis() {
    for sub in ["coverage", "compose", "submit", "cleanup"] {
        let Some((ts, _)) = parity::case("review-missing-session-flag")
            .args(&["review", sub])
            .run()
        else {
            return;
        };
        assert_eq!(
            (ts.code, ts.stderr.trim()),
            (
                1,
                "Fatal: The \"path\" argument must be of type string. Received undefined"
            ),
            "{sub}"
        );
    }
}

/// The proof bundle, the submit payload and the verdict note are compared
/// byte for byte by the harness's file-tree check — including the hash the
/// bundle carries over its own embedded coverage report.
#[test]
#[ignore = "needs node and the TS build"]
fn a_clean_session_observed_session_composes_a_pass_bundle() {
    let Some((ts, _)) = parity::case("review-compose-pass")
        .fixture("review-observed")
        .args(&["review", "compose", "--session", "s1", "--json"])
        .writes(&[
            "tasks/reviews/s1/s1-verdict.json",
            "tasks/reviews/s1/submit-payload.json",
            "tasks/reviews/s1/verdict.md",
        ])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(
        ts.stdout.contains("\"decision\": \"PASS\"")
            && ts.stdout.contains("\"event\": \"APPROVE\""),
        "{}",
        ts.describe()
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn attested_evidence_caps_the_composed_decision_below_approve() {
    let Some((ts, _)) = parity::case("review-compose-attested")
        .fixture("review-attested")
        .args(&["review", "compose", "--session", "s1"])
        .writes(&["tasks/reviews/s1/s1-verdict.json"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert_eq!(
        ts.stdout.trim(),
        "⚠ PASS_WITH_RISK (COMMENT) — evidence level: attested — Approve unavailable"
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn incomplete_coverage_or_a_tampered_diff_refuses_with_no_verdict() {
    for (name, fixture, expected) in [
        (
            "review-compose-incomplete",
            "review-incomplete",
            "coverage incomplete (1 gap(s))",
        ),
        (
            "review-compose-tampered",
            "review-tampered",
            "diff.patch hash does not match the manifest",
        ),
    ] {
        let Some((ts, _)) = parity::case(name)
            .fixture(fixture)
            .args(&["review", "compose", "--session", "s1"])
            .run()
        else {
            return;
        };
        assert_eq!(ts.code, 1, "{}", ts.describe());
        assert!(ts.stderr.contains(expected), "{}", ts.describe());
    }
}
