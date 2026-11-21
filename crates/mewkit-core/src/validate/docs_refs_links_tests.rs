//! Dead skill paths, missing link targets and commands no skill defines.
use std::fs;
use std::path::Path;

use super::super::docs_refs_link_rows::check_skill_link_rows;
use super::super::result::Status;
use super::{LinkKind, check_skill_links};

/// A kit with two skills: `cook` (SKILL.md + one reference) and `fix`.
fn kit(cook_body: &str) -> tempfile::TempDir {
    let dir = tempfile::tempdir().expect("a temp dir");
    let skills = dir.path().join(".claude").join("skills");
    for (skill, body) in [
        ("cook", cook_body),
        ("fix", "---\nname: mk:fix\n---\nbody\n"),
    ] {
        fs::create_dir_all(skills.join(skill).join("references")).expect("create the skill dir");
        fs::write(skills.join(skill).join("SKILL.md"), body).expect("write SKILL.md");
    }
    fs::write(skills.join("fix/references/real.md"), "x").expect("write a reference");
    dir
}

fn cook(body: &str) -> String {
    format!("---\nname: mk:cook\n---\n{body}\n")
}

fn kinds(dir: &Path) -> Vec<(LinkKind, String)> {
    check_skill_links(&dir.join(".claude"))
        .into_iter()
        .map(|f| (f.kind, f.token))
        .collect()
}

#[test]
fn a_dotdot_mk_path_is_dead() {
    let dir = kit(&cook(
        "see [x](../mk:fix/SKILL.md) and `mk:fix/references/real.md`",
    ));
    let found = kinds(dir.path());
    assert!(found.contains(&(LinkKind::DeadMkPath, "../mk:fix/SKILL.md".into())));
    assert!(found.contains(&(LinkKind::DeadMkPath, "mk:fix/references/real.md".into())));
}

#[test]
fn a_bare_skill_invocation_is_not_a_path() {
    let dir = kit(&cook("run `/mk:fix` then mk:fix handles it"));
    assert!(kinds(dir.path()).is_empty());
}

#[test]
fn a_link_to_a_missing_skill_directory_is_reported() {
    let dir = kit(&cook("[a](../ghost/SKILL.md)"));
    assert_eq!(
        kinds(dir.path()),
        vec![(LinkKind::MissingSkill, "../ghost/SKILL.md".into())]
    );
}

#[test]
fn a_link_to_a_missing_reference_file_is_reported() {
    let dir = kit(&cook(
        "[a](../fix/references/gone.md#top) [b](../fix/references/real.md)",
    ));
    assert_eq!(
        kinds(dir.path()),
        vec![(
            LinkKind::MissingReference,
            "../fix/references/gone.md#top".into()
        )]
    );
}

#[test]
fn urls_anchors_and_fenced_links_are_not_checked() {
    let dir = kit(&cook(
        "[u](https://x.dev/a.md) [h](#top)\n```\n[a](../ghost/SKILL.md)\n```",
    ));
    assert!(kinds(dir.path()).is_empty());
}

#[test]
fn an_unknown_command_is_found_in_backticks_and_at_line_start() {
    let dir = kit(&cook("run `/plan-design-review` first\n/autoplan now"));
    assert_eq!(
        kinds(dir.path()),
        vec![
            (LinkKind::UnknownCommand, "/plan-design-review".into()),
            (LinkKind::UnknownCommand, "/autoplan".into()),
        ]
    );
}

#[test]
fn known_commands_paths_urls_and_builtins_are_not_flagged() {
    let body =
        "`/fix` `/mk:cook --fast` `/clear` `/tmp/x` `/checkout` https://a.dev/plan-x /usr/bin/env";
    let dir = kit(&cook(body));
    assert!(kinds(dir.path()).is_empty());
}

#[test]
fn a_backticked_skill_local_path_must_exist_under_the_skill() {
    let dir = kit(&cook(
        "use `references/gone.md` or `references/here.md`, not `scripts/x.sh`",
    ));
    let present = dir.path().join(".claude/skills/cook/references/here.md");
    fs::write(present, "x").expect("write a reference");
    assert_eq!(
        kinds(dir.path()),
        vec![(LinkKind::MissingReference, "references/gone.md".into())]
    );
}

#[test]
fn rows_are_advisory_and_pass_when_clean() {
    let dirty = kit(&cook("`/nope`"));
    let rows = check_skill_link_rows(&dirty.path().join(".claude"), Status::Warn);
    assert_eq!(rows.len(), 4);
    assert!(rows.iter().any(|r| r.status == Status::Warn));
    let clean = kit(&cook("nothing"));
    let rows = check_skill_link_rows(&clean.path().join(".claude"), Status::Warn);
    assert!(rows.iter().all(|r| r.status == Status::Pass));
}
