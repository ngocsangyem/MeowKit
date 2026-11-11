//! The Claude Code emitter against the kit this checkout publishes.
mod support;

use std::collections::BTreeSet;

use mewkit_adapters::Emitter;
use mewkit_adapters::claude_code::{ClaudeCode, SETTINGS};
use mewkit_adapters::contract::{Op, Plan};
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
    let ts: BTreeSet<&str> = baseline["files"]
        .as_array()
        .unwrap()
        .iter()
        .map(|f| f["path"].as_str().unwrap())
        .filter(|p| p.starts_with(".claude/"))
        .collect();
    let ours: BTreeSet<&str> = written(&plan).collect();
    // DIVERGENCES.md: settings.json is merged, not written; runtime.json is the
    // npm CLI's own launcher record.
    let only_ts: Vec<_> = ts
        .difference(&ours)
        .filter(|p| !matches!(**p, ".claude/settings.json" | ".claude/runtime.json"))
        .collect();
    assert!(only_ts.is_empty(), "missing vs TS: {only_ts:?}");
    let only_ours: Vec<_> = ours.difference(&ts).collect();
    assert!(only_ours.is_empty(), "extra vs TS: {only_ours:?}");
}

fn written(plan: &Plan) -> impl Iterator<Item = &str> {
    plan.ops.iter().filter_map(|o| match o {
        Op::WriteFile { path, .. } => Some(path.as_str()),
        _ => None,
    })
}
