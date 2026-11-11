//! The Cursor emitter against this checkout's own kit: install, compare with
//! the npm CLI baseline, strip back to the starting tree.
mod support;

use std::collections::BTreeSet;

use mewkit_adapters::Emitter;
use mewkit_adapters::codex::Codex;
use mewkit_adapters::contract::{Op, Plan};
use mewkit_adapters::cursor::{AGENT_KEYS, BLOCKING, CORE_RULE, Cursor, HOOKS_JSON};
use serde_json::Value;
use support::{Project, kit, request, sha_tree};

#[test]
fn installs_into_a_project_and_strips_back_byte_for_byte() {
    let kit = kit();
    let p = Project::new(Cursor);
    let user_hooks = "{\n  \"version\": 1,\n  \"hooks\": {\n    \"preToolUse\": [\n      {\n        \"command\": \"echo mine\"\n      }\n    ]\n  }\n}\n";
    let user_rule = "---\nalwaysApply: false\n---\nmine\n";
    p.write(HOOKS_JSON, user_hooks);
    p.write(".cursor/rules/mine.mdc", user_rule);
    let before = sha_tree(p.root());

    let plan = Cursor.prepare(&request(&kit, &p.scope, &[], &[])).unwrap();
    let report = p.execute(&plan, &kit);
    assert!(report.preserved.is_empty(), "{:?}", report.preserved);
    let hooks: Value = serde_json::from_str(&p.read(HOOKS_JSON)).unwrap();
    let pre = hooks["hooks"]["preToolUse"].as_array().unwrap();
    assert_eq!(
        pre[0]["command"], "echo mine",
        "the user's handler stays first"
    );
    assert_eq!(pre.len(), 4, "three kit handlers beside it");
    assert!(
        p.read(CORE_RULE)
            .starts_with("---\nalwaysApply: true\n---\n")
    );

    let strip = Cursor.plan_strip(&p.scope, &p.index()).unwrap();
    let report = p.execute(&strip, &kit);
    assert!(report.preserved.is_empty(), "{:?}", report.preserved);
    assert_eq!(sha_tree(p.root()), before);
}

#[test]
fn fresh_project_installs_and_strips_to_nothing() {
    let kit = kit();
    let p = Project::new(Cursor);
    let plan = Cursor.prepare(&request(&kit, &p.scope, &[], &[])).unwrap();
    p.execute(&plan, &kit);
    let strip = Cursor.plan_strip(&p.scope, &p.index()).unwrap();
    let report = p.execute(&strip, &kit);
    assert!(report.preserved.is_empty(), "{:?}", report.preserved);
    assert!(sha_tree(p.root()).is_empty(), "{:?}", sha_tree(p.root()));
}

#[test]
fn every_blocking_hook_fails_closed() {
    let kit = kit();
    let p = Project::new(Cursor);
    let plan = Cursor.prepare(&request(&kit, &p.scope, &[], &[])).unwrap();
    let mut blocking = 0;
    for op in &plan.ops {
        if let Op::MergeHooks {
            event, handlers, ..
        } = op
            && BLOCKING.contains(&event.as_str())
        {
            for h in handlers {
                assert_eq!(h.handler["failClosed"], true, "{event}: {}", h.handler);
                blocking += 1;
            }
        }
    }
    assert!(blocking >= 6, "the bundle's gates are planned: {blocking}");
}

#[test]
fn codex_then_cursor_share_a_project_and_only_codex_touches_agents_md() {
    let kit = kit();
    let codex = Project::new(Codex);
    let user_agents = "# Mine\n\nKeep it short.\n";
    codex.write("AGENTS.md", user_agents);
    let cursor = codex.alongside(Cursor);

    codex.execute(
        &Codex
            .prepare(&request(&kit, &codex.scope, &[], &[]))
            .unwrap(),
        &kit,
    );
    let plan = Cursor
        .prepare(&request(&kit, &cursor.scope, &[], &[]))
        .unwrap();
    assert!(
        plan.ops.iter().all(|o| o.path().as_str() != "AGENTS.md"),
        "Cursor plans nothing on AGENTS.md"
    );
    cursor.execute(&plan, &kit);

    let agents = codex.read("AGENTS.md");
    assert!(agents.starts_with(user_agents), "user text unchanged");
    assert_eq!(agents.matches("<!-- mewkit:begin meowkit -->").count(), 1);
    assert!(codex.index().sections["AGENTS.md"].contains_key("meowkit"));
    assert!(!cursor.index().sections.contains_key("AGENTS.md"));
}

