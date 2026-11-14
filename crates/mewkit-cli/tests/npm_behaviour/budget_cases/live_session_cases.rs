//! The live session accumulator: the budget hook's running total for the
//! session in progress, which REPLACES the table when the run is that session.
//!
//! It is reported from `budget-state.json`, the same file the hook writes, so
//! the CLI and the hook can never disagree about what a session has cost.
use crate::npm;

/// The live accumulator wins for the current session, and its USD amount is a
/// rounding TIE — the spelling that separates `toFixed` from a half-to-even
/// formatter.
#[test]
fn the_live_session_summary_replaces_the_table() {
    let (ts, _) = npm::case("budget-live-session")
        .fixture("budget-live")
        .args(&["budget", "--session"])
        .run();
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
fn todays_day_filter_labels_the_live_summary() {
    let (ts, _) = npm::case("budget-live-today")
        .fixture("budget-live")
        .args(&["budget", "--session", "--day"])
        .run();
    assert!(
        ts.stdout.contains("live session accumulator"),
        "{}",
        ts.describe()
    );
}

/// A day filter for a PAST day falls back to the log: the live accumulator
/// only describes today.
#[test]
fn a_past_day_bypasses_the_live_accumulator() {
    let (ts, _) = npm::case("budget-live-past-day")
        .fixture("budget-live")
        .args(&["budget", "--session", "--day", "2026-11-12"])
        .run();
    assert!(
        !ts.stdout.contains("live session accumulator"),
        "{}",
        ts.describe()
    );
}
