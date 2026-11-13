//! Which `.claude/`-relative files a profile installs.
//!
//! The context estimator needs the same allow-set the installer would write, so
//! "what the model loads" is derived from the profile a project actually has
//! rather than from a hand-kept list that drifts the moment a pack moves. Pure:
//! it reads the tree and the manifest, and writes nothing.
//!
//! It lives beside the budget rather than inside `validate` because the budget
//! is its only consumer today; the installer port will lift it out rather than
//! grow a second copy.
use std::collections::BTreeSet;
use std::path::Path;

use crate::validate::{
    BASE_PACK, InventoryEntry, PackManifest, PackManifestError, build_inventory, collect_files,
    flatten_profile,
};

/// Every `.claude/`-relative path the profile installs, including base.
///
/// `full`/`*` short-circuits to the whole tree, as the installer does, so a
/// full install is measured against what it really copies.
pub fn resolve_profile(
    claude_dir: &Path,
    manifest: &PackManifest,
    profile_name: &str,
) -> Result<BTreeSet<String>, PackManifestError> {
    let (packs, wildcard) = flatten_profile(manifest, profile_name)?;
    if wildcard {
        return Ok(collect_files(claude_dir, claude_dir).into_iter().collect());
    }
    build_from_packs(claude_dir, manifest, &packs)
}

/// Base essentials plus each pack's owner/override-selected artifact files.
fn build_from_packs(
    claude_dir: &Path,
    manifest: &PackManifest,
    pack_names: &[String],
) -> Result<BTreeSet<String>, PackManifestError> {
    let inventory = build_inventory(claude_dir);
    let known_ids: BTreeSet<&str> = inventory
        .entries
        .iter()
        .map(|entry| entry.id.as_str())
        .collect();
    let mut paths = base_seed(claude_dir, manifest);
    let mut included: BTreeSet<String> = BTreeSet::new();

    for pack_name in pack_names {
        if pack_name == BASE_PACK {
            continue;
        }
        let Some(pack) = manifest.pack(pack_name) else {
            return Err(PackManifestError(format!(
                "unknown pack \"{pack_name}\" — available: {}",
                manifest.available_packs().join(", ")
            )));
        };
        for id in pack
            .artifacts_add
            .iter()
            .chain(pack.artifacts_exclude.iter())
        {
            if !known_ids.contains(id.as_str()) {
                return Err(PackManifestError(format!(
                    "pack \"{pack_name}\" references unknown artifact id \"{id}\""
                )));
            }
        }
        for entry in &inventory.entries {
            if pack.artifacts_exclude.contains(&entry.id) {
                continue;
            }
            if !pack.owners.contains(&entry.owner) && !pack.artifacts_add.contains(&entry.id) {
                continue;
            }
            included.insert(entry.id.clone());
            paths.extend(artifact_paths(claude_dir, entry));
        }
    }

    close_depends_on(claude_dir, &inventory.entries, &mut included, &mut paths);
    Ok(paths)
}

/// The always-installed essentials: explicit files plus expanded globs.
///
/// A copy of the installer's seed rather than a shared call, because the
/// `validate` module keeps its own helper private; the two are compared by the
/// parity suite, which is where a divergence would show.
fn base_seed(claude_dir: &Path, manifest: &PackManifest) -> BTreeSet<String> {
    let mut set: BTreeSet<String> = manifest
        .base
        .files
        .iter()
        .map(|file| file.replace('\\', "/"))
        .collect();
    for glob in &manifest.base.globs {
        match glob.strip_suffix("/**") {
            Some(sub) => {
                let abs = sub
                    .split('/')
                    .fold(claude_dir.to_path_buf(), |acc, part| acc.join(part));
                if abs.exists() {
                    set.extend(collect_files(&abs, claude_dir));
                }
            }
            None => {
                set.insert(glob.replace('\\', "/"));
            }
        }
    }
    set
}

/// A skill installs its whole directory; every other artifact is a single file.
fn artifact_paths(claude_dir: &Path, entry: &InventoryEntry) -> Vec<String> {
    if entry.artifact_type == "skill"
        && let Some((dir, _)) = entry.path.rsplit_once('/')
    {
        let abs = dir
            .split('/')
            .fold(claude_dir.to_path_buf(), |acc, part| acc.join(part));
        if abs.exists() {
            return collect_files(&abs, claude_dir);
        }
    }
    vec![entry.path.clone()]
}

/// Transitive `depends_on` closure across pack boundaries, so a profile pulls
/// in a hard runtime dependency it would otherwise install half of. A dangling
/// id is tolerated here; `validate --packs` is where it is reported.
fn close_depends_on(
    claude_dir: &Path,
    entries: &[InventoryEntry],
    included: &mut BTreeSet<String>,
    paths: &mut BTreeSet<String>,
) {
    let mut changed = true;
    while changed {
        changed = false;
        for id in included.clone() {
            let Some(entry) = entries.iter().find(|entry| entry.id == id) else {
                continue;
            };
            for dependency in entry.depends_on.clone() {
                let Some(target) = entries.iter().find(|entry| entry.id == dependency) else {
                    continue;
                };
                if !included.insert(dependency) {
                    continue;
                }
                paths.extend(artifact_paths(claude_dir, target));
                changed = true;
            }
        }
    }
}
