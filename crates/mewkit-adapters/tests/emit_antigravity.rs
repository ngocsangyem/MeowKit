//! The Antigravity emitter against this checkout's own kit: install, check the
//! forms Antigravity documents (https://antigravity.google/docs/skills and
//! /docs/rules, read 2026-11-22), strip back to the starting tree.
mod support;

use std::collections::BTreeMap;

use mewkit_adapters::Emitter;
use mewkit_adapters::antigravity::{Antigravity, NO_GUARDS};
use mewkit_adapters::codex::Codex;
use mewkit_adapters::contract::{EmitError, Op, Plan, Runtime, Scope};
use mewkit_adapters::placement_resolver::resolve;
use mewkit_adapters::surface_table::table;
use mewkit_adapters::{EmitRequest, agents_tree};
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
