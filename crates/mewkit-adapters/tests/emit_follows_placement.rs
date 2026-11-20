//! What each emitter writes, against what the placement resolver says the kit
//! writes, for every set of runtimes a project can hold. The resolver's lists
//! of double loads are only as true as this agreement.
mod support;

use std::collections::{BTreeMap, BTreeSet};

use mewkit_adapters::contract::{Op, Runtime, Scope};
use mewkit_adapters::placement_resolver::{Dialect, Placement, resolve};
use mewkit_adapters::registry::emitter;
use mewkit_adapters::surface_table::{Kind, table};
use mewkit_adapters::{EmitRequest, agents_tree};
use support::{kit, request};

fn subsets() -> Vec<Vec<Runtime>> {
    let all = Runtime::ALL;
    (1u32..(1 << all.len()))
        .map(|mask| {
            all.iter()
                .enumerate()
                .filter(|(i, _)| mask & (1 << i) != 0)
                .map(|(_, r)| *r)
                .collect()
        })
        .collect()
}

/// Every path `runtime`'s emitter writes or merges into, for `placement`.
fn touched(runtime: Runtime, placement: &Placement, scope: &Scope) -> BTreeSet<String> {
    let kit = kit();
    let req = EmitRequest {
        placement: Some(placement),
        ..request(&kit, scope, &[], &[])
    };
    let plan = emitter(runtime).unwrap().prepare(&req).unwrap();
    plan.ops
        .iter()
        .filter_map(|op| match op {
            Op::WriteFile { path, .. }
            | Op::MergeBlock { path, .. }
            | Op::MergeEntries { path, .. }
            | Op::MergeHooks { path, .. } => Some(path.as_str().to_owned()),
            _ => None,
        })
        .collect()
}

fn under(paths: &BTreeSet<String>, root: &str) -> bool {
    let inside = format!("{root}/");
    paths.iter().any(|p| p == root || p.starts_with(&inside))
}

/// Every root the table names for `kind`, whichever runtime reads it.
fn table_roots(kind: Kind) -> BTreeSet<&'static str> {
    table()
        .runtimes
        .iter()
        .filter_map(|runtime| runtime.kinds.get(&kind))
        .flat_map(|surface| surface.roots.iter().map(|read| read.root.as_str()))
        .collect()
}

/// The kinds an emitter installs. No emitter installs an MCP server, so the
/// MCP rows of the table describe what the runtimes read and nothing the kit
/// writes.
const INSTALLED: [Kind; 4] = [Kind::Skills, Kind::Agents, Kind::AlwaysOn, Kind::Hooks];

#[test]
fn the_emitters_write_the_roots_the_resolver_names_in_every_set() {
    let dir = tempfile::tempdir().unwrap();
    let scope = Scope::project(dir.path());
    // A runtime's plan depends on the set only through what it loads and on
    // whether the shared tree is in shared wording, so one plan serves every
    // set that agrees on those.
    let mut plans: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();
    let sets = subsets();
    assert_eq!(sets.len(), 63);
    for set in sets {
        let placement = resolve(table(), &set);
        let shared = agents_tree::is_shared(Some(&placement));
        let mut by_runtime: BTreeMap<Runtime, &BTreeSet<String>> = BTreeMap::new();
        for &runtime in &set {
            let loads = Kind::ALL.map(|kind| {
                placement
                    .view(runtime, kind)
                    .map(|view| (&view.source, &view.extras, &view.switches))
            });
            let key = format!("{runtime:?} {loads:?} {shared}");
            if !plans.contains_key(&key) {
                plans.insert(key.clone(), touched(runtime, &placement, &scope));
            }
        }
        for &runtime in &set {
            let loads = Kind::ALL.map(|kind| {
                placement
                    .view(runtime, kind)
                    .map(|view| (&view.source, &view.extras, &view.switches))
            });
            by_runtime.insert(runtime, &plans[&format!("{runtime:?} {loads:?} {shared}")]);
        }

        for kind in INSTALLED {
            // The copy the resolver says a runtime loads is one its own
            // emitter wrote.
            for (&runtime, paths) in &by_runtime {
                if let Some(view) = placement.view(runtime, kind) {
                    assert!(
                        under(paths, &view.source),
                        "{set:?}: {runtime:?} loads its {} from {}, which its emitter does not write",
                        kind.name(),
                        view.source
                    );
                }
            }
            // And the roots written are the ones the resolver lists, no more.
            let written: BTreeSet<&str> = table_roots(kind)
                .into_iter()
                .filter(|root| by_runtime.values().any(|paths| under(paths, root)))
                .collect();
            let named: BTreeSet<&str> = placement.kinds[&kind]
                .writes
                .iter()
                .map(|write| write.root.as_str())
                .collect();
            assert_eq!(written, named, "{set:?} {}", kind.name());
        }

        // The shared tree is in shared wording exactly where the resolver says
        // more than one runtime takes its copy from it.
        for write in &placement.kinds[&Kind::Skills].writes {
            if write.root == agents_tree::SKILLS_ROOT {
                assert_eq!(
                    shared,
                    write.dialect == Dialect::Shared,
                    "{set:?} {write:?}"
                );
            }
        }
    }
}
