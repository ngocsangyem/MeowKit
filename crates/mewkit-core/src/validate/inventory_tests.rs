//! What counts as an artifact, and what its governance record says.
use std::fs;
use std::path::Path;

use super::super::inventory_build::build_inventory;
use super::super::inventory_enumerate::{ArtifactType, enumerate_artifacts};
use super::super::inventory_read::read_frontmatter;

/// A kit with one skill, one agent, one rule and two hooks (one per tier).
fn install() -> tempfile::TempDir {
    let dir = tempfile::tempdir().expect("a temp dir");
    let claude = dir.path().join(".claude");
    let skill = claude.join("skills").join("cook");
    fs::create_dir_all(&skill).expect("create the skill dir");
    fs::write(
        skill.join("SKILL.md"),
        "---\nname: mk:cook\nowner: lifecycle\ncriticality: high\nstatus: active\nruntime: portable\n---\n\nProse.\n",
    )
    .expect("write the skill");
    fs::create_dir_all(claude.join("agents")).expect("create the agents dir");
    fs::write(
        claude.join("agents").join("developer.md"),
        "---\nname: developer\nmodel: inherit\ntools: Read, Write\nowner: lifecycle\ncriticality: high\nstatus: active\nruntime: claude-code\ndescription: Use for code. Does not review.\n---\n\n## Exclusive Ownership\n\nOwns `src/*`.\n",
    )
    .expect("write the agent");
    fs::create_dir_all(claude.join("agents")).expect("create the agents dir");
    fs::write(claude.join("agents").join("AGENTS_INDEX.md"), "# Index\n").expect("write the index");
    fs::create_dir_all(claude.join("rules")).expect("create the rules dir");
    fs::write(claude.join("rules").join("core-behaviors.md"), "# Rules\n").expect("write the rule");
    let hooks = claude.join("hooks");
    fs::create_dir_all(hooks.join("handlers")).expect("create the handlers dir");
    fs::write(hooks.join("pre-ship.cjs"), "//\n").expect("write a hook");
    fs::write(hooks.join("handlers").join("orient.cjs"), "//\n").expect("write a handler");
    fs::write(hooks.join("HOOKS_INDEX.md"), "# Hooks\n").expect("write the index");
    dir
}

fn claude(dir: &Path) -> std::path::PathBuf {
    dir.join(".claude")
}

#[test]
fn an_index_file_is_not_an_agent_and_a_sidecar_is_not_a_hook() {
    let dir = install();
    let (refs, issues) = enumerate_artifacts(&claude(dir.path()));
    let ids: Vec<&str> = refs.iter().map(|r| r.id.as_str()).collect();
    assert!(ids.contains(&"developer"));
    assert!(!ids.contains(&"AGENTS_INDEX"), "{ids:?}");
    assert!(!ids.contains(&"HOOKS_INDEX"), "{ids:?}");
    assert!(issues.is_empty(), "{issues:?}");
}

#[test]
fn both_hook_tiers_are_counted() {
    let dir = install();
    let (refs, _) = enumerate_artifacts(&claude(dir.path()));
    let hooks: Vec<&str> = refs
        .iter()
        .filter(|r| r.artifact_type == ArtifactType::Hook)
        .map(|r| r.rel.as_str())
        .collect();
    // Counting only the top level silently shrank this set when the observers
    // moved into their own directory.
    assert_eq!(
        hooks,
        vec!["hooks/pre-ship.cjs", "hooks/handlers/orient.cjs"]
    );
}

#[test]
fn a_skill_directory_without_a_skill_file_is_an_issue_not_a_silence() {
    let dir = install();
    fs::create_dir_all(claude(dir.path()).join("skills").join("empty"))
        .expect("create the stray dir");
    let (_, issues) = enumerate_artifacts(&claude(dir.path()));
    assert_eq!(issues.len(), 1);
    assert_eq!(issues[0].path, "skills/empty");
    assert!(issues[0].problem.contains("no SKILL.md"));
}

#[test]
fn a_runtime_directory_is_never_an_artifact() {
    let dir = install();
    fs::create_dir_all(claude(dir.path()).join("skills").join("__pycache__"))
        .expect("create the cache dir");
    let (_, issues) = enumerate_artifacts(&claude(dir.path()));
    assert!(issues.is_empty(), "{issues:?}");
}

#[test]
fn the_skill_id_is_its_declared_name_not_its_directory() {
    let dir = install();
    let (refs, _) = enumerate_artifacts(&claude(dir.path()));
    let skill = refs
        .iter()
        .find(|r| r.artifact_type == ArtifactType::Skill)
        .expect("the skill");
    assert_eq!(skill.id, "mk:cook");
    assert_eq!(skill.rel, "skills/cook/SKILL.md");
}

