//! The Codex emitter against this checkout's own kit: install, compare with
//! the npm CLI baseline, strip back to the starting tree.
mod support;

use std::collections::BTreeSet;

use mewkit_adapters::Emitter;
use mewkit_adapters::codex::{AGENTS_MD_BUDGET, BUNDLE, Codex};
use mewkit_adapters::contract::{Op, Plan};
use serde_json::Value;
use support::{Project, kit, request, sha_tree};

#[test]
fn installs_into_a_project_and_strips_back_byte_for_byte() {
    let kit = kit();
    let p = Project::new(Codex);
    let user_agents = "# My agents\n\nKeep tests green.\n";
    let user_hooks = "{\n  \"hooks\": {\n    \"PreToolUse\": [\n      {\n        \"matcher\": \"Bash\",\n        \"hooks\": [\n          {\n            \"type\": \"command\",\n            \"command\": \"echo mine\"\n          }\n        ]\n      }\n    ]\n  }\n}\n";
    let user_config = "# mine\nmodel = \"gpt-5.4\"\n";
    p.write("AGENTS.md", user_agents);
    p.write(".codex/hooks.json", user_hooks);
    p.write(".codex/config.toml", user_config);
    let before = sha_tree(p.root());

    let plan = Codex.prepare(&request(&kit, &p.scope, &[], &[])).unwrap();
    let report = p.execute(&plan, &kit);
    assert!(report.preserved.is_empty(), "{:?}", report.preserved);

    let agents = p.read("AGENTS.md");
    assert!(agents.starts_with(user_agents));
    assert!(agents.contains("<!-- mewkit:begin meowkit -->"));
    let hooks: Value = serde_json::from_str(&p.read(".codex/hooks.json")).unwrap();
    let pre = hooks["hooks"]["PreToolUse"].as_array().unwrap();
    assert_eq!(
        pre[0]["hooks"].as_array().unwrap().len(),
        2,
        "kit handler joins the user's Bash group"
    );
    assert!(pre.iter().any(|g| g["matcher"] == "apply_patch|Edit|Write"));
    assert!(
        p.read(".codex/config.toml")
            .contains("project_doc_max_bytes = 32768")
    );
    assert!(p.read(".codex/config.toml").starts_with(user_config));

    let strip = Codex.plan_strip(&p.scope, &p.index()).unwrap();
    let report = p.execute(&strip, &kit);
    assert!(report.preserved.is_empty(), "{:?}", report.preserved);
    assert_eq!(sha_tree(p.root()), before);
}

#[test]
fn fresh_project_installs_and_strips_to_nothing() {
    let kit = kit();
    let p = Project::new(Codex);
    let plan = Codex.prepare(&request(&kit, &p.scope, &[], &[])).unwrap();
    p.execute(&plan, &kit);
    assert!(
        p.read("AGENTS.md")
            .starts_with("<!-- mewkit:begin meowkit -->")
    );
    let strip = Codex.plan_strip(&p.scope, &p.index()).unwrap();
    let report = p.execute(&strip, &kit);
    assert!(report.preserved.is_empty(), "{:?}", report.preserved);
    assert!(sha_tree(p.root()).is_empty(), "{:?}", sha_tree(p.root()));
}

#[test]
fn hook_tree_is_the_shared_closure_plus_the_codex_runtime_files() {
    let kit = kit();
    let p = Project::new(Codex);
    let plan = Codex.prepare(&request(&kit, &p.scope, &[], &[])).unwrap();
    let lib: BTreeSet<String> = written(&plan)
        .filter_map(|w| w.strip_prefix(".codex/hooks/lib/").map(str::to_owned))
        .collect();
    let closure: Value = serde_json::from_slice(
        &std::fs::read(kit.dir.join(".claude/hooks/core-closure.json")).unwrap(),
    )
    .unwrap();
    let mut want: BTreeSet<String> = closure["bundled"]
        .as_array()
        .unwrap()
        .iter()
        .map(|v| v.as_str().unwrap().to_owned())
        .collect();
    // The Codex shells' payload adapter, and the content check mk-intake requires.
    want.extend([
        "codex-hook-runtime.cjs".to_owned(),
        "validate-content.cjs".to_owned(),
    ]);
    assert_eq!(lib, want);
    assert!(written(&plan).any(|w| w == ".codex/hooks/hook-runtime-config.json"));
}

