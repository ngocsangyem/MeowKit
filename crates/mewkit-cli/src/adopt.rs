//! Taking over a project the npm `mewkit` CLI installed.
//!
//! When `init --target` finds no ownership index for a runtime but the npm CLI
//! left its install record, the record's still-unedited paths become the
//! starting index. The run then proceeds as an upgrade from that index: kit
//! files are refreshed, files the kit no longer ships are removed when their
//! bytes match what the record says was installed, and edited files are kept.
//! Adoption is never implicit: `upgrade` only names the command.
use mewkit_adapters::contract::{Kit, Op, OwnershipIndex, Plan, RelPath, Runtime};
use mewkit_adapters::{Emitter, ScopeKind};
use mewkit_core::adopt::{self, Adopted};
use mewkit_core::fsx::is_never_delete;

use crate::failure::Failure;
use crate::place::Place;

/// The npm CLI's record of `runtime` here, if there is one. Project scope only:
/// the npm CLI keeps no per-runtime record in the home directory.
pub fn record(place: &Place, runtime: Runtime) -> Result<Option<Adopted>, Failure> {
    if place.scope.kind != ScopeKind::Project {
        return Ok(None);
    }
    let root = &place.scope.root;
    let found = match runtime {
        Runtime::ClaudeCode => adopt::ts_metadata(root),
        Runtime::Codex => adopt::ts_ledger(root, "codex"),
        Runtime::Cursor => adopt::ts_ledger(root, "cursor"),
    };
    found.map_err(|e| Failure::failed(format!("{e}; fix or remove it, then run again")))
}

/// Whether the npm CLI left a record of `runtime` here (not whether it is readable).
pub fn has_record(place: &Place, runtime: Runtime) -> bool {
    let root = &place.scope.root;
    let files: &[&str] = match runtime {
        Runtime::ClaudeCode => &[".meowkit/metadata.json", ".claude/metadata.json"],
        Runtime::Codex => &[".meowkit/state/codex-ledger.json"],
        Runtime::Cursor => &[".meowkit/state/cursor-ledger.json"],
    };
    place.scope.kind == ScopeKind::Project && files.iter().any(|f| root.join(f).is_file())
}

/// The starting index for an adopted runtime. Only paths inside the
/// emitter's roots are taken, and never a file the plan merges into (a shared
/// file such as `AGENTS.md` keeps the user's text; the kit's part of it is
/// tracked as a section once this run merges it).
pub fn take_over(
    place: &Place,
    e: &dyn Emitter,
    record: &Adopted,
    plan: &mut Plan,
    kit: &Kit,
) -> OwnershipIndex {
    let roots = e.roots(&place.scope);
    let merged: Vec<&RelPath> = plan
        .ops
        .iter()
        .filter(|op| !matches!(op, Op::WriteFile { .. } | Op::RemoveFile { .. }))
        .map(Op::path)
        .collect();
    // The run stamps this kit on the index before it is written.
    let mut index = OwnershipIndex::new(&record.kit_version, "none", kit.origin);
    index.packs = record.packs.clone();
    index.paths = record
        .paths
        .iter()
        .filter(|(p, _)| {
            RelPath::new(p).is_ok_and(|p| {
                roots.iter().any(|r| p.is_within(r))
                    && !is_never_delete(&p)
                    && !merged.contains(&&p)
            })
        })
        .map(|(p, h)| (p.clone(), h.clone()))
        .collect();
    plan.notices.insert(
        0,
        format!(
            "taking over the npm mewkit install recorded in {}: {} file(s) adopted, \
             {} recorded path(s) left as yours (edited or missing)",
            record.source,
            index.paths.len(),
            record.skipped
        ),
    );
    index
}
