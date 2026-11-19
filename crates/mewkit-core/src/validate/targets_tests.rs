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
fn a_cursor_tree_needs_its_ledger_not_just_a_root_agents_file() {
    let dir = tempfile::tempdir().expect("a temp dir");
    std::fs::write(dir.path().join("AGENTS.md"), "# Agents\n").expect("write AGENTS.md");
    assert!(
        !detects_target("cursor", dir.path()),
        "a root AGENTS.md is installed by the Codex bundle too"
    );
    let ledger = super::super::target_cursor::ledger_path(dir.path());
    std::fs::create_dir_all(ledger.parent().expect("the state dir")).expect("create the state dir");
    std::fs::write(&ledger, "{}\n").expect("write the ledger");
    assert!(detects_target("cursor", dir.path()));
    // And with the ledger present, the skeleton rows run.
    let rows = check_target("cursor", dir.path());
    assert_eq!(rows.len(), 3);
    assert_eq!(rows[0].status, Status::Pass);
    assert_eq!(rows[1].status, Status::Fail);
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