#[test]
fn unreadable_frontmatter_reads_as_absent_rather_than_crashing() {
    let dir = tempfile::tempdir().expect("a temp dir");
    let file = dir.path().join("broken.md");
    fs::write(&file, "---\nname: [unclosed\n---\n").expect("write the file");
    assert!(read_frontmatter(&file).is_empty());
    assert!(read_frontmatter(&dir.path().join("absent.md")).is_empty());
}

#[test]
fn a_rule_without_a_registry_record_is_reported_as_ungoverned() {
    let dir = install();
    let inventory = build_inventory(&claude(dir.path()));
    assert!(
        inventory
            .issues
            .iter()
            .any(|issue| issue.path == "rules/core-behaviors.md"
                && issue.problem.contains("registry")),
        "{:?}",
        inventory.issues
    );
    // The frontmatter-sourced artifacts carry theirs, so they are not reported.
    assert!(
        !inventory
            .issues
            .iter()
            .any(|issue| issue.path.starts_with("skills/")),
        "{:?}",
        inventory.issues
    );
}

#[test]
fn an_agents_owned_artifacts_need_a_write_tool() {
    let dir = install();
    let entry = build_inventory(&claude(dir.path()))
        .entries
        .into_iter()
        .find(|entry| entry.id == "developer")
        .expect("the agent entry");
    assert_eq!(entry.owned_artifacts, Some(vec!["src/*".to_string()]));
    assert_eq!(entry.trigger_owner, Some(true));
    assert_eq!(entry.agent_class, Some("core-support"));

    // Drop the write tools: the same body now owns nothing, because the scan
    // cannot tell a citation from an ownership claim.
    fs::write(
        claude(dir.path()).join("agents").join("developer.md"),
        "---\nname: developer\nmodel: inherit\ntools: Read\nowner: lifecycle\ncriticality: high\nstatus: active\nruntime: claude-code\ndescription: Use for code. Does not review.\n---\n\n## Exclusive Ownership\n\nOwns `src/*`.\n",
    )
    .expect("rewrite the agent");
    let read_only = build_inventory(&claude(dir.path()))
        .entries
        .into_iter()
        .find(|entry| entry.id == "developer")
        .expect("the agent entry");
    assert_eq!(read_only.owned_artifacts, Some(Vec::new()));
}

#[test]
fn a_registry_entry_with_no_artifact_is_a_stale_entry() {
    let dir = install();
    let meowkit = dir.path().join(".meowkit");
    fs::create_dir_all(&meowkit).expect("create the state dir");
    fs::write(
        meowkit.join("harness-inventory.json"),
        r#"{"artifacts":{"rules/core-behaviors.md":{"owner":"lifecycle","criticality":"high","status":"active","runtime":"portable"},"rules/gone.md":{"owner":"lifecycle"}}}"#,
    )
    .expect("write the registry");
    let inventory = build_inventory(&claude(dir.path()));
    assert!(
        inventory
            .issues
            .iter()
            .any(|issue| issue.path == "rules/gone.md"
                && issue.problem == "registry entry has no matching artifact on disk"),
        "{:?}",
        inventory.issues
    );
    // And the rule that DOES exist now carries its metadata.
    let rule = inventory
        .entries
        .iter()
        .find(|entry| entry.id == "core-behaviors")
        .expect("the rule entry");
    assert_eq!(rule.owner, "lifecycle");
    assert_eq!(rule.source, "registry");
}

#[test]
fn conflicting_dependency_edges_are_reported_once() {
    let dir = tempfile::tempdir().expect("a temp dir");
    let skill = dir.path().join(".claude").join("skills").join("x");
    fs::create_dir_all(&skill).expect("create the skill dir");
    fs::write(
        skill.join("SKILL.md"),
        "---\nname: mk:x\ndependency_edges:\n  - id: mk:y\n    type: requires\n  - id: mk:y\n    type: peer\n  - id: mk:z\n    type: nonsense\ndepends_on: [mk:other]\n---\n",
    )
    .expect("write the skill");
    let inventory = build_inventory(&dir.path().join(".claude"));
    let problems: Vec<&str> = inventory
        .issues
        .iter()
        .map(|issue| issue.problem.as_str())
        .collect();
    assert!(problems.contains(&"conflicting dependency_edges types for \"mk:y\""));
    assert!(problems.contains(&"invalid dependency_edges[2]"));
    assert!(problems.contains(&"depends_on must match dependency_edges of type requires"));
    let entry = &inventory.entries[0];
    // The typed `requires` edges win over the legacy list.
    assert_eq!(entry.depends_on, vec!["mk:y".to_string()]);
}
