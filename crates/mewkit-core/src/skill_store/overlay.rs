//! Overlays: the user's version of chosen kit files, stored outside every
//! kit-owned tree, and this machine's approval of each one.
//!
//! An overlay replaces a file whole; nothing is merged. The store sits under
//! the scope's `skill-overlays/` directory, which a team may choose to commit.
//! Because an overlay is instruction text that would then reach every
//! teammate unreviewed, one is active only when this machine approved exactly
//! that content: the approval is the overlay's identity hash, kept in
//! machine-local state that git never sees. An overlay made here is approved
//! as it is made; one that arrives any other way is inert until approved.
use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use super::record::{OverlayFile, SkillRecord, StoreError, read_capped};
use crate::fsx::RelPath;

/// The overlay store and approval schema this binary writes and reads.
pub const OVERLAY_SCHEMA_VERSION: u32 = 1;
const MAX_MANIFEST_BYTES: u64 = 4 * 1024 * 1024;

/// Every stored overlay at one scope, by skill directory.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct OverlayStore {
    pub schema_version: u32,
    pub overlays: BTreeMap<String, Overlay>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Overlay {
    pub name: String,
    /// Stored files, by path inside the skill.
    pub files: BTreeMap<String, StoredFile>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct StoredFile {
    /// SHA-256 of the stored copy.
    pub sha256: String,
    /// The kit's hash for the file the overlay replaces, when it was made.
    pub base: String,
}

/// This machine's approvals: skill directory → approved overlay identity.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Approvals {
    pub schema_version: u32,
    pub approved: BTreeMap<String, String>,
}

impl Default for OverlayStore {
    fn default() -> Self {
        Self {
            schema_version: OVERLAY_SCHEMA_VERSION,
            overlays: BTreeMap::new(),
        }
    }
}

impl Default for Approvals {
    fn default() -> Self {
        Self {
            schema_version: OVERLAY_SCHEMA_VERSION,
            approved: BTreeMap::new(),
        }
    }
}

impl Overlay {
    /// A hash of everything the overlay would change: what an approval names.
    pub fn identity(&self) -> String {
        let mut h = Sha256::new();
        h.update(self.name.as_bytes());
        h.update([0]);
        for (path, file) in &self.files {
            for part in [path, &file.sha256, &file.base] {
                h.update(part.as_bytes());
                h.update([0]);
            }
            h.update(b"\n");
        }
        crate::fsx::hex(&h.finalize())
    }
}

impl OverlayStore {
    /// Read the store; absent is empty. Every key and file path must be safe.
    pub fn load(file: &Path) -> Result<Self, StoreError> {
        let store: Self = load_json(file)?.unwrap_or_default();
        for (key, overlay) in &store.overlays {
            for path in overlay.files.keys() {
                RelPath::new(&format!("{key}/{path}")).map_err(|e| StoreError::Invalid {
                    path: file.display().to_string(),
                    reason: e.to_string(),
                })?;
            }
        }
        Ok(store)
    }

    /// The overlays this machine approved, exactly as approved.
    pub fn active(&self, approvals: &Approvals) -> BTreeMap<String, Overlay> {
        self.overlays
            .iter()
            .filter(|(key, o)| approvals.approved.get(*key) == Some(&o.identity()))
            .map(|(k, o)| (k.clone(), o.clone()))
            .collect()
    }

    /// Stored overlays waiting for this machine's approval.
    pub fn pending(&self, approvals: &Approvals) -> BTreeSet<String> {
        let active = self.active(approvals);
        self.overlays
            .keys()
            .filter(|k| !active.contains_key(*k))
            .cloned()
            .collect()
    }
}

impl Approvals {
    pub fn load(file: &Path) -> Result<Self, StoreError> {
        Ok(load_json(file)?.unwrap_or_default())
    }
}

/// Where the stored copy of `path` in skill `key` lives under `overlays`.
pub fn stored_copy(overlays: &RelPath, key: &str, path: &str) -> Result<RelPath, StoreError> {
    RelPath::new(&format!("{overlays}/files/{key}/{path}"))
        .map_err(|e| StoreError::Refused(e.to_string()))
}

/// The record's view of an active overlay: each stored file's base, the
/// newest upstream hash seen (from `before`), and the hash placed in the
/// skill (from `before`, else the stored copy's).
pub fn overlay_files(
    before: Option<&SkillRecord>,
    overlay: &Overlay,
) -> BTreeMap<String, OverlayFile> {
    overlay
        .files
        .iter()
        .map(|(path, stored)| {
            let prior = before.and_then(|b| b.overlay.get(path));
            let file = OverlayFile {
                base: stored.base.clone(),
                upstream: prior.map_or_else(|| stored.base.clone(), |p| p.upstream.clone()),
                projected: prior.map_or_else(|| stored.sha256.clone(), |p| p.projected.clone()),
            };
            (path.clone(), file)
        })
        .collect()
}

/// Pretty JSON with a trailing newline, as every store file is written.
pub fn overlay_to_json<T: Serialize>(value: &T) -> Vec<u8> {
    let mut out = serde_json::to_vec_pretty(value).expect("store state serializes");
    out.push(b'\n');
    out
}

fn load_json<T: for<'de> Deserialize<'de>>(file: &Path) -> Result<Option<T>, StoreError> {
    let shown = file.display().to_string();
    let Some(bytes) = read_capped(file, MAX_MANIFEST_BYTES).map_err(|source| StoreError::Io {
        path: shown.clone(),
        source,
    })?
    else {
        return Ok(None);
    };
    let invalid = |reason: String| StoreError::Invalid {
        path: shown.clone(),
        reason,
    };
    let raw: serde_json::Value =
        serde_json::from_slice(&bytes).map_err(|e| invalid(e.to_string()))?;
    let found = raw
        .get("schema_version")
        .and_then(serde_json::Value::as_u64)
        .ok_or_else(|| invalid("missing schema_version".into()))?;
    if found > u64::from(OVERLAY_SCHEMA_VERSION) {
        return Err(StoreError::Newer { path: shown, found });
    }
    serde_json::from_value(raw)
        .map(Some)
        .map_err(|e| invalid(e.to_string()))
}
