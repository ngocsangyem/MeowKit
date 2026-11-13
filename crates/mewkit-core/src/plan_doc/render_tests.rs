//! The progress block's arithmetic and padding. A bar that rounds differently
//! is a visible difference on every Gate 1 presentation.
use super::*;
use crate::plan_doc::parser::{PhaseChecklist, PhaseFile, PlanSummary};

fn list(c: usize, t: usize) -> PhaseChecklist {
    PhaseChecklist {
        checked: c,
        total: t,
    }
}

fn summary(phases: Vec<PhaseFile>, issues: Vec<String>) -> PlanSummary {
    let checklist = phases.iter().fold(list(0, 0), |acc, p| {
        list(
            acc.checked + p.checklist.checked,
            acc.total + p.checklist.total,
        )
    });
    PlanSummary {
        dir: "/tmp/plans/261112-x".to_string(),
        title: Some("A plan".to_string()),
        status: Some("in_progress".to_string()),
        plan_md_present: true,
        plan_md_lines: 20,
        phases,
        checklist,
        issues,
    }
}

fn phase(title: Option<&str>, status: Option<&str>, c: usize, t: usize) -> PhaseFile {
    PhaseFile {
        file: "phase-01-a.md".to_string(),
        title: title.map(str::to_string),
        status: status.map(str::to_string),
        phase: Some("1".to_string()),
        dependencies: Vec::new(),
        sections: Vec::new(),
        missing_sections: Vec::new(),
        checklist: list(c, t),
    }
}

#[test]
fn a_full_bar_fills_every_cell_and_an_empty_one_fills_none() {
    assert_eq!(bar(&list(2, 2), 4), "████");
    assert_eq!(bar(&list(0, 2), 4), "░░░░");
}

/// Nothing to divide prints a dash rather than `0%`: `0%` would claim the plan
/// has work recorded and none of it done.
#[test]
fn no_boxes_at_all_is_a_dash_and_a_rule() {
    assert_eq!(pct(&list(0, 0)), "—");
    assert_eq!(bar(&list(0, 0), 3), "───");
}

#[test]
fn a_half_cell_rounds_up_the_way_math_round_does() {
    // 1/8 of 14 cells is 1.75 → 2; 3/8 is 5.25 → 5.
    assert_eq!(bar(&list(1, 8), 14).matches('█').count(), 2);
    assert_eq!(bar(&list(3, 8), 14).matches('█').count(), 5);
    assert_eq!(pct(&list(1, 3)), "33%");
    assert_eq!(pct(&list(2, 3)), "67%");
}

#[test]
fn the_phase_line_pads_the_percentage_and_the_ratio_to_fixed_widths() {
    let text = render_status(&summary(
        vec![phase(Some("Setup"), Some("pending"), 1, 2)],
        vec![],
    ));
    assert!(
        text.contains("  50%    1/2  Setup"),
        "the columns moved: {text}"
    );
    assert!(text.contains("      phase-01-a.md · pending"), "{text}");
}

#[test]
fn a_phase_without_a_title_falls_back_to_its_filename() {
    let text = render_status(&summary(vec![phase(None, None, 0, 0)], vec![]));
    assert!(text.contains("  phase-01-a.md"), "{text}");
    assert!(text.contains("· (no status)"), "{text}");
}

#[test]
fn observations_are_numbered_and_bulleted() {
    let text = render_status(&summary(
        vec![phase(Some("Setup"), Some("pending"), 0, 1)],
        vec!["one thing".to_string(), "another".to_string()],
    ));
    assert!(text.contains("  Observations (2)"), "{text}");
    assert!(text.contains("    • one thing\n    • another"), "{text}");
}

#[test]
fn a_plan_with_no_phases_prints_no_phase_block() {
    let text = render_status(&summary(vec![], vec![]));
    assert!(!text.contains("Phases"), "{text}");
    assert!(text.contains("  Overall  "), "{text}");
}

#[test]
fn the_check_report_omits_the_dependency_line_when_there_are_none() {
    let mut subject = phase(Some("Setup"), Some("pending"), 1, 2);
    subject.missing_sections = vec!["Risk Assessment".to_string()];
    let text = render_check(&subject, "/tmp/phase-01-a.md");
    assert!(!text.contains("deps:"), "{text}");
    assert!(text.contains("    ✗ Risk Assessment"), "{text}");
    assert!(text.contains("  Missing: Risk Assessment"), "{text}");

    subject.dependencies = vec!["one".to_string(), "two".to_string()];
    assert!(render_check(&subject, "/tmp/phase-01-a.md").contains("  deps:   one, two"),);
}
