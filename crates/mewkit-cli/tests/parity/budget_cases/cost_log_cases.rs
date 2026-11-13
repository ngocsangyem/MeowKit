//! Selecting and totalling cost-log entries: the table, the two filters and
//! the live session accumulator that replaces both.
use crate::parity;

#[test]
#[ignore = "needs node and the TS build"]
fn the_table_totals_every_generation_of_entry() {
    let Some((ts, _)) = parity::case("budget-table")
        .fixture("budget-log")
        .args(&["budget"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    // A legacy count, a summed session entry and a numeric string in one total.
    assert!(
        ts.stdout.contains("Total estimated tokens: 27,550"),
        "{}",
        ts.describe()
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn the_monthly_aggregate_groups_without_grouping_separators() {
    let Some((ts, _)) = parity::case("budget-monthly")
        .fixture("budget-log")
        .args(&["budget", "--monthly"])
        .run()
    else {
        return;
    };
    assert!(ts.stdout.contains("2026-11"), "{}", ts.describe());
}

/// Over ten entries the table shows the LAST ten and says so.
#[test]
#[ignore = "needs node and the TS build"]
fn a_long_log_is_windowed_to_the_last_ten() {
    let Some((ts, _)) = parity::case("budget-window")
        .fixture("budget-many-entries")
        .args(&["budget"])
        .run()
    else {
        return;
    };
    assert!(
        ts.stdout.contains("Showing last 10 of 12 entries"),
        "{}",
        ts.describe()
    );
    assert!(!ts.stdout.contains("bead 01"), "{}", ts.describe());
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_day_filter_selects_that_calendar_day() {
    parity::case("budget-day")
        .fixture("budget-log")
        .args(&["budget", "--day", "2026-11-12"])
        .run();
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_malformed_day_is_refused_before_anything_is_read() {
    let Some((ts, _)) = parity::case("budget-day-invalid")
        .fixture("budget-log")
        .args(&["budget", "--day", "bogus"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stderr
            .contains("Invalid --day value: bogus (expected YYYY-MM-DD)"),
        "{}",
        ts.describe()
    );
}

/// `--day` with no value means TODAY, which each CLI reads from its own clock.
#[test]
#[ignore = "needs node and the TS build"]
fn a_bare_day_flag_defaults_to_today() {
    let Some((ts, _)) = parity::case("budget-day-today")
        .fixture("budget-log")
        .args(&["budget", "--day"])
        .redact(
            r"\d{4}-\d{2}-\d{2}",
            "<today>",
            "today's calendar date comes from each CLI's own clock",
        )
        .run()
    else {
        return;
    };
    assert!(
        ts.stdout
            .contains("No cost entries matched the selected filters."),
        "{}",
        ts.describe()
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_session_filter_with_no_session_to_resolve_is_refused() {
    let Some((ts, _)) = parity::case("budget-session-unresolved")
        .fixture("budget-log")
        .args(&["budget", "--session"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stderr
            .contains("Could not determine the current session id."),
        "{}",
        ts.describe()
    );
}

/// The hook's variable outranks the durable marker, so a running session
/// reports itself even before the marker is written.
#[test]
#[ignore = "needs node and the TS build"]
fn the_hook_variable_decides_the_current_session() {
    let Some((ts, _)) = parity::case("budget-session-from-env")
        .fixture("budget-log")
        .args(&["budget", "--session"])
        .env("HOOK_SESSION_ID", "sess-beta")
        .run()
    else {
        return;
    };
    assert!(
        ts.stdout.contains("Session: sess-beta"),
        "{}",
        ts.describe()
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn the_session_marker_filters_the_log() {
    parity::case("budget-session-marker")
        .fixture("budget-session")
        .args(&["budget", "--session"])
        .run();

    let Some((ts, _)) = parity::case("budget-session-unmatched")
        .fixture("budget-session")
        .args(&["budget", "--session", "sess-nothing"])
        .run()
    else {
        return;
    };
    assert!(
        ts.stdout
            .contains("No cost entries matched the selected filters."),
        "{}",
        ts.describe()
    );
}