#[test]
fn matches_the_npm_cli_baseline_except_listed_divergences() {
    let kit = kit();
    let p = Project::new(Codex);
    let plan = Codex.prepare(&request(&kit, &p.scope, &[], &[])).unwrap();
    let baseline: Value = serde_json::from_slice(
        &std::fs::read(
            support::repo().join("crates/mewkit-cli/tests/golden/ts-baseline/codex.manifest.json"),
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
    // DIVERGENCES.md: the kit leaves skill test files out; the npm CLI keeps its
    // own ledger and metadata under .meowkit/; shared files are merged, not written.
    let only_ts: Vec<_> = ts
        .difference(&ours)
        .filter(|p| {
            !p.starts_with(".meowkit/")
                && !p.contains("/tests/")
                && !p.contains(".test.")
                && !matches!(
                    **p,
                    "AGENTS.md" | ".codex/hooks.json" | ".codex/config.toml"
                )
        })
        .collect();
    assert!(only_ts.is_empty(), "missing vs TS: {only_ts:?}");
    let only_ours: Vec<_> = ours.difference(&ts).collect();
    assert!(only_ours.is_empty(), "extra vs TS: {only_ours:?}");
}

#[test]
fn script_commands_are_root_anchored_and_the_gate_reports_findings() {
    let kit = kit();
    let p = Project::new(Codex);
    let plan = Codex.prepare(&request(&kit, &p.scope, &[], &[])).unwrap();
    let skill = text_of(&plan, ".agents/skills/mk-docs-finder/SKILL.md");
    assert!(
        skill.contains("node .agents/skills/mk-docs-finder/scripts/"),
        "commands rewritten"
    );
    assert!(
        !skill.contains("node scripts/"),
        "no skill-relative command left"
    );
    let block = plan.ops.iter().find_map(|o| match o {
        Op::MergeBlock { content, .. } => Some(content.len()),
        _ => None,
    });
    assert!(block.unwrap() <= AGENTS_MD_BUDGET);
    for n in plan
        .notices
        .iter()
        .filter(|n| n.starts_with("denied") || n.starts_with("dangling"))
    {
        assert!(
            [" at .agents/skills/", " at .codex/", " at AGENTS.md:"]
                .iter()
                .any(|at| n.contains(at)),
            "a finding names an installed file and line: {n}"
        );
    }
}

#[test]
fn packs_select_the_default_pack_and_its_dependencies() {
    let kit = kit();
    let p = Project::new(Codex);
    let plan = Codex
        .prepare(&request(
            &kit,
            &p.scope,
            &["development".into()],
            &["mk-angular".into()],
        ))
        .unwrap();
    let skills: BTreeSet<&str> = written(&plan)
        .filter_map(|w| {
            w.strip_prefix(".agents/skills/")?
                .split_once('/')
                .map(|(s, _)| s)
        })
        .collect();
    assert!(skills.contains("mk-cook"), "core pack is always in");
    assert!(skills.contains("mk-database"), "named pack is in");
    assert!(!skills.contains("mk-angular"), "disabled skill is out");
    assert!(!skills.contains("mk-jira"), "other packs stay out");
    let all = Codex.prepare(&request(&kit, &p.scope, &[], &[])).unwrap();
    assert!(written(&all).count() > written(&plan).count());
    assert!(
        kit.dir
            .join(BUNDLE)
            .join("catalog/skill-packs.json")
            .is_file()
    );
}

fn written(plan: &Plan) -> impl Iterator<Item = &str> {
    plan.ops.iter().filter_map(|o| match o {
        Op::WriteFile { path, .. } => Some(path.as_str()),
        _ => None,
    })
}

fn text_of<'a>(plan: &'a Plan, path: &str) -> &'a str {
    plan.ops
        .iter()
        .find_map(|o| match o {
            Op::WriteFile { path: p, bytes, .. } if p.as_str() == path => {
                std::str::from_utf8(bytes).ok()
            }
            _ => None,
        })
        .unwrap_or_else(|| panic!("{path} not written"))
}

/// `cargo test -p mewkit-adapters --test emit_codex -- --ignored --nocapture`
/// prints the gate report for this checkout's Codex bundle.
#[test]
#[ignore = "maintainer report, not a check"]
fn print_gate_report() {
    let kit = kit();
    let p = Project::new(Codex);
    let started = std::time::Instant::now();
    let plan = Codex.prepare(&request(&kit, &p.scope, &[], &[])).unwrap();
    eprintln!("prepare: {:?}, {} ops", started.elapsed(), plan.ops.len());
    for n in &plan.notices {
        eprintln!("{n}");
    }
}

/// A JSON merge re-renders the file with 2-space indentation, so a user file in
/// another layout comes back with the same values in the same order, not the
/// same bytes (ADR 261110-rust-adapter-contract). Untouched files keep their bytes.
#[test]
fn a_tab_indented_user_hooks_file_keeps_its_values() {
    let kit = kit();
    let p = Project::new(Codex);
    let user = "{\n\t\"hooks\": {\n\t\t\"Stop\": [\n\t\t\t{\n\t\t\t\t\"hooks\": [\n\t\t\t\t\t{ \"type\": \"command\", \"command\": \"mine\" }\n\t\t\t\t]\n\t\t\t}\n\t\t]\n\t},\n\t\"z\": 1e3\n}\n";
    p.write(".codex/hooks.json", user);
    let plan = Codex.prepare(&request(&kit, &p.scope, &[], &[])).unwrap();
    p.execute(&plan, &kit);
    let strip = Codex.plan_strip(&p.scope, &p.index()).unwrap();
    p.execute(&strip, &kit);
    let back: Value = serde_json::from_str(&p.read(".codex/hooks.json")).unwrap();
    assert_eq!(back, serde_json::from_str::<Value>(user).unwrap());
}
