use std::collections::BTreeSet;

use super::*;
use crate::contract::Runtime::{ClaudeCode, Codex, Cursor, Grok, Omp, Pi};
use crate::surface_table::table;

/// Every non-empty set of the six runtimes.
fn subsets() -> Vec<Vec<Runtime>> {
    (1u32..64)
        .map(|mask| {
            let picked = Runtime::ALL.into_iter().enumerate();
            picked
                .filter(|(i, _)| mask & (1 << i) != 0)
                .map(|(_, r)| r)
                .collect()
        })
        .collect()
}

fn roots(placement: &Placement, kind: Kind) -> Vec<&str> {
    let writes = &placement.kinds[&kind].writes;
    writes.iter().map(|w| w.root.as_str()).collect()
}

/// Every (kind, runtime, extra root) over all sets, certain or unsettled.
fn extras(certain: bool) -> BTreeSet<(&'static str, &'static str, String)> {
    let mut out = BTreeSet::new();
    for set in subsets() {
        let placement = resolve(table(), &set);
        for (kind, placed) in &placement.kinds {
            for (runtime, view) in &placed.views {
                for extra in view.extras.iter().filter(|e| e.unsure.is_none() == certain) {
                    out.insert((kind.name(), runtime.name(), extra.root.clone()));
                }
            }
        }
    }
    out
}

#[test]
fn every_runtime_in_every_set_has_one_source_that_is_written() {
    let sets = subsets();
    assert_eq!(sets.len(), 63);
    for set in sets {
        let placement = resolve(table(), &set);
        for kind in Kind::ALL {
            let placed = &placement.kinds[&kind];
            for &runtime in &set {
                let view = placed.views.get(&runtime);
                // A copy wherever the kit has a root it writes for the runtime.
                let has_copy = table()
                    .surface(runtime, kind)
                    .is_some_and(|s| s.roots.iter().any(|r| r.write));
                assert_eq!(view.is_some(), has_copy, "{set:?} {kind:?} {runtime:?}");
                let Some(view) = view else { continue };
                let written = roots(&placement, kind);
                assert!(written.contains(&view.source.as_str()), "{set:?} {kind:?}");
                assert!(view.extras.iter().all(|e| e.root != view.source));
            }
            for write in &placed.writes {
                assert!(set.contains(&write.owner), "{set:?} {kind:?} {write:?}");
                assert!(
                    write.readers.contains(&write.owner),
                    "{set:?} {kind:?} {write:?}"
                );
                let surface = table().surface(write.owner, kind).unwrap();
                let may = |r: &crate::surface_table::Read| r.root == write.root && r.write;
                assert!(surface.roots.iter().any(may), "{set:?} {kind:?} {write:?}");
            }
        }
    }
}

/// The double loads the kit's placement leaves. Each needs a user setting of
/// the reading runtime, or has none: Cursor documents no dedupe for skills and
/// keeps a copy of its own beside every root it also reads. The hook ones are
/// chosen: each runtime keeps its own guards beside the ones it imports, and
/// the ship check runs once per command by its own marker.
#[test]
fn the_double_loads_left_over_are_the_known_ones() {
    let known: BTreeSet<_> = [
        ("skills", "cursor", ".claude/skills".to_owned()),
        ("skills", "cursor", ".agents/skills".to_owned()),
        ("always-on", "grok", ".claude/rules".to_owned()),
        ("always-on", "grok", ".cursor/rules".to_owned()),
        ("mcp", "grok", ".cursor/mcp.json".to_owned()),
        ("hooks", "cursor", ".claude/settings.json".to_owned()),
        ("hooks", "grok", ".claude/settings.json".to_owned()),
        ("hooks", "grok", ".cursor/hooks.json".to_owned()),
    ]
    .into();
    assert_eq!(extras(true), known);

    // In a pair of runtimes only hooks, Cursor's skills and Grok's always-on
    // text load twice; the others need a third reader.
    for set in subsets().into_iter().filter(|s| s.len() <= 2) {
        let placement = resolve(table(), &set);
        for (kind, placed) in &placement.kinds {
            for (runtime, view) in &placed.views {
                let clean = view.duplicates().count() == 0;
                let cursor_skills = *kind == Kind::Skills && *runtime == Cursor;
                let grok_text = *kind == Kind::AlwaysOn && *runtime == Grok;
                assert!(
                    clean || *kind == Kind::Hooks || cursor_skills || grok_text,
                    "{set:?} {kind:?} {runtime:?}"
                );
            }
        }
    }
}

#[test]
fn no_runtime_takes_its_guards_from_an_import_the_user_can_switch_off() {
    for set in subsets() {
        let placement = resolve(table(), &set);
        for (runtime, view) in &placement.kinds[&Kind::Hooks].views {
            assert_eq!(view.depends_on, None, "{set:?} {runtime:?}");
        }
    }
}

