//! The install pack manifest: load, shape-validate, flatten a profile.
//!
//! `.meowkit/pack-manifest.json` maps install profiles onto the `owner`
//! governance metadata plus an explicit `base` essentials set. This is the
//! manifest half (pure, no artifact walking); the base seed that turns it into
//! paths lives in [`super::packs`]. Port of `core/pack-manifest.ts`.
use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

use serde_json::Value;

use super::pack_manifest_shape::validate_manifest;

pub const PACK_MANIFEST_FILENAME: &str = "pack-manifest.json";
/// Reserved profile entry meaning "every pack" — a full-tree install.
pub const WILDCARD: &str = "*";
/// The always-included pseudo-pack.
pub const BASE_PACK: &str = "base";

#[derive(Clone, Debug, Default)]
pub struct PackBase {
    pub files: Vec<String>,
    pub globs: Vec<String>,
    pub exclude: Vec<String>,
}

#[derive(Clone, Debug, Default)]
pub struct PackDef {
    pub owners: Vec<String>,
    pub artifacts_add: Vec<String>,
    pub artifacts_exclude: Vec<String>,
}

#[derive(Clone, Debug)]
pub struct PackManifest {
    pub schema_version: String,
    pub base: PackBase,
    /// Insertion order preserved: the npm CLI iterates `Object.entries`, and a
    /// row per pack is printed in that order.
    pub packs: Vec<(String, PackDef)>,
    pub profiles: Vec<(String, Vec<String>)>,
}

impl PackManifest {
    pub fn pack(&self, name: &str) -> Option<&PackDef> {
        self.packs
            .iter()
            .find(|(key, _)| key == name)
            .map(|(_, def)| def)
    }

    pub fn has_pack(&self, name: &str) -> bool {
        self.pack(name).is_some()
    }

    pub fn profile(&self, name: &str) -> Option<&Vec<String>> {
        self.profiles
            .iter()
            .find(|(key, _)| key == name)
            .map(|(_, refs)| refs)
    }

    pub fn available_packs(&self) -> Vec<&str> {
        self.packs.iter().map(|(name, _)| name.as_str()).collect()
    }

    pub fn available_profiles(&self) -> Vec<&str> {
        self.profiles
            .iter()
            .map(|(name, _)| name.as_str())
            .collect()
    }
}

/// Why a manifest was refused. One message type, because every caller reports
/// it as a row rather than branching on the kind.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PackManifestError(pub String);

impl std::fmt::Display for PackManifestError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

/// Where the manifest is for this tree, present or absent.
///
/// Canonical is `<root>/.meowkit/`; a pre-move install still resolves to
/// `<root>/.claude/`. The fallback matters here: absence reads as "pack
/// modularization not installed; run upgrade", so without it a healthy pre-move
/// project would be told to upgrade for no reason.
pub fn pack_manifest_path(claude_dir: &Path) -> PathBuf {
    let root = claude_dir.parent().unwrap_or(claude_dir);
    let canonical = root.join(".meowkit").join(PACK_MANIFEST_FILENAME);
    if canonical.exists() {
        return canonical;
    }
    let legacy = claude_dir.join(PACK_MANIFEST_FILENAME);
    if legacy.exists() {
        return legacy;
    }
    canonical
}

pub fn has_pack_manifest(claude_dir: &Path) -> bool {
    pack_manifest_path(claude_dir).exists()
}

pub fn load_pack_manifest(claude_dir: &Path) -> Result<PackManifest, PackManifestError> {
    let file = pack_manifest_path(claude_dir);
    if !file.exists() {
        return Err(PackManifestError(format!(
            "pack-manifest.json not found at {}",
            file.display()
        )));
    }
    let text = std::fs::read(&file)
        .map(|bytes| String::from_utf8_lossy(&bytes).into_owned())
        .unwrap_or_default();
    let parsed: Value = serde_json::from_str(&text)
        .map_err(|err| PackManifestError(format!("pack-manifest.json is not valid JSON: {err}")))?;
    validate_manifest(&parsed)
}

/// Flatten a profile to its concrete pack list (always including `base`).
///
/// Pack-first: a profile named like its own domain pack must bind to the PACK,
/// not recurse into itself. Cycles are rejected; an unknown ref names what is
/// available.
pub fn flatten_profile(
    manifest: &PackManifest,
    profile_name: &str,
) -> Result<(Vec<String>, bool), PackManifestError> {
    if manifest.profile(profile_name).is_none() {
        return Err(PackManifestError(format!(
            "unknown profile \"{profile_name}\" — available: {}",
            manifest.available_profiles().join(", ")
        )));
    }
    let mut packs: BTreeSet<String> = BTreeSet::new();
    let mut order: Vec<String> = vec![BASE_PACK.to_string()];
    packs.insert(BASE_PACK.to_string());
    let mut wildcard = false;
    let mut visiting: Vec<String> = Vec::new();
    walk_profile(
        manifest,
        profile_name,
        &mut packs,
        &mut order,
        &mut wildcard,
        &mut visiting,
    )?;
    Ok((order, wildcard))
}

fn walk_profile(
    manifest: &PackManifest,
    name: &str,
    packs: &mut BTreeSet<String>,
    order: &mut Vec<String>,
    wildcard: &mut bool,
    visiting: &mut Vec<String>,
) -> Result<(), PackManifestError> {
    if visiting.iter().any(|seen| seen == name) {
        return Err(PackManifestError(format!(
            "profile cycle detected at \"{name}\""
        )));
    }
    visiting.push(name.to_string());
    let empty = Vec::new();
    for reference in manifest.profile(name).unwrap_or(&empty) {
        let mut add = |pack: &str| {
            if packs.insert(pack.to_string()) {
                order.push(pack.to_string());
            }
        };
        if reference == WILDCARD {
            *wildcard = true;
            for pack in manifest.available_packs() {
                add(pack);
            }
        } else if reference == BASE_PACK {
            add(BASE_PACK);
        } else if manifest.has_pack(reference) {
            add(reference);
        } else if manifest.profile(reference).is_some() {
            walk_profile(manifest, reference, packs, order, wildcard, visiting)?;
        } else {
            return Err(PackManifestError(format!(
                "profile \"{name}\" references unknown pack/profile \"{reference}\" — packs: {}",
                manifest.available_packs().join(", ")
            )));
        }
    }
    visiting.retain(|seen| seen != name);
    Ok(())
}
