//! Pi, OMP, Codex and Antigravity on the `.agents/` tree they share, against this
//! checkout's own kit.
mod support;

use std::collections::BTreeMap;

use mewkit_adapters::codex::Codex;
use mewkit_adapters::contract::{EmitError, Kit, Plan, Runtime, Scope};
use mewkit_adapters::omp::{CONFIG, HOOK, Omp};
use mewkit_adapters::pi::{EXTENSION, Pi};
use mewkit_adapters::placement_resolver::resolve;
use mewkit_adapters::surface_table::table;
use mewkit_adapters::{EmitRequest, Emitter, agents_tree};
use support::{Project, kit, request, sha_tree, written};

/// `emitter`'s plan for a project where `set` is installed.
fn plan_among(emitter: &dyn Emitter, kit: &Kit, scope: &Scope, set: &[Runtime]) -> Plan {
    let placement = resolve(table(), set);
    let req = EmitRequest {
        placement: Some(&placement),
        ..request(kit, scope, &[], &[])
    };
    emitter.prepare(&req).unwrap()
}

fn text<'a>(files: &BTreeMap<&str, &'a [u8]>, path: &str) -> &'a str {
    std::str::from_utf8(files[path]).unwrap()
}

#[test]
fn pi_alone_installs_its_own_wording_and_strips_to_nothing() {
    let kit = kit();
    let p = Project::new(Pi);
    let plan = plan_among(&Pi, &kit, &p.scope, &[Runtime::Pi]);
    let files = written(&plan);
    assert!(files.contains_key(EXTENSION));
    assert!(files.contains_key(agents_tree::GUARD));
    // "`/skill:name` forces loading" (Pi docs/skills.md).
    assert!(text(&files, ".agents/skills/mk-cook/SKILL.md").contains("/skill:mk-"));
    assert!(!files.keys().any(|path| path.starts_with(".pi/skills/")));
    assert!(!files.keys().any(|path| path.starts_with(".pi/agents/")));

    p.execute(&plan, &kit);
    let strip = Pi.plan_strip(&p.scope, &p.index()).unwrap();
    let report = p.execute(&strip, &kit);
    assert!(report.preserved.is_empty(), "{:?}", report.preserved);
    assert!(sha_tree(p.root()).is_empty(), "{:?}", sha_tree(p.root()));
}

#[test]
fn omp_agents_carry_built_in_tool_names_only() {
    let kit = kit();
    let p = Project::new(Omp);
    let plan = plan_among(&Omp, &kit, &p.scope, &[Runtime::Omp]);
    let files = written(&plan);
    assert!(files.contains_key(HOOK));
    assert!(
        !files.contains_key(CONFIG),
        "no foreign folder to switch off"
    );
    let reviewer = text(&files, ".omp/agents/reviewer.md");
    let tools = reviewer
        .lines()
        .find_map(|line| line.strip_prefix("tools: "))
        .unwrap();
    for tool in tools.split(", ") {
        assert!(
            tool.chars().all(|c| c.is_ascii_lowercase() || c == '_'),
            "{tool}"
        );
    }
    assert!(!reviewer.contains("\nmodel:"));
    assert!(
        plan.notices
            .iter()
            .any(|n| n.contains("no built-in tool for") && n.contains("WebFetch")),
        "{:?}",
        plan.notices
    );

    p.execute(&plan, &kit);
    let strip = Omp.plan_strip(&p.scope, &p.index()).unwrap();
    let report = p.execute(&strip, &kit);
    assert!(report.preserved.is_empty(), "{:?}", report.preserved);
    assert!(sha_tree(p.root()).is_empty(), "{:?}", sha_tree(p.root()));
}

#[test]
fn the_three_write_the_same_bytes_into_the_tree_they_share() {
    let kit = kit();
    let p = Project::new(Codex);
    let set = [Runtime::Codex, Runtime::Pi, Runtime::Omp];
    let codex = plan_among(&Codex, &kit, &p.scope, &set);
    let pi = plan_among(&Pi, &kit, &p.scope, &set);
    let omp = plan_among(&Omp, &kit, &p.scope, &set);
    let shared = |plan: &Plan| -> BTreeMap<String, Vec<u8>> {
        written(plan)
            .into_iter()
            .filter(|(path, _)| path.starts_with(".agents/"))
            .map(|(path, bytes)| (path.to_owned(), bytes.to_vec()))
            .collect()
    };
    let tree = shared(&codex);
    assert!(tree.len() > 500);
    assert!(tree == shared(&pi), "Pi writes a different shared tree");
    assert!(tree == shared(&omp), "OMP writes a different shared tree");
    let skill = std::str::from_utf8(&tree[".agents/skills/mk-cook/SKILL.md"]).unwrap();
    for form in ["$mk-", "/skill:mk-", ".codex/"] {
        assert!(!skill.contains(form), "{form} is one runtime's own form");
    }
}

#[test]
fn codex_alone_keeps_its_own_wording() {
    let kit = kit();
    let p = Project::new(Codex);
    let plan = plan_among(&Codex, &kit, &p.scope, &[Runtime::Codex, Runtime::Cursor]);
    let files = written(&plan);
    assert!(text(&files, ".agents/skills/mk-cook/SKILL.md").contains("$mk-"));
    assert!(
        !files
            .keys()
            .any(|path| path.starts_with(".agents/meowkit/"))
    );
}

#[test]
fn omp_beside_claude_code_switches_the_second_copy_off() {
    let kit = kit();
    let p = Project::new(Omp);
    let plan = plan_among(&Omp, &kit, &p.scope, &[Runtime::ClaudeCode, Runtime::Omp]);
    let files = written(&plan);
    assert_eq!(text(&files, CONFIG), "disabledProviders: [claude]\n");
}

#[test]
fn neither_installs_into_the_home_directory() {
    let kit = kit();
    let home = tempfile::tempdir().unwrap();
    let scope = Scope::global(home.path(), |_| None).unwrap();
    for emitter in [&Pi as &dyn Emitter, &Omp] {
        let err = emitter
            .prepare(&request(&kit, &scope, &[], &[]))
            .unwrap_err();
        assert!(matches!(err, EmitError::Unsupported { .. }), "{err}");
    }
}

#[test]
fn a_fourth_writer_makes_a_pair_write_the_shared_wording() {
    let kit = kit();
    let p = Project::new(Pi);
    // Pi alone says "/skill:mk-"; beside any other writer, including
    // Antigravity, it writes the wording every reader can follow.
    let alone = plan_among(&Pi, &kit, &p.scope, &[Runtime::Pi]);
    assert!(text(&written(&alone), ".agents/skills/mk-cook/SKILL.md").contains("/skill:mk-"));
    for other in [Runtime::Codex, Runtime::Omp, Runtime::Antigravity] {
        let plan = plan_among(&Pi, &kit, &p.scope, &[Runtime::Pi, other]);
        let files = written(&plan);
        let skill = text(&files, ".agents/skills/mk-cook/SKILL.md");
        assert!(!skill.contains("/skill:mk-"), "{other:?}");
    }
    assert!(agents_tree::WRITERS.contains(&Runtime::Antigravity));
}