/// Reads the vendor pages leave open: counted as possible double loads, never
/// relied on as a runtime's only copy.
#[test]
fn the_unsettled_reads_are_the_listed_ones() {
    let known: BTreeSet<_> = [
        ("skills", "grok", ".claude/skills".to_owned()),
        ("skills", "grok", ".cursor/skills".to_owned()),
        ("always-on", "claude-code", "AGENTS.md".to_owned()),
    ]
    .into();
    assert_eq!(extras(false), known);
}

#[test]
fn a_runtime_alone_writes_its_own_roots() {
    let codex = resolve(table(), &[Codex]);
    assert_eq!(roots(&codex, Kind::Skills), [".agents/skills"]);
    assert_eq!(
        codex.kinds[&Kind::Skills].writes[0].dialect,
        Dialect::Host(Codex)
    );
    let cursor = resolve(table(), &[Cursor]);
    assert_eq!(roots(&cursor, Kind::Skills), [".cursor/skills"]);
    assert_eq!(roots(&cursor, Kind::Hooks), [".cursor/hooks.json"]);
    let pi = resolve(table(), &[Pi]);
    assert!(pi.kinds[&Kind::Agents].writes.is_empty());
    assert_eq!(roots(&pi, Kind::Skills), [".agents/skills"]);
}

#[test]
fn cursor_beside_claude_code_keeps_its_own_skills_hooks_and_agents() {
    let placement = resolve(table(), &[Cursor, ClaudeCode]);
    assert_eq!(
        roots(&placement, Kind::Skills),
        [".claude/skills", ".cursor/skills"]
    );
    // It lists the Claude Code copy as well, and documents no way to stop that.
    let skills = placement.view(Cursor, Kind::Skills).unwrap();
    assert_eq!(skills.source, ".cursor/skills");
    let listed_twice = skills.duplicates().next().unwrap();
    assert_eq!(listed_twice.root, ".claude/skills");
    assert_eq!(listed_twice.turn_off, None);
    assert_eq!(
        roots(&placement, Kind::Hooks),
        [".claude/settings.json", ".cursor/hooks.json"]
    );
    assert_eq!(
        roots(&placement, Kind::Agents),
        [".claude/agents", ".cursor/agents"]
    );
    // It runs the imported Claude Code hooks as well; a user setting stops that.
    let hooks = placement.view(Cursor, Kind::Hooks).unwrap();
    assert_eq!(hooks.source, ".cursor/hooks.json");
    let imported = hooks.duplicates().next().unwrap();
    assert_eq!(imported.root, ".claude/settings.json");
    assert!(
        imported
            .turn_off
            .as_deref()
            .unwrap()
            .contains("Third-Party")
    );
    assert_eq!(placement.writes_of(Cursor, Kind::Skills).count(), 1);
    assert_eq!(placement.writes_of(Cursor, Kind::Agents).count(), 1);
}

#[test]
fn runtimes_sharing_the_neutral_skill_root_get_one_copy_in_shared_wording() {
    let placement = resolve(table(), &[Codex, Pi, Omp]);
    let skills = &placement.kinds[&Kind::Skills].writes;
    assert_eq!(skills.len(), 1);
    assert_eq!(skills[0].root, ".agents/skills");
    assert_eq!(skills[0].dialect, Dialect::Shared);
    assert_eq!(skills[0].owner, Codex);
    assert_eq!(skills[0].readers, [Codex, Pi, Omp]);
}

#[test]
fn cursor_and_grok_share_the_context_block_and_keep_their_own_hooks() {
    let placement = resolve(table(), &[Cursor, Grok]);
    assert_eq!(
        roots(&placement, Kind::Hooks),
        [".cursor/hooks.json", ".grok/hooks"]
    );
    // The block is in `AGENTS.md` once; Cursor's own rules sit beside it.
    assert_eq!(
        roots(&placement, Kind::AlwaysOn),
        [".cursor/rules", "AGENTS.md"]
    );
    assert_eq!(roots(&placement, Kind::Mcp), [".cursor/mcp.json"]);
}

#[test]
fn omp_beside_claude_code_switches_the_claude_import_off() {
    let placement = resolve(table(), &[ClaudeCode, Omp]);
    let view = placement.view(Omp, Kind::Skills).unwrap();
    assert_eq!(view.source, ".agents/skills");
    assert!(view.extras.is_empty());
    assert_eq!(view.switches.len(), 1);
    assert!(view.switches[0].contains("disabledProviders: [claude]"));
}

#[test]
fn the_set_is_read_as_a_set() {
    let once = resolve(table(), &[ClaudeCode, Grok]);
    assert_eq!(resolve(table(), &[Grok, ClaudeCode, Grok]), once);
    assert_eq!(once.set, [ClaudeCode, Grok]);
}
