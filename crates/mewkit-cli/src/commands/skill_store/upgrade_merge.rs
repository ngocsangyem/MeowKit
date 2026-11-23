//! What `upgrade` does with a kit skill file the user edited: merge it with
//! the kit's change when every guard holds, else keep it as before.
//!
//! The guards are [`mewkit_core::skill_store::guarded_merge`]'s. This module
//! supplies what they look up: the previous kit's bytes (from the kit cache,
//! read by `upgrade`), the files on disk, and whether a skill has eval cases.
//! Merging is limited to project installs on Claude Code; elsewhere an edited
//! file is kept and reported exactly as before.
use std::collections::BTreeMap;
use std::path::Path;

use mewkit_adapters::ScopeKind;
use mewkit_adapters::contract::{Op, OwnershipIndex, Plan, RelPath, Runtime};
use mewkit_core::skill_store::guarded_merge::{self, Inputs, Planned};

use crate::place::Place;

/// The previous kit's bytes for every skill file it wrote, from its plan.
pub fn base_bytes(old: &Plan) -> BTreeMap<String, Vec<u8>> {
    old.ops
        .iter()
        .filter_map(|op| match op {
            Op::WriteFile { path, bytes, .. } => Some((path.to_string(), bytes.clone())),
            _ => None,
        })
        .filter(|(path, _)| mewkit_core::skill_store::skill_key_of(path).is_some())
        .collect()
}

/// The merges for `plan` against `base`, or none where merging does not apply.
pub fn plan(
    place: &Place,
    runtime: Runtime,
    plan: &Plan,
    index: &OwnershipIndex,
    base: &BTreeMap<String, Vec<u8>>,
) -> Planned {
    if runtime != Runtime::ClaudeCode || place.scope.kind != ScopeKind::Project {
        return Planned::default();
    }
    let layout = place.scope.layout();
    let root = place.scope.root.clone();
    guarded_merge::plan(&Inputs {
        ops: &plan.ops,
        ledger: &index.paths,
        base: &|path: &str| base.get(path).cloned(),
        current: &|path: &RelPath| std::fs::read(layout.resolve(path)).ok(),
        has_cases: &|name: &str| has_eval_cases(&root, name),
    })
}

/// Whether the skill `name` has eval cases here: an `eval/` folder beside the
/// skill, where a kit checkout keeps them. No install carries the kit's cases.
pub fn has_eval_cases(root: &Path, name: &str) -> bool {
    if name.is_empty() || name.contains(['/', '\\']) || name.starts_with('.') {
        return false;
    }
    let dir = root.join(".claude/skills").join(name).join("eval");
    std::fs::symlink_metadata(dir).is_ok_and(|m| m.is_dir())
}

/// Why the merged skill's eval did not run. A live run needs a model, a cost
/// ceiling, a run limit and the runtime's login, and upgrade is given none of
/// them, so it never starts model calls itself.
pub fn eval_not_run_reason() -> &'static str {
    "upgrade has no model, cost ceiling or run limit for `mewkit eval run`; run it by hand"
}

/// The summary lines for `planned`.
pub fn notices(planned: &Planned, dry_run: bool) -> Vec<String> {
    let verb = if dry_run { "would merge" } else { "merged" };
    let mut out = Vec::new();
    for skill in &planned.skills {
        for file in &skill.files {
            out.push(format!("{verb} your edit with the kit's change: {file}"));
        }
        out.push(format!(
            "eval of {} not run: {}",
            skill.name,
            eval_not_run_reason()
        ));
    }
    for (path, why) in &planned.refused {
        out.push(format!("not merged {path}: {why}"));
    }
    out
}
