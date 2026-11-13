//! The plan-level half of the Gate 1 structure check, and the verdict line
//! callers match on.
use super::*;

/// A phase file with every required section and the lightest possible
/// frontmatter, so what it earns is warnings and nothing else.
fn section_complete_phase() -> String {
    let sections: String = crate::plan_doc::phase_structure::REQUIRED_PHASE_SECTIONS
        .iter()
        .map(|s| {
            if *s == "## Todo List" {
                format!("{s}\n\n- [ ] something\n\n")
            } else {
                format!("{s}\n\nx\n\n")
            }
        })
        .collect();
    format!("---\nphase: 1\n---\n\n{sections}")
}

/// A plan.md that passes every plan-level rule, so a test can break one thing.
const PLAN: &str = "---\ntitle: T\ntype: feature\nstatus: in_progress\npriority: high\n---\n\n\
                    ## Goal\n\nThe outcome happens.\n";

fn plan_dir(files: &[(&str, &str)]) -> tempfile::TempDir {
    let dir = tempfile::tempdir().expect("temp dir");
    for (name, content) in files {
        std::fs::write(dir.path().join(name), content).expect("write a plan file");
    }
    dir
}

#[test]
fn a_complete_plan_with_no_phase_files_is_complete() {
    let dir = plan_dir(&[("plan.md", PLAN)]);
    let report = check_plan_structure(dir.path());
    assert!(report.complete, "{:?}", report.issues);
    assert_eq!(
        render_plan_structure(&report),
        vec!["PLAN_COMPLETE (0 phase files validated)"]
    );
}

/// The marker is what callers match on, so the singular/plural and the warning
/// suffix are part of it.
#[test]
fn the_complete_marker_counts_phase_files_and_names_warnings() {
    let dir = plan_dir(&[
        ("plan.md", &format!("{PLAN}\n- phase-01-a.md\n")),
        ("phase-01-a.md", &section_complete_phase()),
    ]);
    let report = check_plan_structure(dir.path());
    let lines = render_plan_structure(&report);
    assert!(
        lines[0].starts_with("PLAN_COMPLETE (1 phase file validated) (")
            && lines[0].ends_with(" warnings)"),
        "{lines:?}"
    );
    // Only warnings are listed under a complete verdict.
    assert!(
        lines[1..].iter().all(|l| l.starts_with("  - WARN ")),
        "{lines:?}"
    );
}

#[test]
fn a_plan_without_frontmatter_reports_the_block_not_each_field() {
    let dir = plan_dir(&[("plan.md", "## Goal\n\nThe outcome happens.\n")]);
    let report = check_plan_structure(dir.path());
    assert_eq!(report.issues, vec!["plan.md: Missing YAML frontmatter"]);
}

#[test]
fn a_plan_with_frontmatter_reports_each_absent_field() {
    let dir = plan_dir(&[("plan.md", "---\ntitle: T\n---\n\n## Goal\n\nIt happens.\n")]);
    let report = check_plan_structure(dir.path());
    assert_eq!(
        report.issues,
        vec![
            "plan.md: Missing frontmatter: type",
            "plan.md: Missing frontmatter: status",
            "plan.md: Missing frontmatter: priority",
        ]
    );
}

#[test]
fn a_goal_that_opens_with_an_activity_verb_is_rejected() {
    let dir = plan_dir(&[(
        "plan.md",
        &PLAN.replace("The outcome happens.", "Implement the thing"),
    )]);
    let report = check_plan_structure(dir.path());
    assert_eq!(
        report.issues,
        vec!["plan.md: Goal starts with activity verb 'implement' — rewrite as outcome"]
    );
}

#[test]
fn an_unknown_handoff_next_is_named_with_the_allowed_set() {
    let dir = plan_dir(&[(
        "plan.md",
        &PLAN.replace("priority: high", "priority: high\nhandoff:\n  next: deploy"),
    )]);
    let report = check_plan_structure(dir.path());
    assert_eq!(
        report.issues,
        vec![
            "plan.md: handoff.next 'deploy' not in \
             ['autobuild', 'cook', 'end', 'red-team', 'validate']"
        ]
    );
}

#[test]
fn a_handoff_block_with_a_valid_next_is_silent() {
    let dir = plan_dir(&[(
        "plan.md",
        &PLAN.replace("priority: high", "priority: high\nhandoff:\n  next: cook"),
    )]);
    assert!(check_plan_structure(dir.path()).complete);
}

/// A `next: null` is "not decided yet", which is not the same as a wrong value.
#[test]
fn an_explicitly_null_handoff_next_is_accepted() {
    let dir = plan_dir(&[(
        "plan.md",
        &PLAN.replace("priority: high", "priority: high\nhandoff:\n  next: null"),
    )]);
    assert!(check_plan_structure(dir.path()).complete);
}

#[test]
fn an_overview_past_the_line_limit_is_an_error() {
    let body = format!("{PLAN}{}", "filler\n".repeat(101));
    let dir = plan_dir(&[("plan.md", &body)]);
    let report = check_plan_structure(dir.path());
    assert!(
        report
            .issues
            .iter()
            .any(|i| i.contains("(max 80 recommended) — move detail to phase files")),
        "{:?}",
        report.issues
    );
}

/// A phase file nothing links to is invisible to a reader of the overview.
#[test]
fn an_unlinked_phase_file_is_reported_after_the_phase_issues() {
    let dir = plan_dir(&[("plan.md", PLAN), ("phase-01-a.md", "---\nphase: 1\n---\n")]);
    let report = check_plan_structure(dir.path());
    assert_eq!(
        report.issues.last().map(String::as_str),
        Some("plan.md: Phase file 'phase-01-a.md' exists but not linked in plan")
    );
}

#[test]
fn a_plan_md_path_and_its_directory_are_the_same_subject() {
    let dir = plan_dir(&[("plan.md", PLAN)]);
    assert_eq!(
        check_plan_structure(dir.path()),
        check_plan_structure(&dir.path().join("plan.md"))
    );
}

#[test]
fn an_absent_plan_is_one_error_and_an_incomplete_verdict() {
    let dir = tempfile::tempdir().expect("temp dir");
    let missing = dir.path().join("not-here");
    let report = check_plan_structure(&missing);
    assert_eq!(
        (report.error_count, report.warning_count, report.complete),
        (1, 0, false)
    );
    assert_eq!(
        render_plan_structure(&report)[0],
        "PLAN_INCOMPLETE: 1 error(s), 0 warning(s)"
    );
}

/// An unprefixed issue predates the severity prefixes and still counts as an
/// error, so an older caller's expectations do not change.
#[test]
fn an_unprefixed_issue_counts_as_an_error() {
    let dir = plan_dir(&[("plan.md", "## Goal\n\nIt happens.\n")]);
    let report = check_plan_structure(dir.path());
    assert_eq!((report.error_count, report.warning_count), (1, 0));
}
