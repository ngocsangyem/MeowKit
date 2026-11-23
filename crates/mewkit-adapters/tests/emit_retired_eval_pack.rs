//! The retired eval pack, for every registered emitter: no plan writes the
//! kit's eval cases anywhere, and the files an earlier install recorded under
//! `.meowkit/eval/` are within reach of the removals that clear them.
mod support;

use mewkit_adapters::contract::{Op, OwnershipIndex, RelPath};
use mewkit_adapters::retired_eval_pack::{INSTALL_DIR, recorded_hashes};
use mewkit_adapters::{Runtime, Scope, registry};
use mewkit_core::ownership::Origin;

const CASE: &str = ".meowkit/eval/cook/eval/paired-cases.yaml";

fn index_with_case() -> OwnershipIndex {
    let mut index = OwnershipIndex::new("0.0.0-test", "1", Origin::LocalDir);
    index.paths.insert(CASE.to_owned(), "0".repeat(64));
    index
        .paths
        .insert(".claude/skills/cook/SKILL.md".to_owned(), "1".repeat(64));
    index
}

#[test]
fn no_plan_writes_an_eval_case_on_any_runtime() {
    let kit = support::kit();
    for e in registry() {
        let dir = tempfile::tempdir().unwrap();
        let scope = Scope::project(dir.path());
        let plan = e
            .prepare(&support::request(&kit, &scope, &[], &[]))
            .unwrap_or_else(|err| panic!("{}: {err}", e.target().name()));
        let stray: Vec<_> = plan
            .ops
            .iter()
            .map(|op| op.path().to_string())
            .filter(|p| p.starts_with(INSTALL_DIR) || p.contains("/eval/"))
            .collect();
        assert!(stray.is_empty(), "{}: {stray:?}", e.target().name());
    }
}

#[test]
fn eval_is_not_a_skill_pack() {
    let kit = support::kit();
    let dir = tempfile::tempdir().unwrap();
    let scope = Scope::project(dir.path());
    let e = mewkit_adapters::emitter(Runtime::Codex).unwrap();
    let err = e
        .prepare(&support::request(&kit, &scope, &["eval".to_owned()], &[]))
        .expect_err("eval is refused like any unknown pack");
    assert!(err.to_string().contains("unknown skill pack"), "{err}");
}

#[test]
fn the_folder_is_a_root_of_every_project_install_only() {
    let root = RelPath::new(INSTALL_DIR).unwrap();
    let project = tempfile::tempdir().unwrap();
    let home = tempfile::tempdir().unwrap();
    let global = Scope::global(home.path(), |_| None).unwrap();
    for e in registry() {
        let name = e.target().name();
        let roots = e.roots(&Scope::project(project.path()));
        assert!(roots.iter().any(|r| root.is_within(r)), "{name}");
        let roots = e.roots(&global);
        assert!(!roots.iter().any(|r| root.is_within(r)), "{name}");
    }
}

#[test]
fn every_runtime_strips_the_case_files_its_index_records() {
    let index = index_with_case();
    for e in registry() {
        let dir = tempfile::tempdir().unwrap();
        let strip = e.plan_strip(&Scope::project(dir.path()), &index).unwrap();
        let removes = strip
            .ops
            .iter()
            .filter(|op| matches!(op, Op::RemoveFile { path } if path.as_str() == CASE))
            .count();
        assert_eq!(removes, 1, "{}", e.target().name());
    }
}

#[test]
fn only_the_pack_files_are_corroborated_by_their_record() {
    let hashes = recorded_hashes(&index_with_case());
    assert_eq!(hashes.keys().collect::<Vec<_>>(), [CASE]);
}
