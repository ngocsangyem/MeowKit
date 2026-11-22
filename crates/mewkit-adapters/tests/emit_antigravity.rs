//! The Antigravity emitter against this checkout's own kit: install, check the
//! forms Antigravity documents (https://antigravity.google/docs/skills and
//! /docs/rules, read 2026-11-22), strip back to the starting tree.
mod support;

use std::collections::BTreeMap;

use mewkit_adapters::Emitter;
use mewkit_adapters::antigravity::{Antigravity, NO_GUARDS, rules};
use mewkit_adapters::codex::Codex;
use mewkit_adapters::contract::{EmitError, Op, Plan, Runtime, Scope};
use mewkit_adapters::placement_resolver::resolve;
use mewkit_adapters::surface_table::table;
use mewkit_adapters::{EmitRequest, agents_block, agents_tree};
use support::{Project, kit, request, sha_tree};

fn written(plan: &Plan) -> BTreeMap<&str, &[u8]> {
    plan.ops
        .iter()
        .filter_map(|op| match op {
            Op::WriteFile { path, bytes, .. } => Some((path.as_str(), bytes.as_slice())),
            _ => None,
        })
        .collect()
}

#[test]
fn installs_beside_the_users_files_and_strips_back_byte_for_byte() {
    let kit = kit();
    let p = Project::new(Antigravity);
    p.write("AGENTS.md", "# Mine\n");
    p.write(
        ".agents/skills/mine/SKILL.md",
        "---\nname: mine\ndescription: d\n---\n",
    );
    let before = sha_tree(p.root());

    let plan = Antigravity
        .prepare(&request(&kit, &p.scope, &[], &[]))
        .unwrap();
    let report = p.execute(&plan, &kit);
    assert!(report.preserved.is_empty(), "{:?}", report.preserved);
    assert!(p.read("AGENTS.md").starts_with("# Mine\n"));
    assert!(
        p.read("AGENTS.md")
            .contains("<!-- mewkit:begin meowkit -->")
    );
    assert!(p.root().join(".agents/skills/mk-cook/SKILL.md").is_file());
    assert!(p.root().join(".agents/skills/mine/SKILL.md").is_file());

    let strip = Antigravity.plan_strip(&p.scope, &p.index()).unwrap();
    let report = p.execute(&strip, &kit);
    assert!(report.preserved.is_empty(), "{:?}", report.preserved);
    assert_eq!(sha_tree(p.root()), before);
}

#[test]
fn skills_are_invoked_by_slash_and_no_hook_file_is_written() {
    let kit = kit();
    let p = Project::new(Antigravity);
    let plan = Antigravity
        .prepare(&request(&kit, &p.scope, &[], &[]))
        .unwrap();
    let files = written(&plan);
    let skill = std::str::from_utf8(files[".agents/skills/mk-cook/SKILL.md"]).unwrap();
    assert!(skill.starts_with("---\nname: \"mk-cook\"") || skill.starts_with("---\nname: mk-cook"));
    assert!(!skill.contains("$mk-") && !skill.contains("/skill:mk-"));
    assert!(!files.contains_key(".agents/hooks.json"));
    assert!(!files.keys().any(|path| path.starts_with(".agents/hooks/")));
    assert!(
        plan.notices.iter().any(|n| n == NO_GUARDS),
        "{:?}",
        plan.notices
    );
}

#[test]
fn it_writes_the_bytes_codex_writes_into_the_tree_they_share() {
    let kit = kit();
    let p = Project::new(Codex);
    let set = [Runtime::Codex, Runtime::Antigravity];
    let placement = resolve(table(), &set);
    let req = EmitRequest {
        placement: Some(&placement),
        ..request(&kit, &p.scope, &[], &[])
    };
    let codex = Codex.prepare(&req).unwrap();
    let antigravity = Antigravity.prepare(&req).unwrap();
    let shared = |plan: &Plan| -> BTreeMap<String, Vec<u8>> {
        written(plan)
            .into_iter()
            .filter(|(path, _)| path.starts_with(".agents/"))
            .map(|(path, bytes)| (path.to_owned(), bytes.to_vec()))
            .collect()
    };
    let tree = shared(&codex);
    assert!(tree.len() > 500);
    let mine = shared(&antigravity);
    assert!(
        tree.keys().all(|path| mine.get(path) == tree.get(path)),
        "Antigravity writes a different shared tree"
    );
    assert!(agents_tree::WRITERS.contains(&Runtime::Antigravity));
}

