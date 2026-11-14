use super::*;
use crate::validate::{load_pack_manifest, resolve_packs};

fn skill(owner: &str, name: &str) -> String {
    format!(
        "---\nname: mk:{name}\ndescription: {name}\nowner: {owner}\ncriticality: standard\nstatus: active\nruntime: claude-code\n---\n"
    )
}

/// A tiny installed project: `cook` (lifecycle), `qa` (testing, two files).
fn project() -> tempfile::TempDir {
    let dir = tempfile::tempdir().unwrap();
    let w = |rel: &str, text: &str| {
        let p = dir.path().join(rel);
        std::fs::create_dir_all(p.parent().unwrap()).unwrap();
        std::fs::write(p, text).unwrap();
    };
    w(
        ".claude/settings.json",
        "{\"command\": \"node .claude/skills/qa/notes.md\"}",
    );
    w(".claude/skills/cook/SKILL.md", &skill("lifecycle", "cook"));
    w(".claude/skills/qa/SKILL.md", &skill("testing", "qa"));
    w(".claude/skills/qa/notes.md", "notes");
    w(
        ".meowkit/pack-manifest.json",
        r#"{"schemaVersion":"1.0","base":{"files":["settings.json"],"globs":[],"exclude":[]},
            "packs":{"lifecycle-core":{"owners":["lifecycle"]},"testing":{"owners":["testing"]}},
            "profiles":{"full":["*"]}}"#,
    );
    dir
}

fn names(list: &[&str]) -> Vec<String> {
    list.iter().map(|s| (*s).to_owned()).collect()
}

#[test]
fn a_skill_resolves_to_its_whole_directory() {
    let dir = project();
    let claude = dir.path().join(".claude");
    let manifest = load_pack_manifest(&claude).unwrap();
    let r = resolve_packs(&claude, &manifest, &names(&["testing"])).unwrap();
    assert!(r.paths.contains("skills/qa/notes.md") && r.paths.contains("skills/qa/SKILL.md"));
    assert!(!r.paths.contains("skills/cook/SKILL.md"));
    assert_eq!(r.membership["testing"].len(), 2);
}

#[test]
fn only_pristine_pack_files_a_settings_file_does_not_name_are_deletable() {
    let dir = project();
    let claude = dir.path().join(".claude");
    let manifest = load_pack_manifest(&claude).unwrap();
    let installed = names(&["lifecycle-core", "testing"]);
    let all_pristine = |_: &str| OnDisk::Pristine;
    let plan = removable_paths(
        &claude,
        &manifest,
        &installed,
        &names(&["testing"]),
        &all_pristine,
    )
    .unwrap();
    // settings.json names notes.md, so a hook could break without it.
    assert_eq!(plan.deletable, ["skills/qa/SKILL.md"]);
    assert_eq!(plan.preserved, ["skills/qa/notes.md"]);

    let edited = |p: &str| {
        if p.ends_with("SKILL.md") {
            OnDisk::Other
        } else {
            OnDisk::Missing
        }
    };
    let plan = removable_paths(
        &claude,
        &manifest,
        &installed,
        &names(&["testing"]),
        &edited,
    )
    .unwrap();
    assert!(plan.deletable.is_empty());
    assert_eq!(plan.preserved, ["skills/qa/SKILL.md", "skills/qa/notes.md"]);
}

#[test]
fn a_file_another_installed_pack_owns_stays() {
    let dir = project();
    let claude = dir.path().join(".claude");
    let mut manifest = load_pack_manifest(&claude).unwrap();
    // Both packs claim the testing skill.
    manifest.packs[0].1.artifacts_add.push("mk:qa".into());
    let installed = names(&["lifecycle-core", "testing"]);
    let plan = removable_paths(
        &claude,
        &manifest,
        &installed,
        &names(&["testing"]),
        &|_| OnDisk::Pristine,
    )
    .unwrap();
    assert!(plan.deletable.is_empty(), "{plan:?}");
}
