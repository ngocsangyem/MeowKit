//! Unit tests for `targets` — the targets rules.
use super::*;
use crate::validate::Status;

#[test]
fn an_unknown_provider_detects_nothing_and_checks_nothing() {
    let dir = tempfile::tempdir().expect("a temp dir");
    assert!(!is_target_profile("emacs"));
    assert!(!detects_target("emacs", dir.path()));
    assert!(check_target("emacs", dir.path()).is_empty());
}

#[test]
fn a_codex_tree_is_detected_by_either_marker() {
    let dir = tempfile::tempdir().expect("a temp dir");
    assert!(!detects_target("codex", dir.path()));
    std::fs::create_dir_all(dir.path().join(".agents").join("skills"))
        .expect("create the skills tree");
    assert!(detects_target("codex", dir.path()));
}

#[test]
fn a_cursor_tree_needs_the_kit_hook_scripts_not_just_rules_of_its_own() {
    let dir = tempfile::tempdir().expect("a temp dir");
    let write = |rel: &str, text: &str| {
        let file = dir.path().join(rel);
        std::fs::create_dir_all(file.parent().expect("a parent")).expect("create the folder");
        std::fs::write(file, text).expect("write");
    };
    write(".cursor/rules/mine.mdc", "---\nalwaysApply: true\n---\n");
    assert!(
        !detects_target("cursor", dir.path()),
        "rules alone could be the user's own"
    );
    write(
        ".cursor/hooks/hook-runtime-config.json",
        "{ \"runtime\": \"cursor\" }",
    );
    assert!(detects_target("cursor", dir.path()));
    // A hook file that names a guard which is not installed fails its row.
    write(
        ".cursor/hooks.json",
        r#"{"version":1,"hooks":{"beforeShellExecution":[{"command":"node .cursor/hooks/pre-ship.cjs"}]}}"#,
    );
    let rows = check_target("cursor", dir.path());
    assert_eq!(rows.len(), 4);
    assert_eq!(rows[0].status, Status::Fail);
    assert!(
        rows[0].detail.contains("pre-ship.cjs"),
        "{}",
        rows[0].detail
    );
    assert_eq!(rows[1].status, Status::Pass);
    assert_eq!(rows[2].status, Status::Pass);
    assert_eq!(rows[3].status, Status::Fail, "no skill is installed");

    write(".cursor/hooks/pre-ship.cjs", "");
    write(".cursor/hooks/privacy-read-gate.cjs", "");
    write(
        ".cursor/hooks.json",
        r#"{"version":1,"hooks":{"beforeShellExecution":[{"command":"node .cursor/hooks/pre-ship.cjs"},{"command":"say done"}],"beforeReadFile":[{"command":"node .cursor/hooks/privacy-read-gate.cjs"}]}}"#,
    );
    write(
        ".cursor/skills/mk-cook/SKILL.md",
        "---\nname: mk-cook\n---\n",
    );
    let rows = check_target("cursor", dir.path());
    assert!(
        rows.iter().all(|r| r.status == Status::Pass),
        "{:?}",
        rows.iter().map(|r| &r.detail).collect::<Vec<_>>()
    );
}

#[test]
fn an_empty_codex_tree_fails_the_rows_it_cannot_satisfy() {
    let dir = tempfile::tempdir().expect("a temp dir");
    std::fs::create_dir_all(dir.path().join(".codex")).expect("create the codex dir");
    let rows = check_target("codex", dir.path());
    let names: Vec<&str> = rows.iter().map(|row| row.name.as_str()).collect();
    assert!(names.contains(&"Codex AGENTS.md present"));
    assert!(names.contains(&"Codex config.toml present"));
    assert!(names.contains(&"Codex no native memory surface"));
    // No agents, no rules, no skills, no refs: those rows are absent, not
    // invented, because a target without them is valid.
    assert!(!names.iter().any(|name| name.contains("agent TOMLs")));
}

#[test]
fn a_grok_tree_is_detected_by_its_hook_runtime_config_and_fails_what_is_missing() {
    let dir = tempfile::tempdir().expect("a temp dir");
    std::fs::create_dir_all(dir.path().join(".grok/skills/mine")).expect("create a skill folder");
    assert!(
        !detects_target("grok", dir.path()),
        "a .grok/ the user made is not an install"
    );
    let hooks = dir.path().join(".grok/meowkit/hooks");
    std::fs::create_dir_all(&hooks).expect("create the hook scripts folder");
    std::fs::write(
        hooks.join("hook-runtime-config.json"),
        "{ \"schemaVersion\": 1, \"runtime\": \"grok\" }\n",
    )
    .expect("write the runtime config");
    assert!(detects_target("grok", dir.path()));

    std::fs::create_dir_all(dir.path().join(".grok/hooks")).expect("create the hooks folder");
    std::fs::write(
        dir.path().join(".grok/hooks/meowkit.json"),
        r#"{"hooks":{"Stop":[{"hooks":[{"type":"command","command":"x","timeout":5}]}]}}"#,
    )
    .expect("write the hook file");
    let rows = check_target("grok", dir.path());
    let status: Vec<Status> = rows.iter().map(|row| row.status).collect();
    assert_eq!(
        status,
        [Status::Fail, Status::Fail, Status::Pass, Status::Fail],
        "{rows:?}"
    );
    assert!(
        rows[1].detail.contains("cannot block"),
        "{}",
        rows[1].detail
    );
}

