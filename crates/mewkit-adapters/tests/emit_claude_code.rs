//! The Claude Code emitter against the kit this checkout publishes.
mod support;

use std::collections::BTreeMap;

use mewkit_adapters::Emitter;
use mewkit_adapters::claude_code::{ClaudeCode, SETTINGS};
use mewkit_adapters::contract::Op;
use serde_json::Value;
use support::{Project, kit, repo, request, sha_tree};

#[test]
fn fresh_project_installs_and_strips_to_nothing() {
    let kit = kit();
    let p = Project::new(ClaudeCode);
    let plan = ClaudeCode
        .prepare(&request(&kit, &p.scope, &[], &[]))
        .unwrap();
    let report = p.execute(&plan, &kit);
    assert!(report.preserved.is_empty(), "{:?}", report.preserved);

    let ours: Value = serde_json::from_str(&p.read(SETTINGS)).unwrap();
    let theirs: Value =
        serde_json::from_slice(&std::fs::read(kit.dir.join(SETTINGS)).unwrap()).unwrap();
    for key in ["hooks", "env", "statusLine"] {
        let mut want = theirs[key].clone();
        if let Some(events) = want.as_object_mut() {
            // Events with no handlers add nothing.
            events.retain(|_, v| v.as_array().is_none_or(|a| !a.is_empty()));
        }
        assert_eq!(ours[key], want, "{key}");
    }
    assert!(
        ours.get("permissions").is_none(),
        "permissions are reported, not merged"
    );

    let strip = ClaudeCode.plan_strip(&p.scope, &p.index()).unwrap();
    let report = p.execute(&strip, &kit);
    assert!(report.preserved.is_empty(), "{:?}", report.preserved);
    assert!(sha_tree(p.root()).is_empty(), "{:?}", sha_tree(p.root()));
}

#[test]
fn user_settings_survive_install_and_strip() {
    let kit = kit();
    let p = Project::new(ClaudeCode);
    let user = "{\n  \"model\": \"opus\",\n  \"hooks\": {\n    \"PreToolUse\": [\n      {\n        \"matcher\": \"Bash\",\n        \"hooks\": [\n          {\n            \"type\": \"command\",\n            \"command\": \"echo mine\"\n          }\n        ]\n      }\n    ]\n  }\n}\n";
    p.write(SETTINGS, user);
    let before = sha_tree(p.root());
    let plan = ClaudeCode
        .prepare(&request(&kit, &p.scope, &[], &[]))
        .unwrap();
    p.execute(&plan, &kit);
    let merged: Value = serde_json::from_str(&p.read(SETTINGS)).unwrap();
    assert_eq!(merged["model"], "opus");
    let bash = merged["hooks"]["PreToolUse"]
        .as_array()
        .unwrap()
        .iter()
        .find(|g| g["matcher"] == "Bash")
        .unwrap();
    assert_eq!(
        bash["hooks"][0]["command"], "echo mine",
        "the user's handler stays first"
    );
    assert!(bash["hooks"].as_array().unwrap().len() > 1);

    let strip = ClaudeCode.plan_strip(&p.scope, &p.index()).unwrap();
    p.execute(&strip, &kit);
    assert_eq!(sha_tree(p.root()), before);
}

#[test]
fn matches_the_npm_cli_baseline_except_listed_divergences() {
    let kit = kit();
    let p = Project::new(ClaudeCode);
    let plan = ClaudeCode
        .prepare(&request(&kit, &p.scope, &[], &[]))
        .unwrap();
    let baseline: Value = serde_json::from_slice(
        &std::fs::read(
            repo().join("crates/mewkit-cli/tests/golden/ts-baseline/claude-code.manifest.json"),
        )
        .unwrap(),
    )
    .unwrap();
    // What the npm CLI wrote that this install does not, by decision
    // (DIVERGENCES.md): settings.json is merged, not written; install metadata
    // and the npm CLI's own kit copy and state are not part of a runtime
    // install here.
    let kept_apart = |p: &str| {
        matches!(p, ".claude/settings.json" | ".meowkit/metadata.json")
            || p.starts_with(".meowkit/cache/")
            || p.starts_with(".meowkit/state/")
            || p.starts_with("~/")
    };
    // Written by both, with bytes that name the installing CLI: the launcher
    // pins its version and kind, the descriptor its absolute path. The
    // launcher's own parity test compares the template itself.
    let names_the_installer = |p: &str| matches!(p, ".meowkit/bin/mewkit" | ".claude/runtime.json");
    let ts: BTreeMap<&str, Option<&str>> = baseline["files"]
        .as_array()
        .unwrap()
        .iter()
        .map(|f| (f["path"].as_str().unwrap(), f["sha256"].as_str()))
        .filter(|(p, _)| !kept_apart(p))
        .collect();
    let ours: BTreeMap<&str, Vec<String>> = plan
        .ops
        .iter()
        .filter_map(|o| match o {
            Op::WriteFile { path, bytes, .. } => Some((path.as_str(), digests(bytes))),
            _ => None,
        })
        .collect();
    let only_ts: Vec<_> = ts.keys().filter(|p| !ours.contains_key(**p)).collect();
    assert!(only_ts.is_empty(), "missing vs TS: {only_ts:?}");
    let only_ours: Vec<_> = ours.keys().filter(|p| !ts.contains_key(**p)).collect();
    assert!(only_ours.is_empty(), "extra vs TS: {only_ours:?}");
    // Every non-volatile file carries the same bytes as the npm CLI's.
    let differ: Vec<_> = ts
        .iter()
        .filter(|(p, _)| !names_the_installer(p))
        .filter(|(p, digest)| digest.is_some_and(|d| !ours[**p].iter().any(|o| o == d)))
        .map(|(p, _)| p)
        .collect();
    assert!(differ.is_empty(), "bytes differ from TS: {differ:?}");
}

/// The digests a written file may match the baseline by.
///
/// The kit is read from this checkout's `.claude/`. A Windows checkout writes
/// git-converted text files with CRLF, while the baseline hashes the LF bytes
/// the npm CLI wrote, so on Windows the CRLF-folded bytes may match instead.
/// The raw bytes always count: git leaves binaries (a PNG header holds
/// `\r\n`) and files stored with CRLF as they are, and folding those would
/// break a correct match. Elsewhere only the exact bytes count.
fn digests(bytes: &[u8]) -> Vec<String> {
    let raw = mewkit_core::fsx::sha256_hex(bytes);
    if !cfg!(windows) {
        return vec![raw];
    }
    let mut folded = Vec::with_capacity(bytes.len());
    for (i, b) in bytes.iter().enumerate() {
        if *b == b'\r' && bytes.get(i + 1) == Some(&b'\n') {
            continue;
        }
        folded.push(*b);
    }
    vec![raw, mewkit_core::fsx::sha256_hex(&folded)]
}
