//! `budget context`: what one or every install profile costs to LOAD, and the
//! `--fail-over` guardrail that turns an oversized profile into an exit code.
use crate::parity;

use super::OWN_JSON_ERROR;

#[test]
#[ignore = "needs node and the TS build"]
fn the_context_estimate_splits_every_profile_by_load_tier() {
    let Some((ts, _)) = parity::case("budget-context")
        .fixture("budget-context")
        .args(&["budget", "context"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    // All three tiers, both pack profiles and the wildcard one.
    for marker in ["always-on", "conditional", "on-demand", "developer", "full"] {
        assert!(ts.stdout.contains(marker), "{marker}: {}", ts.describe());
    }
}

#[test]
#[ignore = "needs node and the TS build"]
fn the_context_estimate_serializes_the_same_document() {
    let Some((ts, _)) = parity::case("budget-context-json")
        .fixture("budget-context")
        .args(&["budget", "context", "--json"])
        .run()
    else {
        return;
    };
    assert!(ts.stdout.trim_start().starts_with('['), "{}", ts.describe());
    assert!(ts.stdout.contains("\"tiers\""), "{}", ts.describe());
}

#[test]
#[ignore = "needs node and the TS build"]
fn one_profile_can_be_selected_and_an_unknown_one_is_named() {
    let Some((ts, _)) = parity::case("budget-context-profile")
        .fixture("budget-context")
        .args(&["budget", "context", "--profile", "core"])
        .run()
    else {
        return;
    };
    assert!(!ts.stdout.contains("developer"), "{}", ts.describe());

    let Some((ts, _)) = parity::case("budget-context-unknown-profile")
        .fixture("budget-context")
        .args(&["budget", "context", "--profile", "nope"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stderr
            .contains("Unknown profile \"nope\". Available: core, developer, full"),
        "{}",
        ts.describe()
    );
}

/// The CI guardrail: over the threshold is a non-zero exit, under it is not.
#[test]
#[ignore = "needs node and the TS build"]
fn fail_over_turns_an_oversized_profile_into_an_exit_code() {
    let Some((ts, _)) = parity::case("budget-context-fail-over")
        .fixture("budget-context")
        .args(&["budget", "context", "--fail-over", "100"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stdout.contains("Over --fail-over 100:"),
        "{}",
        ts.describe()
    );

    let Some((ts, _)) = parity::case("budget-context-under-fail-over")
        .fixture("budget-context")
        .args(&["budget", "context", "--fail-over", "10000"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
}

/// The threshold is validated by the DISPATCHER, before the command reads
/// anything — so a bad one is exit 2 even with no manifest to report on.
#[test]
#[ignore = "needs node and the TS build"]
fn a_non_numeric_threshold_is_an_invocation_error() {
    let Some((ts, _)) = parity::case("budget-context-fail-over-invalid")
        .args(&["budget", "context", "--fail-over", "abc"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 2, "{}", ts.describe());
    assert!(
        ts.stderr
            .contains("Invalid --fail-over value: abc (expected a number)"),
        "{}",
        ts.describe()
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_project_without_a_pack_manifest_is_told_to_upgrade() {
    let Some((ts, _)) = parity::case("budget-context-no-manifest")
        .args(&["budget", "context"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stderr.contains("run `mewkit upgrade` first."),
        "{}",
        ts.describe()
    );
}

/// A corrupt manifest reaches the top-level catch, which is one `Fatal:` line
/// and exit 1 — not a stack trace and not a partial report.
#[test]
#[ignore = "needs node and the TS build"]
fn a_corrupt_manifest_is_one_fatal_line() {
    let Some((ts, _)) = parity::case("budget-context-corrupt-manifest")
        .fixture("budget-corrupt-manifest")
        .args(&["budget", "context"])
        .redact(
            r"is not valid JSON: .*",
            "is not valid JSON: <parser message>",
            OWN_JSON_ERROR,
        )
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(ts.stdout.is_empty(), "{}", ts.describe());
}