#[test]
fn an_antigravity_tree_is_a_kit_skill_and_says_its_guards_are_not_installed() {
    let dir = tempfile::tempdir().expect("a temp dir");
    std::fs::create_dir_all(dir.path().join(".agents/skills/mine")).expect("create a skill folder");
    assert!(
        !detects_target("antigravity", dir.path()),
        "a skill the user made is not an install"
    );
    let skill = dir.path().join(".agents/skills/mk-cook");
    std::fs::create_dir_all(&skill).expect("create a kit skill folder");
    std::fs::write(
        skill.join("SKILL.md"),
        "---\nname: \"mk-cook\"\ndescription: \"Builds.\"\n---\n",
    )
    .expect("write the skill");
    assert!(detects_target("antigravity", dir.path()));

    let rows = check_target("antigravity", dir.path());
    let guards = rows.last().expect("a guards row");
    assert_eq!(guards.status, Status::Warn);
    assert!(
        guards.detail.contains("guards not installed"),
        "{}",
        guards.detail
    );
    // AGENTS.md and the guard script are not there.
    assert_eq!(rows[0].status, Status::Fail, "{rows:?}");
}

/// Antigravity silently discards a rule file with no valid `trigger`: the kit's
/// own rule files are judged, the user's are not.
#[test]
fn an_antigravity_rule_without_a_trigger_or_over_the_cut_fails_its_row() {
    let dir = tempfile::tempdir().expect("a temp dir");
    let write = |rel: &str, text: &str| {
        let file = dir.path().join(rel);
        std::fs::create_dir_all(file.parent().expect("a parent")).expect("create the folder");
        std::fs::write(file, text).expect("write");
    };
    let rule_row = |dir: &std::path::Path| {
        check_target("antigravity", dir)
            .into_iter()
            .find(|row| row.name.contains("rule files"))
            .expect("a rule row")
    };
    write(".agents/rules/mine.md", "no frontmatter at all\n");
    assert_eq!(rule_row(dir.path()).status, Status::Fail, "no kit rule yet");

    write(
        ".agents/rules/meowkit-a.md",
        "---\ndescription: d\n---\nBody\n",
    );
    let found = rule_row(dir.path());
    assert_eq!(found.status, Status::Fail);
    assert!(found.detail.contains("no `trigger`"), "{}", found.detail);

    write(
        ".agents/rules/meowkit-a.md",
        "---\ntrigger: sometimes\n---\nBody\n",
    );
    assert!(rule_row(dir.path()).detail.contains("is not one of"));

    write(
        ".agents/rules/meowkit-a.md",
        "---\ntrigger: model_decision\n---\nBody\n",
    );
    assert!(rule_row(dir.path()).detail.contains("no `description`"));

    let ok = "---\ntrigger: model_decision\ndescription: When shipping.\n---\nBody\n";
    write(".agents/rules/meowkit-a.md", ok);
    assert_eq!(rule_row(dir.path()).status, Status::Pass);

    write(
        ".agents/rules/meowkit-a.md",
        &format!("{ok}{}", "x".repeat(24_000)),
    );
    let found = rule_row(dir.path());
    assert_eq!(found.status, Status::Fail);
    assert!(found.detail.contains("24000-byte cut"), "{}", found.detail);
}

#[test]
fn an_antigravity_agent_needs_a_known_model_and_known_tools() {
    let dir = tempfile::tempdir().expect("a temp dir");
    let write = |rel: &str, text: &str| {
        let file = dir.path().join(rel);
        std::fs::create_dir_all(file.parent().expect("a parent")).expect("create the folder");
        std::fs::write(file, text).expect("write");
    };
    let agent_row = |dir: &std::path::Path| {
        check_target("antigravity", dir)
            .into_iter()
            .find(|row| row.name.contains("agents have"))
            .expect("an agent row")
    };
    write(
        ".agents/meowkit/agents/a.md",
        "---\nname: a\ndescription: d\n---\n",
    );
    assert!(agent_row(dir.path()).detail.contains("not installed"));
    let agent = |model: &str, tools: &str| {
        format!("---\nname: a\ndescription: \"d\"\ntools: [{tools}]\nmodel: {model}\n---\nBody\n")
    };
    write(".agents/agents/a.md", &agent("gpt", "view_file"));
    assert!(agent_row(dir.path()).detail.contains("is not one of"));
    write(".agents/agents/a.md", &agent("pro", "view_file, Bash"));
    assert!(
        agent_row(dir.path())
            .detail
            .contains("`Bash` is not an Antigravity tool")
    );
    write(
        ".agents/agents/a.md",
        &agent("pro", "view_file, run_command"),
    );
    assert_eq!(agent_row(dir.path()).status, Status::Pass);
}
