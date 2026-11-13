//! What the report looks like, and what it exits with.
use super::super::result::{CheckResult, Section, Status};
use super::{exit_code, render_results};

fn row(name: &str, status: Status, section: Section) -> CheckResult {
    CheckResult::new(name, status, format!("why {name}"), section)
}

#[test]
fn sections_print_in_order_and_skip_the_empty_ones() {
    let results = vec![
        row("memory", Status::Pass, Section::Memory),
        row("structure", Status::Pass, Section::Structure),
    ];
    let text = render_results(&results);
    assert_eq!(
        text,
        "Structure\n  [PASS] structure\n\nMemory\n  [PASS] memory\n\n2 passed\n"
    );
}

#[test]
fn only_a_non_pass_row_prints_its_detail() {
    let results = vec![
        row("clean", Status::Pass, Section::Docs),
        row("broken", Status::Fail, Section::Docs),
    ];
    assert_eq!(
        render_results(&results),
        "Docs\n  [PASS] clean\n  [FAIL] broken\n         why broken\n\n1 passed, 1 failed\n"
    );
}

#[test]
fn the_summary_omits_every_zero_count() {
    let results = vec![
        row("a", Status::Pass, Section::Hooks),
        row("b", Status::Warn, Section::Hooks),
        row("c", Status::Na, Section::Hooks),
    ];
    assert!(render_results(&results).ends_with("1 passed, 1 warnings, 1 n/a\n"));
}

#[test]
fn a_warning_fails_the_build_only_under_strict() {
    let warned = vec![row("w", Status::Warn, Section::Rules)];
    assert_eq!(exit_code(&warned, false), 0);
    assert_eq!(exit_code(&warned, true), 1);
}

#[test]
fn not_applicable_never_fails_the_build() {
    let na = vec![row("n", Status::Na, Section::Docs)];
    assert_eq!(exit_code(&na, true), 0);
}

#[test]
fn a_failure_fails_the_build_in_either_mode() {
    let failed = vec![row("f", Status::Fail, Section::Gates)];
    assert_eq!(exit_code(&failed, false), 1);
    assert_eq!(exit_code(&failed, true), 1);
}
