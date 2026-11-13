//! Responsibility coverage, the view's freshness, and which gap is which.
use std::fs;
use std::path::Path;

use super::super::result::Status;
use super::{Coverage, aggregate_substrate, check_substrate, render_substrate_view};

/// A kit with one registry rule and one frontmatter skill, each optionally
/// tagged with a responsibility.
fn install(
    rule_responsibility: Option<&str>,
    skill_responsibility: Option<&str>,
) -> tempfile::TempDir {
    let dir = tempfile::tempdir().expect("a temp dir");
    let claude = dir.path().join(".claude");
    let skill = claude.join("skills").join("cook");
    fs::create_dir_all(&skill).expect("create the skill dir");
    let skill_tag = skill_responsibility
        .map(|value| format!("responsibility: {value}\n"))
        .unwrap_or_default();
    fs::write(
        skill.join("SKILL.md"),
        format!("---\nname: mk:cook\nstatus: active\n{skill_tag}---\n"),
    )
    .expect("write the skill");
    fs::create_dir_all(claude.join("rules")).expect("create the rules dir");
    fs::write(claude.join("rules").join("gate-rules.md"), "# Rules\n").expect("write the rule");
    let meowkit = dir.path().join(".meowkit");
    fs::create_dir_all(&meowkit).expect("create the state dir");
    let rule_tag = rule_responsibility
        .map(|value| format!(",\"responsibility\":\"{value}\""))
        .unwrap_or_default();
    fs::write(
        meowkit.join("harness-inventory.json"),
        format!(
            "{{\"artifacts\":{{\"rules/gate-rules.md\":{{\"owner\":\"lifecycle\",\"status\":\"active\"{rule_tag}}}}}}}"
        ),
    )
    .expect("write the registry");
    dir
}

fn claude(dir: &Path) -> std::path::PathBuf {
    dir.join(".claude")
}

#[test]
fn an_untagged_registry_artifact_is_a_hard_gap_and_frontmatter_is_a_warning() {
    let dir = install(None, None);
    let rows = check_substrate(&claude(dir.path()), Status::Warn);
    assert!(
        rows.iter()
            .any(|row| row.name == "Substrate: rules/gate-rules.md"
                && row.status == Status::Fail
                && row.detail == "registry artifact has no responsibility (seed it)"),
        "{rows:#?}"
    );
    assert!(
        rows.iter().any(
            |row| row.name == "Substrate: untagged frontmatter artifacts"
                && row.status == Status::Warn
        ),
        "{rows:#?}"
    );
}

#[test]
fn an_out_of_enum_value_is_reported_against_its_path() {
    let dir = install(Some("telepathy"), Some("verification"));
    let rows = check_substrate(&claude(dir.path()), Status::Warn);
    assert!(
        rows.iter()
            .any(|row| row.name == "Substrate: rules/gate-rules.md"
                && row.detail == "responsibility=\"telepathy\" not in taxonomy enum"),
        "{rows:#?}"
    );
}

#[test]
fn a_responsibility_served_only_by_an_inactive_artifact_is_partial() {
    let dir = install(Some("gate-enforcement"), Some("verification"));
    // Make the skill inactive: its responsibility is then tagged but unserved.
    let skill = claude(dir.path())
        .join("skills")
        .join("cook")
        .join("SKILL.md");
    fs::write(
        &skill,
        "---\nname: mk:cook\nstatus: deprecated\nresponsibility: verification\n---\n",
    )
    .expect("rewrite the skill");
    let aggregate = aggregate_substrate(&claude(dir.path()));
    let verification = aggregate
        .rows
        .iter()
        .find(|row| row.value == "verification")
        .expect("the verification row");
    assert_eq!(verification.coverage, Coverage::Partial);
    assert_eq!(verification.count, 1);
    assert_eq!(verification.active, 0);
    let gate = aggregate
        .rows
        .iter()
        .find(|row| row.value == "gate-enforcement")
        .expect("the gate row");
    assert_eq!(gate.coverage, Coverage::Covered);
    let unserved = aggregate
        .rows
        .iter()
        .find(|row| row.value == "task-state")
        .expect("an unserved row");
    assert_eq!(unserved.coverage, Coverage::Missing);
}

#[test]
fn the_view_is_the_one_the_check_compares_against() {
    let dir = install(Some("gate-enforcement"), Some("verification"));
    let fresh = render_substrate_view(&aggregate_substrate(&claude(dir.path())));
    fs::write(
        claude(dir.path()).join("harness-substrate.md"),
        format!("{fresh}\n"),
    )
    .expect("write the view");
    let rows = check_substrate(&claude(dir.path()), Status::Warn);
    assert!(
        rows.iter()
            .any(|row| row.name == "Substrate view in sync" && row.status == Status::Pass),
        "{rows:#?}"
    );
    // One edit and it is stale — which is the whole point of committing it.
    fs::write(
        claude(dir.path()).join("harness-substrate.md"),
        format!("{fresh}\nhand-edited\n"),
    )
    .expect("edit the view");
    let rows = check_substrate(&claude(dir.path()), Status::Warn);
    assert!(
        rows.iter()
            .any(|row| row.name == "Substrate view in sync" && row.status == Status::Fail),
        "{rows:#?}"
    );
}

#[test]
fn an_absent_view_takes_the_severity_the_caller_asked_for() {
    let dir = install(Some("gate-enforcement"), Some("verification"));
    let lenient = check_substrate(&claude(dir.path()), Status::Warn);
    assert!(
        lenient
            .iter()
            .any(|row| row.name == "Substrate view present" && row.status == Status::Warn),
        "{lenient:#?}"
    );
    let strict = check_substrate(&claude(dir.path()), Status::Fail);
    assert!(
        strict
            .iter()
            .any(|row| row.name == "Substrate view present" && row.status == Status::Fail),
        "{strict:#?}"
    );
}
