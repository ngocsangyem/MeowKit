//! Taking over installs the npm `mewkit` CLI made. The npm install is stood
//! in for by a `mewkit` install whose ownership index is replaced with
//! an npm-format record (same schema and checksums the npm CLI writes).
mod support;

use std::path::{Path, PathBuf};

use mewkit_core::adopt::{tree_checksum, tree_files};
use mewkit_core::fsx::sha256_hex;
use support::kit::sha_tree;
use support::temp_home::TempHome;
use support::{code, text, write};

fn row(item: &str, sum: &str) -> String {
    format!(
        r#"{{"item":"{item}","type":"config","provider":"codex","global":false,"path":"/p/{item}","installedAt":"2026-11-01T00:00:00.000Z","sourcePath":"root/{item}","sourceChecksum":"{sum}","targetChecksum":"{sum}","installSource":"kit"}}"#
    )
}

fn tree(root: &Path, dir: &str) -> String {
    tree_checksum(&tree_files(&root.join(dir)).unwrap())
}

/// A project that looks like an npm `mewkit init --target codex` from an
/// older kit: one retired agent, one retired file still clean, one edited.
fn npm_codex_install() -> TempHome {
    let env = TempHome::new();
    let p = env.project();
    assert_eq!(code(&env.with_kit(&["init", "--target", "codex"])), 0);
    std::fs::remove_file(p.join(".meowkit/state/ownership/codex.json")).unwrap();
    write(&p, ".codex/agents/retired.toml", "old agent\n");
    write(&p, ".codex/old-clean.md", "old\n");
    write(&p, ".codex/old-edited.md", "mine now\n");
    let rows = [
        row(".codex/agents", &tree(&p, ".codex/agents")),
        row(".agents/skills", &tree(&p, ".agents/skills")),
        row(".codex/old-clean.md", &sha256_hex(b"old\n")),
        row(".codex/old-edited.md", &sha256_hex(b"old\n")),
        row(
            "AGENTS.md",
            &sha256_hex(&std::fs::read(p.join("AGENTS.md")).unwrap()),
        ),
    ];
    write(
        &p,
        ".meowkit/state/codex-ledger.json",
        &format!(
            r#"{{"version":"3.0","installations":[{}]}}"#,
            rows.join(",")
        ),
    );
    env
}

/// The tree's paths minus `extra` and the backups a run leaves.
fn without(mut tree: std::collections::BTreeMap<PathBuf, String>, extra: &[&str]) -> Vec<PathBuf> {
    for e in extra {
        tree.remove(Path::new(e));
    }
    tree.into_keys()
        .filter(|p| !p.starts_with(".meowkit/backups"))
        .collect()
}

#[test]
fn init_adopts_an_npm_codex_install_and_removes_only_clean_retired_files() {
    let clean = TempHome::new();
    assert_eq!(code(&clean.with_kit(&["init", "--target", "codex"])), 0);

    let env = npm_codex_install();
    let p = env.project();
    // Never implicit: upgrade only names the command that takes it over.
    let out = env.with_kit(&["upgrade"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    assert!(
        text(&out).contains("the npm mewkit CLI installed codex here"),
        "{}",
        text(&out)
    );
    assert!(
        p.join(".codex/old-clean.md").exists(),
        "upgrade changed nothing"
    );

    let out = env.with_kit(&["init", "--target", "codex"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    assert!(
        text(&out).contains("taking over the npm mewkit install"),
        "{}",
        text(&out)
    );

    assert!(!p.join(".codex/agents/retired.toml").exists());
    assert!(!p.join(".codex/old-clean.md").exists());
    assert_eq!(
        std::fs::read_to_string(p.join(".codex/old-edited.md")).unwrap(),
        "mine now\n"
    );
    assert!(p.join(".meowkit/state/ownership/codex.json").is_file());
    // Everything else is exactly a fresh install.
    assert_eq!(
        without(
            sha_tree(&p),
            &[".codex/old-edited.md", ".meowkit/state/codex-ledger.json"]
        ),
        without(sha_tree(&clean.project()), &[])
    );

    // Owned now: uninstall takes it out again, leaving the user's file.
    let out = env.with_kit(&["uninstall", "--yes"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    assert!(p.join(".codex/old-edited.md").is_file());
    assert!(!p.join(".codex/agents").exists());
    // The npm record does not bring the runtime back by itself.
    let out = env.with_kit(&["upgrade"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    assert!(text(&out).contains("nothing installed"), "{}", text(&out));
    assert!(!p.join(".codex/agents").exists());
}

#[test]
fn an_npm_claude_code_install_is_adopted_from_its_metadata() {
    let env = TempHome::new();
    let p = env.project();
    assert_eq!(code(&env.with_kit(&["init", "--target", "claude-code"])), 0);
    std::fs::remove_file(p.join(".meowkit/state/ownership/claude-code.json")).unwrap();
    write(&p, ".claude/rules/retired.md", "old rule\n");
    let sum = sha256_hex(b"old rule\n");
    write(
        &p,
        ".meowkit/metadata.json",
        &format!(
            r#"{{"schemaVersion":"1.0","version":"v2.15.0","installedAt":"x","files":[
            {{"path":"rules/retired.md","owner":"meowkit","layer":"core","checksum":"{sum}","baseChecksum":"{sum}"}}]}}"#
        ),
    );
    let out = env.with_kit(&["init", "--target", "claude-code"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    assert!(
        !p.join(".claude/rules/retired.md").exists(),
        "{}",
        text(&out)
    );
}

#[test]
fn a_kit_directory_with_no_record_is_named_with_the_command_that_takes_it_over() {
    let env = TempHome::new();
    write(&env.project(), ".codex/config.toml", "model = \"x\"\n");
    let out = env.with_kit(&["upgrade"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    assert!(
        text(&out).contains("codex has no install record: `mewkit init --target codex`"),
        "{}",
        text(&out)
    );
}

#[test]
fn a_broken_record_for_another_runtime_does_not_stop_this_one() {
    let env = TempHome::new();
    write(
        &env.project(),
        ".meowkit/state/cursor-ledger.json",
        "{ broken",
    );
    let out = env.with_kit(&["init", "--target", "codex"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    let out = env.with_kit(&["upgrade"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    // Naming it does fail, with the file to fix.
    let out = env.with_kit(&["init", "--target", "cursor"]);
    assert_eq!(code(&out), 1, "{}", text(&out));
    assert!(text(&out).contains("cursor-ledger.json"), "{}", text(&out));
}
