//! Rebuilding a lost install record from the kit release the files came from.
//!
//! The ownership index says which files the kit installed. A clone of a
//! project made before the index was committed, or a project whose
//! `.meowkit/state/` was deleted, has the kit's files and no index. Installing
//! over that with no record would keep every file that differs from the new
//! kit as the user's, and leave the old kit's files beside the new ones.
//!
//! The release those files came from settles it: a file whose bytes equal
//! what that release installs there is the kit's, and any other file is the
//! user's. That is the same test an upgrade applies with an index in hand.
use std::collections::{BTreeMap, BTreeSet};

use mewkit_adapters::Emitter;
use mewkit_adapters::contract::{Kit, Op, OwnershipIndex, Plan, RelPath, written_hashes};
use mewkit_core::exec::hook_sections;
use mewkit_core::fsx::sha256_hex;
use serde_json::Value;

use crate::commands::prepare;
use crate::kit_args::{contract_label, release};
use crate::place::Place;

/// Where a Claude Code install records the kit it came from.
const CONTRACT: &str = ".claude/kit-contract.json";

/// A plan that would leave this many of the kit's paths holding other bytes,
/// with no record to say whose they are, is an older kit and not a fresh
/// project with a few files of its own.
pub const MIXED_INSTALL_FLOOR: usize = 20;

/// The kit version the files here say they came from, if they say.
pub fn recorded_version(place: &Place) -> Option<String> {
    let text = std::fs::read_to_string(place.scope.root.join(CONTRACT)).ok()?;
    let doc: Value = serde_json::from_str(&text).ok()?;
    doc.get("kitVersion")?.as_str().map(str::to_owned)
}

/// The SHA-256 of what is at `path` now, or `None` when it is not a readable file.
fn on_disk(place: &Place, path: &str) -> Option<String> {
    let rel = RelPath::new(path).ok()?;
    let file = place.scope.resolve(&rel);
    if !file.is_file() {
        return None;
    }
    std::fs::read(file).ok().map(|bytes| sha256_hex(&bytes))
}

/// The index an install of `old` would have left, limited to the files that
/// still hold the bytes `old` puts there, and what `old` installs at each
/// path (to corroborate removing what the new kit dropped).
pub fn from_release(
    place: &Place,
    e: &dyn Emitter,
    old: &Kit,
    packs: &[String],
    plan: &mut Plan,
) -> Option<(OwnershipIndex, BTreeMap<String, String>)> {
    // An old kit this binary cannot plan (one from before the overlays) names
    // no files, so nothing can be recognised from it.
    let old_plan = prepare(place, e, old, packs).ok()?;
    let installs = written_hashes(&old_plan);
    let mut index = OwnershipIndex::new(&old.version, &contract_label(old), old.origin);
    let mut edited = 0usize;
    for (path, hash) in &installs {
        match on_disk(place, path) {
            Some(now) if now == *hash => {
                index.paths.insert(path.clone(), hash.clone());
            }
            Some(_) => edited += 1,
            None => {}
        }
    }
    if index.paths.is_empty() {
        return None;
    }
    // The hook registrations that release merged: the next merge strips the
    // ones this kit dropped, so none is left pointing at a removed script.
    index.sections = hook_sections(&old_plan);
    plan.notices.insert(
        0,
        format!(
            "no install record here, so it was rebuilt from kit {}: {} file(s) hold what that kit \
             installed and are the kit's; {} differ and are left as yours",
            old.version,
            index.paths.len(),
            edited
        ),
    );
    Some((index, installs))
}

/// The release to rebuild from: the one named on the command line, else the
/// one the files name. `None` when neither names one or it cannot be had.
pub fn source_kit(
    place: &Place,
    named: Option<&str>,
    allow_unverified: bool,
    may_fetch: bool,
) -> Option<Kit> {
    let version = named
        .map(str::to_owned)
        .or_else(|| recorded_version(place))?;
    release(place, &version, allow_unverified, may_fetch)
}

/// How many paths `plan` writes that hold other bytes today and that no
/// runtime installed here records. A path another runtime's install wrote
/// (Codex, Pi and OMP share a skills root) is accounted for.
pub fn collisions(place: &Place, plan: &Plan) -> usize {
    let recorded: BTreeSet<String> = place
        .installed()
        .unwrap_or_default()
        .into_iter()
        .filter_map(|runtime| place.index(runtime).ok().flatten())
        .flat_map(|index| index.paths.into_keys())
        .collect();
    plan.ops
        .iter()
        .filter(|op| match op {
            Op::WriteFile { path, bytes, .. } => {
                !recorded.contains(path.as_str())
                    && on_disk(place, path.as_str()).is_some_and(|now| now != sha256_hex(bytes))
            }
            _ => false,
        })
        .count()
}
