//! Unit tests for `portability` — the portability rules.
use super::*;

#[test]
fn an_unsupported_surface_is_not_applicable_rather_than_green() {
    assert_eq!(
        diagnostic_to_status("unsupported", Severity::Pass),
        Status::Na
    );
    // The bug this pins: a warn-severity diagnostic used to render PASS.
    assert_eq!(
        diagnostic_to_status("partial", Severity::Warn),
        Status::Warn
    );
}

#[test]
fn a_documented_but_unconfigured_surface_warns() {
    assert_eq!(classify_surface("documented", true, false), Severity::Warn);
    assert_eq!(classify_surface("documented", true, true), Severity::Pass);
    assert_eq!(classify_surface("partial", false, true), Severity::Fail);
    assert_eq!(classify_surface("partial", true, false), Severity::Warn);
    assert_eq!(
        classify_surface("unsupported", false, false),
        Severity::Pass
    );
}

#[test]
fn every_provider_and_surface_produces_one_row_plus_the_summary() {
    let rows = check_portability();
    assert_eq!(rows.len(), 3 * 6 + 1);
    assert!(
        rows.last()
            .expect("the summary row")
            .detail
            .ends_with("across 18 surface(s)."),
        "{:?}",
        rows.last()
    );
}

#[test]
fn the_cursor_rows_are_the_ones_that_are_not_all_green() {
    let rows = check_portability();
    let cursor: Vec<&CheckResult> = rows
        .iter()
        .filter(|row| row.name.contains("Cursor/"))
        .collect();
    // Exactly one WARN: the `partial` agents surface. The `unsupported`
    // skills surface is a WARN severity but renders N/A, because the host
    // not having the surface is not a defect in this project.
    assert_eq!(
        cursor
            .iter()
            .filter(|row| row.status == Status::Warn)
            .count(),
        1,
        "{cursor:#?}"
    );
    assert_eq!(
        cursor.iter().filter(|row| row.status == Status::Na).count(),
        3,
        "{cursor:#?}"
    );
}
