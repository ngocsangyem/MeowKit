//! The live session accumulator: the budget hook's running total for the
//! session in progress, which REPLACES the table when the run is that session.
//!
//! It is reported from `budget-state.json`, the same file the hook writes, so
//! the CLI and the hook can never disagree about what a session has cost.
use crate::parity;

/// The live accumulator wins for the current session, and its USD amount is a
/// rounding TIE — the spelling that separates `toFixed` from a half-to-even
/// formatter.
#[test]
#[ignore = "needs node and the TS build"]
fn the_live_session_summary_replaces_the_table() {
    let Some((ts, _)) = parity::case("budget-live-session")
        .fixture("budget-live")
        .args(&["budget", "--session"])
        .run()
    else {
        return;
    };
    assert!(
        ts.stdout.contains("Mode: live session accumulator"),
        "{}",
        ts.describe()
    );
    assert!(
        ts.stdout.contains("Estimated cost: $1.13"),
        "{}",
        ts.describe()
    );
    assert!(
        ts.stdout.contains("Total tokens used: 205,550"),
        "{}",
        ts.describe()
    );
}

/// A day filter for TODAY keeps the live accumulator and labels it, so the
/// summary cannot be read as covering the whole log.
#[test]
#[ignore = "needs node and the TS build"]
fn todays_day_filter_labels_the_live_summary() {
    let Some((ts, _)) = parity::case("budget-live-today")
        .fixture("budget-live")
        .args(&["budget", "--session", "--day"])
        .redact(
            r"Day: \d{4}-\d{2}-\d{2}",
            "Day: <today>",
            "today's calendar date comes from each CLI's own clock",
        )
        .run()
    else {
        return;
    };
    assert!(
        ts.stdout.contains("live session accumulator"),
        "{}",
        ts.describe()
    );
}

/// A day filter for a PAST day falls back to the log: the live accumulator
/// only describes today.
#[test]
#[ignore = "needs node and the TS build"]
fn a_past_day_bypasses_the_live_accumulator() {
    let Some((ts, _)) = parity::case("budget-live-past-day")
        .fixture("budget-live")
        .args(&["budget", "--session", "--day", "2026-11-12"])
        .run()
    else {
        return;
    };
    assert!(
        !ts.stdout.contains("live session accumulator"),
        "{}",
        ts.describe()
    );
}
