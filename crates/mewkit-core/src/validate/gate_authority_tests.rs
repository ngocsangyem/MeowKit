//! Which prose grants automated gate authority, and which only describes it.
//!
//! The negative cases matter as much as the positive ones: the contract and its
//! gotcha lists have to be able to NAME the thing they forbid, and a lint that
//! flags its own contract gets switched off.
use std::fs;

use super::super::gate_authority_rows::check_gate_authority;
use super::super::result::Status;
use super::{lookbehind, scan_for_gate_authority};

fn with_prose(body: &str) -> tempfile::TempDir {
    let dir = tempfile::tempdir().expect("a temp dir");
    let rules = dir.path().join(".claude").join("rules");
    fs::create_dir_all(&rules).expect("create the rules dir");
    fs::write(rules.join("gate-rules.md"), body).expect("write the prose");
    dir
}

fn violations_of(body: &str) -> Vec<String> {
    let dir = with_prose(body);
    scan_for_gate_authority(dir.path(), ".claude/rules/gate-rules.md")
        .into_iter()
        .map(|v| v.found)
        .collect()
}

#[test]
fn the_negation_window_counts_characters_not_bytes() {
    // Every em dash is three bytes and one unit of JavaScript's `slice`, so a
    // byte-counted window would be shorter than the npm CLI's and would stop
    // seeing a negation this one still sees.
    let prose = format!("never {}approves", "— ".repeat(10));
    assert!(
        prose.chars().count() < 48 && prose.len() > 48,
        "the prose must be short in characters and long in bytes to mean anything"
    );
    let window = lookbehind(&prose, prose.len());
    assert!(
        window.starts_with("never"),
        "the window dropped the negation: {window:?}"
    );
    // And the window still ENDS at the match, 48 characters at most.
    let long = format!("never {}approves", "— ".repeat(40));
    assert_eq!(lookbehind(&long, long.len()).chars().count(), 48);
}

#[test]
fn an_asserted_auto_approval_is_flagged_in_either_word_order() {
    assert_eq!(violations_of("Fast mode auto-approves Gate 2.\n").len(), 1);
    assert_eq!(
        violations_of("Gate 1 is then auto-approved by the runner.\n").len(),
        1
    );
}

#[test]
fn a_bare_gate_metaphor_without_a_digit_is_not_a_violation() {
    assert!(violations_of("The quality gate stays manual.\n").is_empty());
}

#[test]
fn stating_the_contract_is_not_breaking_it() {
    assert!(violations_of("Gate 2 is never auto-approved.\n").is_empty());
    assert!(
        violations_of("No mode auto-approves Gate 1; a human approval is required.\n").is_empty()
    );
}

#[test]
fn a_negated_clause_does_not_excuse_an_asserted_one() {
    // The whole reason the line is split into clauses before matching.
    let found = violations_of(
        "Gate 2 is never auto-approved, but fast mode auto-approves Gate 2 when tests pass.\n",
    );
    assert_eq!(found.len(), 1, "{found:?}");
}

#[test]
fn a_marker_suppresses_its_own_line_and_the_line_below_when_standalone() {
    assert!(
        violations_of("Fast mode auto-approves Gate 2. <!-- lint-allow-gate-authority -->\n")
            .is_empty()
    );
    assert!(
        violations_of("<!-- lint-allow-gate-authority -->\nFast mode auto-approves Gate 2.\n")
            .is_empty()
    );
    // An INLINE marker must not leak onto the next line.
    assert_eq!(
        violations_of("ok <!-- lint-allow-gate-authority -->\nFast mode auto-approves Gate 2.\n")
            .len(),
        1
    );
}

#[test]
fn one_finding_per_line_however_many_patterns_it_trips() {
    let found = violations_of("Gate 2: auto, and the stamp counts, so it auto-approves Gate 2.\n");
    assert_eq!(found.len(), 1, "{found:?}");
}

#[test]
fn a_supervision_disposition_claiming_to_clear_a_gate_is_flagged() {
    assert_eq!(
        violations_of("A READY_FOR_EXISTING_GATE disposition clears Gate 2.\n").len(),
        1
    );
    assert!(
        violations_of("A READY_FOR_EXISTING_GATE disposition never clears Gate 2.\n").is_empty()
    );
}

#[test]
fn an_absent_scan_target_is_reported_at_the_severity_the_caller_asked_for() {
    let dir = tempfile::tempdir().expect("a temp dir");
    let strict = check_gate_authority(dir.path(), &[".claude"], Status::Fail);
    assert_eq!(strict[0].status, Status::Fail);
    assert_eq!(strict[0].name, "Gate-authority scan target");
    let lenient = check_gate_authority(dir.path(), &[".claude"], Status::Warn);
    assert_eq!(lenient[0].status, Status::Warn);
}

#[test]
fn a_clean_tree_reports_the_number_of_files_it_read() {
    let dir = with_prose("Gate 2 is approved by a human, in every mode.\n");
    let rows = check_gate_authority(dir.path(), &[".claude"], Status::Fail);
    assert_eq!(rows[0].status, Status::Pass);
    assert_eq!(rows[0].detail, "1 prose files scanned across .claude");
}

#[test]
fn a_violation_fails_the_section_and_locates_the_line() {
    let dir = with_prose("# Gates\n\nFast mode auto-approves Gate 2.\n");
    let rows = check_gate_authority(dir.path(), &[".claude"], Status::Fail);
    assert_eq!(rows[0].status, Status::Fail);
    assert_eq!(rows[0].name, "Automated gate-approval claims (1)");
    assert!(
        rows[0]
            .detail
            .starts_with(".claude/rules/gate-rules.md:3 found "),
        "{}",
        rows[0].detail
    );
}
