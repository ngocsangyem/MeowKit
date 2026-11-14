//! Turning a profile or an explicit pack list into the exact set of
//! `.claude/`-relative paths to install.
//!
//! Membership derives from the `owner` governance metadata plus the manifest's
//! base essentials and per-pack overrides. `install` and `pack add|remove`
//! share it, so what an install lays down and what a pack removal considers
//! exclusive cannot disagree. Port of `core/pack-resolver.ts`.
use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;

use super::inventory::{Inventory, InventoryEntry};
use super::inventory_build::build_inventory;
use super::pack_files::{base_seed, collect_files};
use super::pack_manifest::{BASE_PACK, PackManifest, PackManifestError, flatten_profile};

/// What a profile or pack list resolves to.
#[derive(Clone, Debug, Default)]
pub struct Resolved {
    /// Every `.claude/`-relative path, base included.
    pub paths: BTreeSet<String>,
    /// Per-pack paths, `base` included: the exclusivity math for a removal.
    pub membership: BTreeMap<String, BTreeSet<String>>,
    /// The concrete pack names resolved, always starting with `base`.
    pub packs: Vec<String>,
}

/// The union of paths, and the paths each pack contributes.
type Built = (BTreeSet<String>, BTreeMap<String, BTreeSet<String>>);

fn norm(path: &str) -> String {
    path.replace('\\', "/")
}

/// A skill installs its whole directory; every other artifact is one file.
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
/// in the artifacts its members need at runtime. Dangling ids are tolerated:
/// `validate --packs` is what flags them.
fn close_depends_on(
    claude_dir: &Path,
    inventory: &Inventory,
    included: &mut BTreeSet<String>,
    paths: &mut BTreeSet<String>,
) {
    let by_id: BTreeMap<&str, &InventoryEntry> = inventory
        .entries
        .iter()
        .map(|entry| (entry.id.as_str(), entry))
        .collect();
    let mut changed = true;
    while changed {
        changed = false;
        for id in included.clone() {
            let Some(entry) = by_id.get(id.as_str()) else {
                continue;
            };
            for dep in &entry.depends_on {
                let Some(dep_entry) = by_id.get(dep.as_str()) else {
                    continue;
                };
                if included.insert(dep.clone()) {
                    paths.extend(
                        artifact_paths(claude_dir, dep_entry)
                            .iter()
                            .map(|p| norm(p)),
                    );
                    changed = true;
                }
            }
        }
    }
}

fn unknown_pack(manifest: &PackManifest, name: &str) -> PackManifestError {
    PackManifestError(format!(
        "unknown pack \"{name}\" — available: {}",
        manifest.available_packs().join(", ")
    ))
}

/// Union of base and each pack's owner/override-selected artifact files.
fn build_from_packs(
    claude_dir: &Path,
    manifest: &PackManifest,
    pack_names: &[String],
    inventory: &Inventory,
) -> Result<Built, PackManifestError> {
    let ids: BTreeSet<&str> = inventory.entries.iter().map(|e| e.id.as_str()).collect();
    let mut paths = BTreeSet::new();
    let mut membership = BTreeMap::new();
    let mut included = BTreeSet::new();

    let base: BTreeSet<String> = base_seed(claude_dir, manifest).into_keys().collect();
    paths.extend(base.iter().cloned());
    membership.insert(BASE_PACK.to_string(), base);

    for name in pack_names.iter().filter(|n| *n != BASE_PACK) {
        let def = manifest
            .pack(name)
            .ok_or_else(|| unknown_pack(manifest, name))?;
        for id in def.artifacts_add.iter().chain(&def.artifacts_exclude) {
            if !ids.contains(id.as_str()) {
                return Err(PackManifestError(format!(
                    "pack \"{name}\" references unknown artifact id \"{id}\""
                )));
            }
        }
        let mut member = BTreeSet::new();
        for entry in &inventory.entries {
            if def.artifacts_exclude.contains(&entry.id) {
                continue;
            }
            if !def.owners.contains(&entry.owner) && !def.artifacts_add.contains(&entry.id) {
                continue;
            }
            included.insert(entry.id.clone());
            for path in artifact_paths(claude_dir, entry) {
                let path = norm(&path);
                paths.insert(path.clone());
                member.insert(path);
            }
        }
        membership.insert(name.clone(), member);
    }
    close_depends_on(claude_dir, inventory, &mut included, &mut paths);
    Ok((paths, membership))
}

/// A profile's install set. A profile that reaches `*` is the whole tree.
pub fn resolve_profile(
    claude_dir: &Path,
    manifest: &PackManifest,
    profile: &str,
) -> Result<Resolved, PackManifestError> {
    let (packs, wildcard) = flatten_profile(manifest, profile)?;
    if wildcard {
        let all: BTreeSet<String> = collect_files(claude_dir, claude_dir)
            .iter()
            .map(|p| norm(p))
            .collect();
        return Ok(Resolved {
            membership: BTreeMap::from([(BASE_PACK.to_string(), all.clone())]),
            paths: all,
            packs,
        });
    }
    let (paths, membership) =
        build_from_packs(claude_dir, manifest, &packs, &build_inventory(claude_dir))?;
    Ok(Resolved {
        paths,
        membership,
        packs,
    })
}

/// An explicit pack list's install set; base is always included.
pub fn resolve_packs(
    claude_dir: &Path,
    manifest: &PackManifest,
    pack_names: &[String],
) -> Result<Resolved, PackManifestError> {
    let mut names = vec![BASE_PACK.to_string()];
    names.extend(pack_names.iter().filter(|n| *n != BASE_PACK).cloned());
    for name in &names {
        if name != BASE_PACK && !manifest.has_pack(name) {
            return Err(unknown_pack(manifest, name));
        }
    }
    let (paths, membership) =
        build_from_packs(claude_dir, manifest, &names, &build_inventory(claude_dir))?;
    Ok(Resolved {
        paths,
        membership,
        packs: names,
    })
}
