//! Which `.claude/` files a Claude Code install carries for a pack selection,
//! and that it agrees with the npm CLI's resolver for every shipped profile.
mod support;

use std::collections::BTreeSet;
use std::process::Command;

use mewkit_adapters::Emitter;
use mewkit_adapters::claude_code::ClaudeCode;
use mewkit_adapters::contract::{Op, Plan};
use mewkit_core::validate::{load_pack_manifest, resolve_profile};
use support::{Project, kit, repo, request};

fn claude_files(plan: &Plan) -> BTreeSet<String> {
    plan.ops
        .iter()
        .filter_map(|o| match o {
            Op::WriteFile { path, .. } => path.as_str().strip_prefix(".claude/").map(str::to_owned),
            _ => None,
        })
        .collect()
}

fn names(list: &[&str]) -> Vec<String> {
    list.iter().map(|s| (*s).to_owned()).collect()
}

#[test]
fn no_packs_installs_the_whole_tree() {
    let kit = kit();
    let p = Project::new(ClaudeCode);
    let full = ClaudeCode
        .prepare(&request(&kit, &p.scope, &[], &[]))
        .unwrap();
    let packs = names(&["lifecycle-core"]);
    let some = ClaudeCode
        .prepare(&request(&kit, &p.scope, &packs, &[]))
        .unwrap();
    let (full, some) = (claude_files(&full), claude_files(&some));
    assert!(some.len() < full.len(), "a pack subset installs less");
    assert!(some.is_subset(&full));
}

#[test]
fn a_subset_keeps_base_and_leaves_other_domains_out() {
    let kit = kit();
    let p = Project::new(ClaudeCode);
    let packs = names(&["lifecycle-core"]);
    let plan = ClaudeCode
        .prepare(&request(&kit, &p.scope, &packs, &[]))
        .unwrap();
    let files = claude_files(&plan);
    for must in ["rules/gate-rules.md", "rules/security-rules.md"] {
        assert!(files.contains(must), "base file {must} is always installed");
    }
    assert!(
        plan.ops.iter().any(|o| matches!(o, Op::MergeHooks { .. })),
        "settings.json is base, so its hooks are still merged"
    );
    assert!(
        !files.iter().any(|f| f.starts_with("skills/jira")),
        "the atlassian domain is not part of lifecycle-core"
    );
}

#[test]
fn an_unknown_pack_is_refused_naming_what_exists() {
    let kit = kit();
    let p = Project::new(ClaudeCode);
    let packs = names(&["nope"]);
    let err = ClaudeCode
        .prepare(&request(&kit, &p.scope, &packs, &[]))
        .unwrap_err()
        .to_string();
    assert!(
        err.contains("unknown pack \"nope\"") && err.contains("available:"),
        "{err}"
    );
}

#[test]
fn a_disabled_skill_leaves_its_directory_out() {
    let kit = kit();
    let p = Project::new(ClaudeCode);
    let base = claude_files(
        &ClaudeCode
            .prepare(&request(&kit, &p.scope, &[], &[]))
            .unwrap(),
    );
    let skill = base
        .iter()
        .find_map(|f| f.strip_prefix("skills/").and_then(|r| r.split_once('/')))
        .map(|(dir, _)| dir.to_owned())
        .expect("the kit ships skills");
    let off = names(&[&format!("mk:{skill}")]);
    let plan = ClaudeCode
        .prepare(&request(&kit, &p.scope, &[], &off))
        .unwrap();
    assert!(
        !claude_files(&plan)
            .iter()
            .any(|f| f.starts_with(&format!("skills/{skill}/")))
    );
}

#[test]
fn the_plugin_envelope_is_one_metadata_file() {
    let op = mewkit_adapters::claude_code::plugin_manifest("1.2.3").unwrap();
    let Op::WriteFile { path, bytes, .. } = op else {
        panic!("a written file");
    };
    assert_eq!(path.as_str(), ".claude-plugin/plugin.json");
    let doc: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(doc["name"], "meowkit");
    assert_eq!(doc["version"], "1.2.3");
    assert!(doc.get("skills").is_none() && doc.get("agents").is_none());
}

/// The npm CLI's `resolveProfile` over the same kit tree, as a sorted list.
fn ts_profile(profile: &str, claude_dir: &std::path::Path) -> Vec<String> {
    let dist = repo().join("packages/mewkit/dist/core");
    let script = format!(
        "const m = await import('file://{d}/pack-manifest.js'); \
         const r = await import('file://{d}/pack-resolver.js'); \
         const dir = process.argv[1]; \
         const set = r.resolveProfile(dir, m.loadPackManifest(dir), process.argv[2]); \
         console.log(JSON.stringify([...set].sort()));",
        d = dist.display()
    );
    let out = Command::new("node")
        .args(["--input-type=module", "-e", &script])
        .arg(claude_dir)
        .arg(profile)
        .output()
        .expect("node is installed");
    assert!(
        out.status.success(),
        "{}",
        String::from_utf8_lossy(&out.stderr)
    );
    serde_json::from_slice(&out.stdout).unwrap()
}

#[test]
#[ignore = "needs node and the TS build"]
fn every_profile_resolves_to_the_npm_cli_set() {
    let kit = kit();
    let claude = kit.dir.join(".claude");
    let manifest = load_pack_manifest(&claude).unwrap();
    for profile in manifest.available_profiles() {
        let ours: Vec<String> = resolve_profile(&claude, &manifest, profile)
            .unwrap()
            .paths
            .into_iter()
            .collect();
        assert_eq!(ours, ts_profile(profile, &claude), "profile {profile}");
    }
}
