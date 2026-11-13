use std::path::Path;

use crate::schema::review_session::EvidenceLevel;

use super::super::test_session::{Seed, seed_session};
use super::coverage;

fn run(root: &Path, session: &str) -> super::CoverageReport {
    coverage(root, session)
}

#[test]
fn a_session_without_an_impact_map_cannot_be_measured() {
    let project = tempfile::tempdir().expect("a temp dir");
    let report = run(project.path(), "ghost");
    assert!(!report.complete);
    assert_eq!(report.evidence_level, EvidenceLevel::Attested);
    assert_eq!(
        report.error.as_deref(),
        Some(
            format!(
                "no impact-map.json in {} (run 'mewkit review prepare' first)",
                ["tasks", "reviews", "ghost"].join(std::path::MAIN_SEPARATOR_STR)
            )
            .as_str()
        )
    );
}

#[test]
fn a_fully_read_and_hook_corroborated_session_is_approve_eligible() {
    let project = seed_session(&Seed {
        session: "s1",
        hook_corroborated: true,
        ..Seed::complete("s1")
    });
    let report = run(project.path(), "s1");
    assert!(report.complete && report.ok);
    assert_eq!(report.evidence_level, EvidenceLevel::SessionObserved);
    assert!(report.approve_eligible);
    assert!(report.gaps.is_empty());
}

#[test]
fn cli_receipts_without_hook_corroboration_stay_attested() {
    let project = seed_session(&Seed::complete("s2"));
    let report = run(project.path(), "s2");
    assert!(report.complete);
    assert_eq!(report.evidence_level, EvidenceLevel::Attested);
    assert!(
        !report.approve_eligible,
        "attested evidence must not be approve-eligible"
    );
}

#[test]
fn a_reviewer_that_never_ran_and_one_that_skipped_a_read_are_named() {
    let project = seed_session(&Seed {
        drop_reviewer: Some("security"),
        drop_target: Some(("tests", "diff.patch")),
        ..Seed::complete("s3")
    });
    let report = run(project.path(), "s3");
    assert!(!report.complete);
    let kinds: Vec<(&str, &str)> = report
        .gaps
        .iter()
        .map(|g| (g.kind.as_str(), g.reviewer.as_str()))
        .collect();
    assert!(kinds.contains(&("reviewer-never-launched", "security")));
    assert!(kinds.contains(&("diff-never-opened", "tests")));
}

#[test]
fn an_unread_brief_is_its_own_gap_kind() {
    let project = seed_session(&Seed {
        drop_target: Some(("correctness", "briefs/correctness.md")),
        ..Seed::complete("s4")
    });
    let report = run(project.path(), "s4");
    let gap = report
        .gaps
        .iter()
        .find(|g| g.reviewer == "correctness")
        .expect("the correctness gap");
    assert_eq!(gap.kind, "brief-never-read");
    assert_eq!(gap.target.as_deref(), Some("briefs/correctness.md"));
}

#[test]
fn the_roster_is_rebuilt_so_an_edited_roster_file_cannot_shrink_the_gate() {
    let project = seed_session(&Seed {
        drop_reviewer: Some("security"),
        ..Seed::complete("s5")
    });
    // Rewrite the persisted roster to claim only the reviewers that DID read.
    std::fs::write(
        project.path().join("tasks/reviews/s5/roster.json"),
        r#"{"tier":"small","entries":[]}"#,
    )
    .expect("overwrite the roster");
    let report = run(project.path(), "s5");
    assert!(
        !report.complete,
        "an edited roster.json was allowed to decide coverage"
    );
}

#[test]
fn the_report_serializes_in_the_npm_key_order() {
    let project = seed_session(&Seed::complete("s6"));
    let text = serde_json::to_string(&run(project.path(), "s6")).expect("serialize");
    assert!(
        text.starts_with(
            r#"{"ok":true,"session":"s6","evidenceLevel":"attested","complete":true,"approveEligible":false,"gaps":[]}"#
        ),
        "{text}"
    );
}

#[test]
fn a_hook_target_written_with_a_leading_dot_slash_still_corroborates() {
    let project = seed_session(&Seed {
        hook_corroborated: true,
        hook_target_prefix: "./",
        ..Seed::complete("s7")
    });
    assert_eq!(
        run(project.path(), "s7").evidence_level,
        EvidenceLevel::SessionObserved
    );
}
