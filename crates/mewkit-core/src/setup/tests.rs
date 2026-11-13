use std::fs;
use std::path::Path;

use super::*;

fn options(dry_run: bool) -> StepOptions<'static> {
    StepOptions {
        skills: &[],
        dry_run,
    }
}

fn step(dir: &Path, name: &str, dry_run: bool) -> StepResult {
    run_step(name, dir, &options(dry_run), &mut |_| {})
        .unwrap()
        .unwrap()
}

#[test]
fn an_unknown_step_is_not_run() {
    let tmp = tempfile::tempdir().unwrap();
    assert!(run_step("bogus", tmp.path(), &options(false), &mut |_| {}).is_none());
}

#[test]
fn mcp_writes_defaults_then_skips() {
    let tmp = tempfile::tempdir().unwrap();
    let first = step(tmp.path(), "mcp", false);
    assert_eq!(first.status, StepStatus::Pass);
    assert_eq!(first.changes[0].action, "create");
    assert!(
        fs::read_to_string(tmp.path().join(".mcp.json"))
            .unwrap()
            .contains("context7")
    );
    assert_eq!(step(tmp.path(), "mcp", false).status, StepStatus::Skip);
}

#[test]
fn mcp_prefers_the_meowkit_example_over_the_legacy_one() {
    let tmp = tempfile::tempdir().unwrap();
    fs::create_dir_all(tmp.path().join(".meowkit")).unwrap();
    fs::create_dir_all(tmp.path().join(".claude")).unwrap();
    fs::write(tmp.path().join(".meowkit/mcp.json.example"), "new").unwrap();
    fs::write(tmp.path().join(".claude/mcp.json.example"), "old").unwrap();
    let result = step(tmp.path(), "mcp", false);
    assert_eq!(result.changes[0].action, "copy");
    assert_eq!(
        fs::read_to_string(tmp.path().join(".mcp.json")).unwrap(),
        "new"
    );
}

#[test]
fn a_dry_run_records_changes_and_writes_nothing() {
    let tmp = tempfile::tempdir().unwrap();
    for name in ["mcp", "env", "gitignore"] {
        assert_eq!(step(tmp.path(), name, true).status, StepStatus::Pass);
    }
    assert_eq!(fs::read_dir(tmp.path()).unwrap().count(), 0);
}

#[test]
fn an_empty_env_file_is_replaced_but_a_filled_one_is_kept() {
    let tmp = tempfile::tempdir().unwrap();
    fs::create_dir_all(tmp.path().join(".meowkit")).unwrap();
    fs::write(tmp.path().join(".meowkit/.env"), "  \n").unwrap();
    let result = step(tmp.path(), "env", false);
    assert_eq!(result.changes[0].action, "update");
    assert_eq!(step(tmp.path(), "env", false).status, StepStatus::Skip);
}

#[test]
fn gitignore_strips_stale_lines() {
    let (text, stripped) = strip_stale_memory_ignore("a\n.meowkit/memory/\n/.meowkit/memory/**\nb");
    assert!(stripped);
    assert_eq!(text, "a\nb");
    let (text, lines) =
        strip_superseded_meowkit_ignores(".meowkit/state/\n!.meowkit/state/\n.meowkit/.env\nkeep");
    assert_eq!(lines, [".meowkit/state/", ".meowkit/.env"]);
    assert_eq!(text, "!.meowkit/state/\nkeep");
    assert!(strip_superseded_meowkit_ignores("x").1.is_empty());
}

#[test]
fn gitignore_is_idempotent() {
    let tmp = tempfile::tempdir().unwrap();
    let first = step(tmp.path(), "gitignore", false);
    assert!(
        first
            .message
            .ends_with("Appended MeowKit entries to .gitignore")
    );
    let second = step(tmp.path(), "gitignore", false);
    assert_eq!(second.status, StepStatus::Skip);
    assert_eq!(second.message, "MeowKit entries already in .gitignore");
}

#[test]
fn project_context_hints_by_codebase_presence() {
    let tmp = tempfile::tempdir().unwrap();
    assert!(
        step(tmp.path(), "project-context", false)
            .message
            .contains("project-context init")
    );
    fs::write(tmp.path().join("go.mod"), "").unwrap();
    assert!(
        step(tmp.path(), "project-context", false)
            .message
            .contains("project-context generate")
    );
}

#[test]
fn skill_envs_does_nothing_without_a_named_skill() {
    let tmp = tempfile::tempdir().unwrap();
    let result = step(tmp.path(), "skill-envs", false);
    assert_eq!(result.status, StepStatus::Skip);
    assert!(result.message.starts_with("No skills selected"));
}

#[test]
fn skill_envs_refuses_an_undeclared_skill() {
    let tmp = tempfile::tempdir().unwrap();
    let skills = vec!["ghost".to_string()];
    let opts = StepOptions {
        skills: &skills,
        dry_run: false,
    };
    let result = run_step("skill-envs", tmp.path(), &opts, &mut |_| {})
        .unwrap()
        .unwrap();
    assert_eq!(result.status, StepStatus::Fail);
    assert_eq!(
        result.message,
        "Not a skill that needs an environment: ghost. Eligible: (none)"
    );
}
