//! The hand-written frontmatter reader's quirks, pinned.
//!
//! They ARE the contract: the npm CLI reads plans this way, and a port that
//! "fixed" one of them would report a different title, status or box count for
//! a plan a human already approved.
use super::*;

fn phase(content: &str) -> PhaseFile {
    let dir = tempfile::tempdir().expect("temp dir");
    let path = dir.path().join("phase-01-x.md");
    std::fs::write(&path, content).expect("write phase");
    parse_phase_file(&path).expect("parse phase")
}

#[test]
fn quotes_around_a_scalar_are_stripped() {
    let parsed = phase("---\ntitle: \"Setup\"\nstatus: 'pending'\n---\n");
    assert_eq!(parsed.title.as_deref(), Some("Setup"));
    assert_eq!(parsed.status.as_deref(), Some("pending"));
}

#[test]
fn an_empty_scalar_reads_as_absent_rather_than_as_an_empty_string() {
    let parsed = phase("---\ntitle:\nstatus: pending\n---\n");
    assert_eq!(parsed.title, None);
}

#[test]
fn a_crlf_frontmatter_is_read_without_its_carriage_returns() {
    let parsed = phase("---\r\ntitle: Setup\r\nstatus: pending\r\n---\r\n");
    assert_eq!(parsed.title.as_deref(), Some("Setup"));
    assert_eq!(parsed.status.as_deref(), Some("pending"));
}

#[test]
fn an_unterminated_frontmatter_yields_no_fields() {
    let parsed = phase("---\ntitle: Setup\n");
    assert_eq!(parsed.title, None);
}

#[test]
fn an_inline_dependency_array_is_split_and_unquoted() {
    let parsed = phase("---\ndependencies: [\"one\", two , '' ]\n---\n");
    assert_eq!(parsed.dependencies, vec!["one", "two"]);
    assert!(
        phase("---\ndependencies: []\n---\n")
            .dependencies
            .is_empty()
    );
}

#[test]
fn boxes_are_counted_wherever_they_appear_and_either_case_counts_as_checked() {
    let parsed = phase("- [ ] a\n  * [x] b\n- [X] c\nnot [x] a box\n");
    assert_eq!(parsed.checklist.total, 3);
    assert_eq!(parsed.checklist.checked, 2);
}

/// `^\s*` can span blank lines, which is how the JavaScript reads it. The thing
/// that must NOT happen is a box being skipped because of it.
#[test]
fn blank_lines_between_boxes_do_not_hide_them() {
    let parsed = phase("intro\n\n- [ ] a\n\n\n- [x] b\n");
    assert_eq!(
        parsed.checklist,
        PhaseChecklist {
            total: 2,
            checked: 1
        }
    );
}

#[test]
fn a_required_section_matches_a_heading_that_merely_contains_it() {
    let parsed = phase("## Success Criteria (Phase 2)\n## Overview\n");
    assert!(
        !parsed
            .missing_sections
            .contains(&"Success Criteria".to_string())
    );
    assert!(
        parsed
            .missing_sections
            .contains(&"Risk Assessment".to_string())
    );
}

#[test]
fn headings_are_trimmed_so_a_crlf_file_reports_the_same_names() {
    let parsed = phase("## Overview\r\n## Requirements\r\n");
    assert_eq!(parsed.sections, vec!["Overview", "Requirements"]);
}

#[test]
fn an_over_long_overview_is_an_observation_not_a_failure() {
    let dir = tempfile::tempdir().expect("temp dir");
    let plan = dir.path().join("plan.md");
    let body = format!("---\ntitle: T\n---\n{}", "line\n".repeat(90));
    std::fs::write(&plan, body).expect("write plan");
    let summary = parse_plan(dir.path()).expect("parse plan");
    assert!(
        summary
            .issues
            .iter()
            .any(|i| i.contains("overview should stay under 80")),
        "{:?}",
        summary.issues
    );
}

#[test]
fn phase_files_are_listed_in_filename_order_and_nothing_else_is() {
    let dir = tempfile::tempdir().expect("temp dir");
    for name in [
        "phase-02-b.md",
        "phase-01-a.md",
        "plan.md",
        "phase-notes.md",
        "phase-03.txt",
    ] {
        std::fs::write(dir.path().join(name), "x").expect("write file");
    }
    let listed: Vec<String> = list_phase_files(dir.path())
        .iter()
        .map(|p| p.file_name().unwrap().to_string_lossy().into_owned())
        .collect();
    assert_eq!(listed, vec!["phase-01-a.md", "phase-02-b.md"]);
}

#[test]
fn an_absent_plan_directory_summarises_what_is_missing() {
    let dir = tempfile::tempdir().expect("temp dir");
    let summary = parse_plan(&dir.path().join("not-here")).expect("summarise");
    assert!(!summary.plan_md_present);
    assert_eq!(
        summary.issues,
        vec![
            "no plan.md — Gate 1 expects one at the plan root",
            "no phase-XX-*.md files found"
        ]
    );
}

/// The aggregate counts PHASE boxes only: the overview's own checklist is not
/// progress on the work.
#[test]
fn the_aggregate_covers_the_phase_files_only() {
    let dir = tempfile::tempdir().expect("temp dir");
    std::fs::write(dir.path().join("plan.md"), "- [x] overview box\n").expect("write plan");
    std::fs::write(dir.path().join("phase-01-a.md"), "- [x] one\n- [ ] two\n")
        .expect("write phase");
    let summary = parse_plan(dir.path()).expect("parse plan");
    assert_eq!(
        summary.checklist,
        PhaseChecklist {
            total: 2,
            checked: 1
        }
    );
}
