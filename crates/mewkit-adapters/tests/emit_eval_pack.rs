//! The opt-in eval pack, for every registered emitter: a default plan carries
//! nothing of it, and selecting it adds exactly the kit's case files under
//! `.meowkit/eval/` and changes nothing else, in particular no skills tree.
mod support;

use std::collections::BTreeSet;

use mewkit_adapters::contract::{Op, OwnershipIndex, Plan};
use mewkit_adapters::eval_pack::{INSTALL_DIR, KIT_DIR, PACK};
use mewkit_adapters::{Emitter, Runtime, Scope, registry};
use mewkit_core::ownership::Origin;

fn paths(plan: &Plan) -> BTreeSet<String> {
    plan.ops.iter().map(|op| op.path().to_string()).collect()
}

fn plan(e: &dyn Emitter, scope: &Scope, packs: &[String]) -> Plan {
    let kit = support::kit();
    e.prepare(&support::request(&kit, scope, packs, &[]))
        .unwrap_or_else(|err| panic!("{}: {err}", e.target().name()))
}

/// What the kit carries for the pack, as the install paths it maps to.
fn pack_files() -> BTreeSet<String> {
    let src = support::kit().dir.join(KIT_DIR);
    let mut out = BTreeSet::new();
    let mut todo = vec![src.clone()];
    while let Some(dir) = todo.pop() {
        for entry in std::fs::read_dir(dir).unwrap() {
            let path = entry.unwrap().path();
            if path.is_dir() {
                todo.push(path);
            } else {
                let rel = path
                    .strip_prefix(&src)
                    .unwrap()
                    .to_string_lossy()
                    .replace('\\', "/");
                out.insert(format!("{INSTALL_DIR}/{rel}"));
            }
        }
    }
    out
}

#[test]
fn the_kit_carries_the_cases_outside_its_claude_tree() {
    let files = pack_files();
    assert!(
        files
            .iter()
            .any(|p| p.ends_with("/cook/eval/paired-cases.yaml")),
        "{files:?}"
    );
    let kit = support::kit().dir;
    assert!(
        !kit.join(".claude/skills/cook/eval").exists(),
        "the shipped .claude/ tree has no eval folders"
    );
}

#[test]
fn a_default_plan_has_no_eval_folder_on_any_runtime() {
    for e in registry() {
        let dir = tempfile::tempdir().unwrap();
        let scope = Scope::project(dir.path());
        let plan = plan(*e, &scope, &[]);
        let stray: Vec<_> = paths(&plan)
            .into_iter()
            .filter(|p| p.starts_with(INSTALL_DIR) || p.contains("/eval/"))
            .collect();
        assert!(stray.is_empty(), "{}: {stray:?}", e.target().name());
    }
}

#[test]
fn selecting_the_pack_adds_exactly_the_case_files_and_nothing_else() {
    let expected = pack_files();
    assert!(!expected.is_empty());
    for e in registry() {
        let dir = tempfile::tempdir().unwrap();
        let scope = Scope::project(dir.path());
        let base = paths(&plan(*e, &scope, &[]));
        let with = paths(&plan(*e, &scope, &[PACK.to_owned()]));
        let name = e.target().name();
        assert!(
            with.is_superset(&base),
            "{name}: the pack removed something"
        );
        let added: BTreeSet<String> = with.difference(&base).cloned().collect();
        assert_eq!(added, expected, "{name}");
        // Every added path is inside a root the emitter may touch.
        let roots = e.roots(&scope);
        for p in &added {
            let rel = mewkit_adapters::contract::RelPath::new(p).unwrap();
            assert!(
                roots.iter().any(|r| rel.is_within(r)),
                "{name}: {p} outside roots"
            );
        }
    }
}

#[test]
fn the_pack_name_never_reaches_a_runtime_pack_catalog() {
    // `eval` beside a catalog pack must not be refused as an unknown skill pack.
    let dir = tempfile::tempdir().unwrap();
    let scope = Scope::project(dir.path());
    let e = mewkit_adapters::emitter(Runtime::Codex).unwrap();
    let plain = paths(&plan(e, &scope, &["core".to_owned()]));
    let with = paths(&plan(e, &scope, &["core".to_owned(), PACK.to_owned()]));
    assert_eq!(
        with.difference(&plain).cloned().collect::<BTreeSet<_>>(),
        pack_files()
    );
}

#[test]
fn a_global_install_leaves_the_pack_out_and_says_so() {
    let home = tempfile::tempdir().unwrap();
    let scope = Scope::global(home.path(), |_| None).unwrap();
    let e = mewkit_adapters::emitter(Runtime::ClaudeCode).unwrap();
    let plan = plan(e, &scope, &[PACK.to_owned()]);
    assert!(paths(&plan).iter().all(|p| !p.contains(".meowkit/eval")));
    assert!(
        plan.notices.iter().any(|n| n.contains("eval pack")),
        "{:?}",
        plan.notices
    );
}

#[test]
fn every_runtime_strips_the_pack_files_its_index_records() {
    for e in registry() {
        let dir = tempfile::tempdir().unwrap();
        let scope = Scope::project(dir.path());
        let mut index = OwnershipIndex::new("0.0.0-test", "1", Origin::LocalDir);
        let file = format!("{INSTALL_DIR}/cook/eval/paired-cases.yaml");
        index.paths.insert(file.clone(), "0".repeat(64));
        let strip = e.plan_strip(&scope, &index).unwrap();
        let removes: Vec<_> = strip
            .ops
            .iter()
            .filter(|op| matches!(op, Op::RemoveFile { path } if path.as_str() == file))
            .collect();
        assert_eq!(removes.len(), 1, "{}", e.target().name());
    }
}
