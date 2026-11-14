//! `init`'s profile, delivery, skill-pack and MCP flags and the `pack` verb,
//! end to end against this checkout's kit, in a temp home and project.
//!
//! The npm CLI cannot take part here: it installs from a release download, and
//! its file tree differs by design (see the golden DIVERGENCES). What is
//! compared with it is the resolved allow-set (adapter tests) and the refusals
//! (parity cases).
mod support;

use std::process::Command;

use serde_json::Value;
use support::kit::sha_tree;
use support::temp_home::TempHome;
use support::{code, text, write};

fn json(out: &std::process::Output) -> Value {
    serde_json::from_slice(&out.stdout).unwrap_or_else(|e| panic!("{e}: {}", text(out)))
}

fn installed(env: &TempHome, pack: &str) -> bool {
    let out = env.with_kit(&["pack", "list", "--json"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    json(&out)
        .as_array()
        .unwrap()
        .iter()
        .find(|r| r["pack"] == pack)
        .unwrap_or_else(|| panic!("no pack {pack}"))["installed"]
        .as_bool()
        .unwrap()
}

#[test]
fn a_profile_installs_a_subset_and_packs_come_and_go_by_name() {
    let env = TempHome::new();
    let p = env.project();
    // `product` rather than `core`: listing a profile that leaves out an
    // artifact a pack names fails in both CLIs (see `pack_cases.rs`).
    let out = env.with_kit(&["init", "--target", "claude-code", "--profile", "product"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    assert!(installed(&env, "lifecycle-core") && installed(&env, "testing"));
    assert!(!installed(&env, "atlassian"));
    let subset = sha_tree(&p).len();

    // A dry run names the files and writes none.
    let before = sha_tree(&p);
    let dry = env.with_kit(&["pack", "add", "atlassian", "--dry-run", "--json"]);
    assert_eq!(code(&dry), 0, "{}", text(&dry));
    let doc = json(&dry);
    assert_eq!(doc["dryRun"], true);
    assert!(!doc["planned"].as_array().unwrap().is_empty());
    assert!(doc["applied"].as_array().unwrap().is_empty());
    assert_eq!(sha_tree(&p), before, "a dry run changes nothing");

    let out = env.with_kit(&["pack", "add", "atlassian"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    assert!(installed(&env, "atlassian"));
    let grown = sha_tree(&p).len();
    assert!(grown > subset, "the pack's files arrived");

    // Adding it again is a no-op, not an error.
    let again = env.with_kit(&["pack", "add", "atlassian"]);
    assert_eq!(code(&again), 0);
    assert!(text(&again).contains("Already installed: atlassian"));

    // Deleting needs an answer; without a terminal that answer is --yes.
    let ask = env.with_kit(&["pack", "remove", "atlassian"]);
    assert_eq!(code(&ask), 2, "{}", text(&ask));
    assert!(text(&ask).contains("--yes"), "{}", text(&ask));
    assert_eq!(sha_tree(&p).len(), grown);

    let out = env.with_kit(&["pack", "remove", "atlassian", "--yes"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    assert_eq!(sha_tree(&p).len(), subset, "exactly the pack's files went");
    assert!(!installed(&env, "atlassian"));
    let none = env.with_kit(&["pack", "remove", "atlassian", "--yes"]);
    assert!(
        text(&none).contains("Nothing to remove for atlassian"),
        "{}",
        text(&none)
    );
}

#[test]
fn packs_refuse_what_cannot_be_done() {
    let env = TempHome::new();
    assert_eq!(code(&env.with_kit(&["init", "--target", "claude-code"])), 0);
    let out = env.with_kit(&["pack", "remove", "lifecycle-core", "--yes"]);
    assert_eq!(code(&out), 1);
    assert!(text(&out).contains("core safety surface"), "{}", text(&out));
    let out = env.with_kit(&["pack", "add", "nope"]);
    assert_eq!(code(&out), 1);
    assert!(
        text(&out).contains("Unknown pack \"nope\""),
        "{}",
        text(&out)
    );
    assert_eq!(code(&env.with_kit(&["pack", "bogus"])), 2);
    let out = env.with_kit(&["init", "--target", "claude-code", "--profile", "nope"]);
    assert_eq!(code(&out), 1);
    assert!(
        text(&out).contains("Unknown profile \"nope\""),
        "{}",
        text(&out)
    );
}

#[test]
fn a_narrower_profile_trims_an_earlier_wider_install() {
    let env = TempHome::new();
    let p = env.project();
    assert_eq!(code(&env.with_kit(&["init", "--target", "claude-code"])), 0);
    let full = sha_tree(&p).len();
    let out = env.with_kit(&["init", "--target", "claude-code", "--profile", "product"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    assert!(sha_tree(&p).len() < full);
    assert!(!installed(&env, "atlassian"));
}

#[test]
fn delivery_plugin_adds_the_manifest_and_refuses_other_targets() {
    let env = TempHome::new();
    let p = env.project();
    let out = env.with_kit(&["init", "--target", "claude-code", "--delivery", "plugin"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    let manifest: Value = serde_json::from_str(
        &std::fs::read_to_string(p.join(".claude-plugin/plugin.json")).unwrap(),
    )
    .unwrap();
    assert_eq!(manifest["name"], "meowkit");
    assert!(manifest["version"].as_str().is_some_and(|v| !v.is_empty()));

    let other = TempHome::new();
    let out = other.with_kit(&["init", "--target", "codex", "--delivery", "plugin"]);
    assert_eq!(code(&out), 1, "{}", text(&out));
    assert!(text(&out).contains("--delivery is meaningful for --target claude-code only"));
    assert!(sha_tree(&other.project()).is_empty(), "nothing was written");
    let out = other.with_kit(&["init", "--target", "claude-code", "--delivery", "bogus"]);
    assert_eq!(code(&out), 1);
    assert!(text(&out).contains("Unknown --delivery \"bogus\""));
}

#[test]
fn a_claude_install_keeps_its_shared_files_and_uninstalls_clean() {
    let env = TempHome::new();
    let p = env.project();
    assert_eq!(code(&env.with_kit(&["init", "--target", "claude-code"])), 0);
    for f in [
        ".meowkit/.gitignore",
        ".meowkit/pack-manifest.json",
        ".meowkit/config.yaml",
    ] {
        assert!(p.join(f).is_file(), "{f}");
    }
    let out = env.with_kit(&["uninstall", "--yes"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    let left: Vec<_> = sha_tree(&p).into_keys().collect();
    assert!(left.is_empty(), "{left:?}");
}

#[test]
fn skill_packs_all_and_empty_select_the_catalogs_packs() {
    let count = |args: &[&str]| {
        let env = TempHome::new();
        let mut a = vec!["init", "--target", "codex"];
        a.extend_from_slice(args);
        assert_eq!(code(&env.with_kit(&a)), 0);
        sha_tree(&env.project()).len()
    };
    let default_only = count(&["--skill-packs", ""]);
    let named = count(&["--skill-packs", "core,media"]);
    let all = count(&["--skill-packs", "all"]);
    assert!(
        default_only < named && named < all,
        "{default_only} {named} {all}"
    );
}

fn git(dir: &std::path::Path, args: &[&str]) {
    let ok = Command::new("git")
        .args(args)
        .current_dir(dir)
        .status()
        .unwrap()
        .success();
    assert!(ok, "git {args:?}");
}

#[test]
fn mcp_profiles_are_opt_in_additive_and_gated_for_cloud_projects() {
    let env = TempHome::new();
    let p = env.project();
    let mcp = p.join(".cursor/mcp.json");
    assert_eq!(code(&env.with_kit(&["init", "--target", "cursor"])), 0);
    assert!(!mcp.exists(), "a fresh install carries no MCP config");

    write(
        &p,
        ".cursor/mcp.json",
        "{\"mcpServers\": {\"mine\": {\"command\": \"x\"}}}\n",
    );
    let out = env.with_kit(&[
        "init",
        "--target",
        "cursor",
        "--mcp-profiles",
        "github-context",
    ]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    let doc: Value = serde_json::from_str(&std::fs::read_to_string(&mcp).unwrap()).unwrap();
    assert!(doc["mcpServers"]["github"].is_object());
    assert_eq!(
        doc["mcpServers"]["mine"]["command"], "x",
        "the user's server stays"
    );

    // A typo is reported and skipped; the install itself still succeeds.
    let other = TempHome::new();
    let out = other.with_kit(&["init", "--target", "cursor", "--mcp-profiles", "nope"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    assert!(
        text(&out).contains("unknown MCP profile \"nope\""),
        "{}",
        text(&out)
    );
    assert!(!other.project().join(".cursor/mcp.json").exists());

    // A project with a git remote needs the second opt-in.
    let cloud = TempHome::new();
    let c = cloud.project();
    git(&c, &["init", "-q"]);
    git(
        &c,
        &["remote", "add", "origin", "https://example.invalid/x.git"],
    );
    let out = cloud.with_kit(&[
        "init",
        "--target",
        "cursor",
        "--mcp-profiles",
        "github-context",
    ]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    assert!(text(&out).contains("BLOCKED"), "{}", text(&out));
    assert!(!c.join(".cursor/mcp.json").exists());
    let out = cloud.with_kit(&[
        "init",
        "--target",
        "cursor",
        "--mcp-profiles",
        "github-context",
        "--allow-cloud-mcp",
    ]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    assert!(c.join(".cursor/mcp.json").is_file());
}

#[test]
fn without_a_terminal_a_missing_target_is_a_usage_error_naming_the_flag() {
    let env = TempHome::new();
    let out = env.with_kit(&["init"]);
    assert_eq!(code(&out), 2, "{}", text(&out));
    assert!(text(&out).contains("--target"), "{}", text(&out));
    assert!(sha_tree(&env.project()).is_empty());
    let out = env.with_kit(&["init", "--yes"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    assert!(
        env.project().join(".claude").is_dir(),
        "--yes means Claude Code"
    );
}

#[test]
fn the_kit_source_repo_is_refused_unless_allowed() {
    let env = TempHome::new();
    let p = env.project();
    write(&p, ".claude/keep", "");
    write(
        &p,
        "crates/mewkit-cli/Cargo.toml",
        "[package]\nname = \"mewkit-cli\"\n",
    );
    let out = env.with_kit(&["init", "--target", "codex"]);
    assert_eq!(code(&out), 1, "{}", text(&out));
    assert!(text(&out).contains("refusing to run in the MeowKit source repo"));
    let out = env.with_kit(&["init", "--target", "codex", "--dry-run"]);
    assert_ne!(
        code(&out),
        1,
        "a dry run changes nothing, so it is allowed: {}",
        text(&out)
    );
    let out = env.with_kit(&["init", "--target", "codex", "--allow-kit-source"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
}