#[test]
fn a_finding_about_the_installed_text_names_its_file_and_line() {
    let kit = kit();
    let p = Project::new(Antigravity);
    let plan = Antigravity
        .prepare(&request(&kit, &p.scope, &[], &[]))
        .unwrap();
    for n in plan
        .notices
        .iter()
        .filter(|n| n.starts_with("denied") || n.starts_with("dangling"))
    {
        assert!(
            n.contains(" at .agents/") || n.contains(" at AGENTS.md:"),
            "a finding names an installed file and line: {n}"
        );
    }
}

#[test]
fn a_user_level_install_is_refused() {
    let kit = kit();
    let home = tempfile::tempdir().unwrap();
    let scope = Scope::global(home.path(), |_| None).unwrap();
    let err = Antigravity
        .prepare(&request(&kit, &scope, &[], &[]))
        .unwrap_err();
    assert!(matches!(err, EmitError::Unsupported { .. }), "{err}");
}

/// https://antigravity.google/docs/rules: a rule file needs a `trigger`, is cut
/// at 24,000 bytes, and only the files directly in `.agents/rules/` are read.
#[test]
fn rule_files_have_a_trigger_fit_the_cut_and_leave_the_safety_text_in_the_block() {
    let kit = kit();
    let p = Project::new(Antigravity);
    let plan = Antigravity
        .prepare(&request(&kit, &p.scope, &[], &[]))
        .unwrap();
    let files = written(&plan);
    let rules: Vec<(&&str, &&[u8])> = files
        .iter()
        .filter(|(path, _)| path.starts_with(".agents/rules/"))
        .collect();
    assert!(!rules.is_empty());
    for (path, bytes) in rules {
        let text = std::str::from_utf8(bytes).unwrap();
        assert!(bytes.len() <= 24_000, "{path}");
        assert!(rules::check(path, text).is_ok(), "{path}");
        assert_eq!(path.matches('/').count(), 2, "{path} is below the folder");
        // The safety text is in the AGENTS.md block alone.
        for marker in ["NON-NEGOTIABLE", "Rule of Two", "Hardcoded secrets"] {
            assert!(!text.contains(marker), "{path} repeats {marker}");
        }
    }
    // The 32 KiB guard on the block still holds beside the rule files.
    assert!(
        plan.ops
            .iter()
            .any(|op| matches!(op, Op::MergeBlock { content, .. }
            if content.len() <= agents_block::BUDGET))
    );
}

/// https://antigravity.google/docs/subagents: `tools` is an explicit list of the
/// runtime's own names and `model` is `inherit`, `flash` or `pro`.
#[test]
fn agents_carry_antigravity_tool_names_a_known_model_and_are_not_main_agents() {
    let kit = kit();
    let p = Project::new(Antigravity);
    let plan = Antigravity
        .prepare(&request(&kit, &p.scope, &[], &[]))
        .unwrap();
    let files = written(&plan);
    let agents: Vec<&str> = files
        .keys()
        .copied()
        .filter(|path| path.starts_with(".agents/agents/"))
        .collect();
    assert!(agents.len() > 30, "{}", agents.len());
    let reviewer = std::str::from_utf8(files[".agents/agents/reviewer.md"]).unwrap();
    let front = reviewer.split("\n---\n").next().unwrap();
    assert!(front.contains("\nname: reviewer\n"), "{front}");
    assert!(front.contains("\nmodel: "), "{front}");
    assert!(front.contains("\nmainAgent: false\n"), "{front}");
    let tools = front
        .lines()
        .find_map(|line| line.strip_prefix("tools: ["))
        .and_then(|rest| rest.strip_suffix(']'))
        .unwrap();
    for tool in tools.split(", ") {
        assert!(
            tool.chars().all(|c| c.is_ascii_lowercase() || c == '_'),
            "{tool}"
        );
    }
    for path in agents {
        let text = std::str::from_utf8(files[path]).unwrap();
        let model = text
            .lines()
            .find_map(|line| line.strip_prefix("model: "))
            .unwrap();
        assert!(
            ["inherit", "flash", "pro"].contains(&model),
            "{path}: {model}"
        );
    }
    assert!(!files.contains_key(".agents/agents/orchestrator.md"));
    assert!(
        plan.notices
            .iter()
            .any(|n| n.contains("no tool for") && n.contains("TaskCreate")),
        "{:?}",
        plan.notices
    );
}

#[test]
fn a_rule_file_without_a_trigger_is_refused_before_anything_is_written() {
    let mut plan = Plan::default();
    plan.ops.push(Op::WriteFile {
        path: mewkit_adapters::contract::RelPath::new(".agents/rules/mine.md").unwrap(),
        bytes: b"---\ndescription: d\n---\nBody\n".to_vec(),
        mode: None,
    });
    let err = rules::check_plan(&plan).unwrap_err();
    assert!(err.to_string().contains("no `trigger`"), "{err}");
}
