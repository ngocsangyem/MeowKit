//! Which files a `pack remove` may delete.
//!
//! A file goes only when it belongs to a pack being removed AND is not in base,
//! AND is not in a pack that stays, AND is not named by `settings.json`, AND is
//! a kit-owned file the user has not edited. Membership comes from the
//! on-disk inventory, so an artifact that two packs share, or that base needs,
//! survives without anyone listing it. Port of `computeRemovablePaths`.
use std::collections::BTreeSet;
use std::path::Path;
use std::sync::LazyLock;

use regex::Regex;

use crate::validate::{BASE_PACK, PackManifest, PackManifestError, resolve_packs};

/// What a candidate path is on disk, as far as removal cares.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum OnDisk {
    /// Not there: nothing to remove and nothing to report.
    Missing,
    /// Kit-owned and byte-identical to what the kit installed.
    Pristine,
    /// Edited, or not recorded as the kit's.
    Other,
}

#[derive(Debug, Default, PartialEq, Eq)]
pub struct RemovalPlan {
    /// Safe to delete, sorted.
    pub deletable: Vec<String>,
    /// Kept because shared, base, referenced by settings, or user-modified.
    pub preserved: Vec<String>,
}

static SETTINGS_REF: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\.claude/([A-Za-z0-9_./-]+)").unwrap());

/// Every `.claude/`-relative path a `settings.json` command string names, so a
/// removal never breaks a hook registration.
pub fn settings_referenced_paths(claude_dir: &Path) -> BTreeSet<String> {
    let Ok(bytes) = std::fs::read(claude_dir.join("settings.json")) else {
        return BTreeSet::new();
    };
    let text = String::from_utf8_lossy(&bytes);
    SETTINGS_REF
        .captures_iter(&text)
        .map(|c| c[1].to_owned())
        .collect()
}

pub fn removable_paths(
    claude_dir: &Path,
    manifest: &PackManifest,
    installed_non_base: &[String],
    requested: &[String],
    on_disk: &dyn Fn(&str) -> OnDisk,
) -> Result<RemovalPlan, PackManifestError> {
    let resolved = resolve_packs(claude_dir, manifest, installed_non_base)?;
    let mut keep: BTreeSet<String> = resolved
        .membership
        .get(BASE_PACK)
        .cloned()
        .unwrap_or_default();
    for pack in installed_non_base.iter().filter(|p| !requested.contains(p)) {
        keep.extend(resolved.membership.get(pack).into_iter().flatten().cloned());
    }
    keep.extend(settings_referenced_paths(claude_dir));

    let mut plan = RemovalPlan::default();
    for target in requested {
        for path in resolved.membership.get(target).into_iter().flatten() {
            if keep.contains(path) {
                plan.preserved.push(path.clone());
                continue;
            }
            match on_disk(path) {
                OnDisk::Missing => {}
                OnDisk::Other => plan.preserved.push(path.clone()),
                OnDisk::Pristine => plan.deletable.push(path.clone()),
            }
        }
    }
    plan.deletable.sort();
    plan.deletable.dedup();
    Ok(plan)
}

#[cfg(test)]
#[path = "pack_removal_tests.rs"]
mod tests;