#[test]
fn rules_and_agents_carry_only_what_cursor_reads() {
    let kit = kit();
    let p = Project::new(Cursor);
    let plan = Cursor.prepare(&request(&kit, &p.scope, &[], &[])).unwrap();
    let rules: Vec<&str> = written(&plan)
        .filter(|w| w.starts_with(".cursor/rules/"))
        .collect();
    assert!(rules.contains(&CORE_RULE) && rules.len() >= 6, "{rules:?}");
    let mut agents = 0;
    for (path, text) in texts(&plan).filter(|(p, _)| p.starts_with(".cursor/agents/")) {
        agents += 1;
        // A Windows checkout has CRLF; agents with nothing to drop pass through as is.
        let text = text.replace("\r\n", "\n");
        let front = text.split("\n---\n").next().unwrap();
        for line in front.lines().skip(1).filter(|l| !l.starts_with([' ', '-'])) {
            let key = line.split(':').next().unwrap();
            assert!(AGENT_KEYS.contains(&key), "{path}: `{key}`");
        }
    }
    assert!(agents > 0);
}

#[test]
fn matches_the_npm_cli_baseline_except_listed_divergences() {
    let kit = kit();
    let p = Project::new(Cursor);
    let plan = Cursor.prepare(&request(&kit, &p.scope, &[], &[])).unwrap();
    let baseline: Value = serde_json::from_slice(
        &std::fs::read(
            support::repo().join("crates/mewkit-cli/tests/golden/ts-baseline/cursor.manifest.json"),
        )
        .unwrap(),
    )
    .unwrap();
    let ts: BTreeSet<&str> = baseline["files"]
        .as_array()
        .unwrap()
        .iter()
        .map(|f| f["path"].as_str().unwrap())
        .collect();
    let ours: BTreeSet<&str> = written(&plan).collect();
    // DIVERGENCES.md: skill tests are not in the kit; .meowkit/ is the npm CLI's
    // own state; hooks.json is merged; AGENTS.md is installed as the core rule.
    let only_ts: Vec<_> = ts
        .difference(&ours)
        .filter(|p| {
            !p.starts_with(".meowkit/")
                && !p.contains("/tests/")
                && !p.contains(".test.")
                && !matches!(**p, "AGENTS.md" | HOOKS_JSON)
        })
        .collect();
    assert!(only_ts.is_empty(), "missing vs TS: {only_ts:?}");
    let only_ours: Vec<_> = ours.difference(&ts).filter(|p| **p != CORE_RULE).collect();
    assert!(only_ours.is_empty(), "extra vs TS: {only_ours:?}");
}

#[test]
fn a_claude_skills_tree_in_the_project_is_reported() {
    let kit = kit();
    let p = Project::new(Cursor);
    p.write(".claude/skills/x/SKILL.md", "---\nname: x\n---\n");
    let plan = Cursor.prepare(&request(&kit, &p.scope, &[], &[])).unwrap();
    assert!(plan.notices.iter().any(|n| n.contains(".claude/skills")));
}

fn written(plan: &Plan) -> impl Iterator<Item = &str> {
    texts(plan).map(|(p, _)| p)
}

fn texts(plan: &Plan) -> impl Iterator<Item = (&str, &str)> {
    plan.ops.iter().filter_map(|o| match o {
        Op::WriteFile { path, bytes, .. } => {
            Some((path.as_str(), std::str::from_utf8(bytes).unwrap_or("")))
        }
        _ => None,
    })
}

/// `cargo test -p mewkit-adapters --test emit_cursor -- --ignored --nocapture`
/// prints the gate report for this checkout's Cursor bundle.
#[test]
#[ignore = "maintainer report, not a check"]
fn print_gate_report() {
    let kit = kit();
    let p = Project::new(Cursor);
    let started = std::time::Instant::now();
    let plan = Cursor.prepare(&request(&kit, &p.scope, &[], &[])).unwrap();
    eprintln!("prepare: {:?}, {} ops", started.elapsed(), plan.ops.len());
    for n in &plan.notices {
        eprintln!("{n}");
    }
}
