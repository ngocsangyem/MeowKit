//! What `budget` says when there is nothing to report — an absent log, an
//! empty one, a corrupt one — and the two invocations it refuses outright.
use crate::parity;

use super::{OWN_HELP, OWN_JSON_ERROR};

/// The refusal names the path the SEARCH used, so a reader is not sent to a
/// file nothing ever reads.
#[test]
#[ignore = "needs node and the TS build"]
fn a_project_with_no_cost_log_is_told_where_it_looked() {
    let Some((ts, _)) = parity::case("budget-no-log").args(&["budget"]).run() else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stderr
            .contains(".meowkit/telemetry/cost-log.json and in each parent directory."),
        "{}",
        ts.describe()
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn an_empty_log_is_reported_rather_than_tabulated() {
    let Some((ts, _)) = parity::case("budget-empty-log")
        .fixture("budget-empty-log")
        .args(&["budget"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(
        ts.stdout.contains("No cost entries recorded yet."),
        "{}",
        ts.describe()
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_log_that_is_not_an_array_is_refused_by_shape() {
    let Some((ts, _)) = parity::case("budget-not-an-array")
        .fixture("budget-not-an-array")
        .args(&["budget"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stderr
            .contains("Failed to read cost log: cost-log.json must contain an array"),
        "{}",
        ts.describe()
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn an_unparseable_log_fails_without_reporting_a_total() {
    let Some((ts, _)) = parity::case("budget-malformed-log")
        .fixture("budget-malformed-log")
        .args(&["budget"])
        .redact(
            r"Failed to read cost log: .*",
            "Failed to read cost log: <parser message>",
            OWN_JSON_ERROR,
        )
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(!ts.stdout.contains("Total estimated"), "{}", ts.describe());
}

/// A mistyped sub-verb is an INVOCATION error, judged before the verb runs —
/// never a silent fall-through to the cost-log report nobody asked for.
#[test]
#[ignore = "needs node and the TS build"]
fn an_unknown_subcommand_is_an_invocation_error() {
    let Some((ts, _)) = parity::case("budget-unknown-subcommand")
        .fixture("budget-log")
        .args(&["budget", "nonsense"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 2, "{}", ts.describe());
    assert!(
        ts.stderr.contains("Unknown `budget` subcommand: nonsense"),
        "{}",
        ts.describe()
    );
    assert!(
        ts.stderr.contains("Valid subcommands: context"),
        "{}",
        ts.describe()
    );
    assert!(!ts.stdout.contains("Token Budget"), "{}", ts.describe());
}

#[test]
#[ignore = "needs node and the TS build"]
fn asking_for_help_never_runs_the_verb() {
    let Some((ts, rust)) = parity::case("budget-help")
        .fixture("budget-log")
        .args(&["budget", "--help"])
        .ignore_stdout(OWN_HELP)
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    // stdout is each CLI's own help, so the point of the case — that the
    // report did NOT run — is asserted on each side separately.
    for run in [&ts, &rust] {
        assert!(!run.stdout.contains("Token Budget"), "{}", run.describe());
    }
}
