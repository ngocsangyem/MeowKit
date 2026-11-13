//! What the archive rewrites, and what it must leave exactly as it found it.
use super::*;

fn project(plan: &str, extra: &[(&str, &str)]) -> tempfile::TempDir {
    let root = tempfile::tempdir().expect("temp dir");
    let dir = root.path().join("tasks/plans/261112-demo-plan");
    std::fs::create_dir_all(&dir).expect("create the plan dir");
    std::fs::write(dir.join("plan.md"), plan).expect("write plan.md");
    for (name, content) in extra {
        std::fs::write(dir.join(name), content).expect("write a plan file");
    }
    root
}

fn archived(root: &Path, name: &str) -> String {
    std::fs::read_to_string(root.join("tasks/plans/archive/261112-demo-plan").join(name))
        .expect("read an archived file")
}

const PLAN: &str = "---\ntitle: T\nstatus: in_progress\n---\n\n## Goal\n\nDone.\n";

#[test]
fn every_status_is_completed_and_the_directory_moves() {
    let root = project(PLAN, &[("phase-01-a.md", PLAN)]);
    let out = plan_archive(root.path(), Some("tasks/plans/261112-demo-plan"), false);
    assert_eq!(out.code, 0, "{out:?}");
    assert!(archived(root.path(), "plan.md").contains("status: completed"));
    assert!(archived(root.path(), "phase-01-a.md").contains("status: completed"));
    assert!(!root.path().join("tasks/plans/261112-demo-plan").exists());
}

/// The rewrite touches the status LINE's value only, so a file written on
/// Windows keeps its line endings — rewriting them would show up as a whole-file
/// diff in the human's next commit.
#[test]
fn a_crlf_plan_keeps_its_line_endings() {
    let root = project(&PLAN.replace('\n', "\r\n"), &[]);
    plan_archive(root.path(), Some("tasks/plans/261112-demo-plan"), false);
    let text = archived(root.path(), "plan.md");
    assert!(text.contains("status: completed\r\n"), "{text:?}");
    assert!(!text.contains("status: completed\n\r"), "{text:?}");
}

/// Only the FIRST line-anchored `status:` is the frontmatter's; one in the body
/// is content, not state.
#[test]
fn a_status_line_in_the_body_is_left_alone() {
    let root = project(
        "---\ntitle: T\nstatus: in_progress\n---\n\n## Notes\n\nstatus: in_progress\n",
        &[],
    );
    plan_archive(root.path(), Some("tasks/plans/261112-demo-plan"), false);
    let text = archived(root.path(), "plan.md");
    assert_eq!(text.matches("status: completed").count(), 1, "{text:?}");
    assert!(text.contains("\nstatus: in_progress\n"), "{text:?}");
}

#[test]
fn a_plan_without_a_frontmatter_status_says_so_rather_than_adding_one() {
    let root = project("---\ntitle: T\n---\n\n## Goal\n\nDone.\n", &[]);
    let out = plan_archive(root.path(), Some("tasks/plans/261112-demo-plan"), false);
    assert!(out.stdout.contains("plan.md: no status field"), "{out:?}");
    assert!(!archived(root.path(), "plan.md").contains("status:"));
}

#[test]
fn a_dry_run_reports_what_it_would_do_and_writes_nothing() {
    let root = project(PLAN, &[("phase-01-a.md", PLAN)]);
    let out = plan_archive(root.path(), Some("tasks/plans/261112-demo-plan"), true);
    assert_eq!(out.code, 0);
    assert!(out.stdout.contains("status → completed"), "{out:?}");
    assert!(
        out.stdout.contains("phases:  1/1 set to completed"),
        "{out:?}"
    );
    assert!(!root.path().join("tasks/plans/archive").exists());
    assert_eq!(
        std::fs::read_to_string(root.path().join("tasks/plans/261112-demo-plan/plan.md"))
            .expect("read plan"),
        PLAN,
        "a dry run must not have rewritten anything"
    );
}

#[test]
fn the_checkpoint_keeps_every_key_other_than_a_phase_status() {
    let root = project(
        PLAN,
        &[(
            ".plan-state.json",
            "{\n  \"slug\": \"keep me\",\n  \"phases\": {\n    \"a\": {\n      \
             \"status\": \"in_progress\",\n      \"note\": \"keep me too\"\n    }\n  }\n}\n",
        )],
    );
    plan_archive(root.path(), Some("tasks/plans/261112-demo-plan"), false);
    let text = archived(root.path(), ".plan-state.json");
    assert!(text.contains("\"status\": \"completed\""), "{text}");
    assert!(
        text.contains("\"keep me\"") && text.contains("\"keep me too\""),
        "{text}"
    );
}

/// A malformed checkpoint is LEFT ALONE: the markdown is authoritative, and
/// rewriting a file this code cannot parse would destroy whatever it held.
#[test]
fn a_malformed_checkpoint_is_left_untouched() {
    let root = project(PLAN, &[(".plan-state.json", "{not json")]);
    let out = plan_archive(root.path(), Some("tasks/plans/261112-demo-plan"), false);
    assert!(!out.stdout.contains(".plan-state.json"), "{out:?}");
    assert_eq!(archived(root.path(), ".plan-state.json"), "{not json");
}

#[test]
fn archiving_twice_is_idempotent_rather_than_an_error() {
    let root = project(PLAN, &[]);
    assert_eq!(
        plan_archive(root.path(), Some("tasks/plans/261112-demo-plan"), false).code,
        0
    );
    let again = plan_archive(
        root.path(),
        Some("tasks/plans/archive/261112-demo-plan"),
        false,
    );
    assert_eq!(again.code, 0);
    assert!(again.stdout.contains("is already archived"), "{again:?}");
}

/// An occupied destination holds someone's record of what happened, so it is
/// never overwritten.
#[test]
fn an_occupied_destination_is_refused_and_nothing_moves() {
    let root = project(PLAN, &[]);
    let occupied = root.path().join("tasks/plans/archive/261112-demo-plan");
    std::fs::create_dir_all(&occupied).expect("create the occupied dest");
    std::fs::write(occupied.join("plan.md"), "older").expect("write the older plan");
    let out = plan_archive(root.path(), Some("tasks/plans/261112-demo-plan"), false);
    assert_eq!(out.code, 1);
    assert!(out.stdout.contains("refusing to overwrite."), "{out:?}");
    assert_eq!(archived(root.path(), "plan.md"), "older");
    assert!(root.path().join("tasks/plans/261112-demo-plan").exists());
}

#[test]
fn a_directory_without_a_plan_md_is_not_a_plan_directory() {
    let root = project(PLAN, &[]);
    let out = plan_archive(root.path(), Some("tasks/plans"), false);
    assert_eq!(out.code, 1);
    assert!(out.stdout.contains("not a plan directory"), "{out:?}");
}

#[test]
fn a_missing_target_is_refused_before_anything_is_resolved() {
    let root = project(PLAN, &[]);
    let out = plan_archive(root.path(), None, false);
    assert_eq!(out.code, 1);
    assert_eq!(out.stdout, "plan archive: missing <plan-dir>");
}
