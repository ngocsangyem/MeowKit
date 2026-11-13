//! Severity is the contract here: a WARN keeps a legacy plan validating, an
//! ERROR says the plan lies about its own state.
use super::*;

/// A phase file with every required section, so a test can remove exactly one
/// thing and see exactly one issue.
fn complete_phase() -> String {
    let sections: String = REQUIRED_PHASE_SECTIONS
        .iter()
        .map(|s| {
            if *s == "## Todo List" {
                format!("{s}\n\n- [ ] something\n\n")
            } else {
                format!("{s}\n\nx\n\n")
            }
        })
        .collect();
    format!(
        "---\nphase: 1\ntitle: Setup\nstatus: pending\npriority: high\neffort: S\ndependencies: []\n---\n\n{sections}"
    )
}

#[test]
fn a_complete_phase_file_has_nothing_to_report() {
    assert_eq!(
        check_phase_file(&complete_phase(), "phase-01-setup.md"),
        Vec::<String>::new()
    );
}

#[test]
fn a_missing_section_is_named() {
    let content = complete_phase().replace("## Architecture", "## Layout");
    let issues = check_phase_file(&content, "phase-01-setup.md");
    assert_eq!(
        issues,
        vec!["phase-01-setup.md: Missing section: ## Architecture"]
    );
}

#[test]
fn absent_frontmatter_warns_so_a_legacy_plan_keeps_validating() {
    let content = complete_phase()
        .split_once("---\n\n")
        .map(|(_, rest)| rest.to_string())
        .expect("a frontmatter block to drop");
    let issues = check_phase_file(&content, "phase-01-setup.md");
    assert!(issues.iter().all(|i| i.starts_with("WARN ")), "{issues:?}");
}

#[test]
fn the_sentinel_status_is_an_error_not_a_warning() {
    let content = complete_phase().replace("status: pending", "status: unknown");
    let issues = check_phase_file(&content, "phase-01-setup.md");
    assert!(
        issues
            .iter()
            .any(|i| i == "ERROR phase-01-setup.md: 'status: unknown' is reserved as parser sentinel — never write"),
        "{issues:?}"
    );
}

#[test]
fn an_unknown_status_lists_the_allowed_ones() {
    let content = complete_phase().replace("status: pending", "status: nearly");
    let issues = check_phase_file(&content, "phase-01-setup.md");
    assert!(
        issues.iter().any(|i| i
            == "ERROR phase-01-setup.md: invalid status 'nearly'; allowed: \
                ['abandoned', 'active', 'completed', 'failed', 'in_progress', 'pending']"),
        "{issues:?}"
    );
}

#[test]
fn a_phase_number_that_disagrees_with_its_filename_is_an_error() {
    let issues = check_phase_file(&complete_phase(), "phase-02-setup.md");
    assert!(
        issues
            .iter()
            .any(|i| i == "ERROR phase-02-setup.md: frontmatter phase=1 != filename phase=2"),
        "{issues:?}"
    );
}

#[test]
fn a_non_integer_phase_is_an_error() {
    let content = complete_phase().replace("phase: 1", "phase: one");
    let issues = check_phase_file(&content, "phase-01-setup.md");
    assert!(
        issues
            .iter()
            .any(|i| i == "ERROR phase-01-setup.md: frontmatter 'phase' is not an integer"),
        "{issues:?}"
    );
}

#[test]
fn completed_with_unchecked_todos_is_drift() {
    let content = complete_phase().replace("status: pending", "status: completed");
    let issues = check_phase_file(&content, "phase-01-setup.md");
    assert!(
        issues
            .iter()
            .any(|i| i
                == "ERROR phase-01-setup.md: status=completed but 1/1 todos unchecked (drift)"),
        "{issues:?}"
    );
}

#[test]
fn completed_with_every_box_ticked_is_silent() {
    let content = complete_phase()
        .replace("status: pending", "status: completed")
        .replace("- [ ] something", "- [x] something");
    assert_eq!(
        check_phase_file(&content, "phase-01-setup.md"),
        Vec::<String>::new()
    );
}

#[test]
fn an_empty_todo_list_is_reported() {
    let content = complete_phase().replace("- [ ] something", "nothing yet");
    let issues = check_phase_file(&content, "phase-01-setup.md");
    assert!(
        issues
            .iter()
            .any(|i| i == "phase-01-setup.md: Todo List has no checkboxes"),
        "{issues:?}"
    );
}

#[test]
fn blocked_on_must_be_a_list_of_strings() {
    let content =
        complete_phase().replace("dependencies: []", "dependencies: []\nblocked_on: nope");
    let issues = check_phase_file(&content, "phase-01-setup.md");
    assert!(
        issues
            .iter()
            .any(|i| i
                == "WARN phase-01-setup.md: frontmatter 'blocked_on' should be a list of strings"),
        "{issues:?}"
    );
}

#[test]
fn a_section_body_stops_at_the_next_heading() {
    let content = "## Goal\n\nthe outcome\n\n## Next\n\nmore\n";
    assert_eq!(section_body(content, "## Goal"), Some("\nthe outcome\n"));
    // A `###` is not a new `##` section, so the body keeps reading.
    let nested = "## Goal\n\nthe outcome\n\n### Detail\n\nmore\n";
    assert!(section_body(nested, "## Goal").is_some_and(|b| b.contains("Detail")));
}

#[test]
fn checkboxes_are_counted_only_inside_the_todo_list() {
    let content = "## Overview\n\n- [x] not a todo\n\n## Todo List\n\n- [x] a\n- [ ] b\n";
    assert_eq!(count_checkboxes(content), (2, 1));
}
