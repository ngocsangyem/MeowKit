//! What one target's install owns at one scope, and what may therefore be removed.
//!
//! The index alone never grants deletion. Its two facts — "this path is
//! kit-owned" and "its hash still matches" — come from the same file, so an
//! index that lies about a user's file would satisfy both. A path is `Clean`
//! (removable) only when its bytes match the recorded hash AND the kit's own
//! bytes for that path; a user-authored file matches no kit content, so no
//! index can widen what is deleted, only narrow it.
use std::collections::BTreeMap;
use std::io;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::fsx::{RelPath, is_never_delete, sha256_hex};
use crate::plan::Format;

/// The index schema this binary writes and reads.
pub const SCHEMA_VERSION: u32 = 1;
/// Larger than any real index; a bigger file is refused unread.
const MAX_INDEX_BYTES: u64 = 16 * 1024 * 1024;

/// Where the installed kit came from.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Origin {
    /// A release whose archive matched its published SHA-256.
    Release,
    /// A local archive checked against a SHA-256 the user supplied.
    Archive,
    /// An unpacked directory, not checksummed (development only).
    LocalDir,
    /// A release with no published checksum, installed on explicit request.
    Unverified,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct OwnershipIndex {
    pub schema_version: u32,
    pub kit_version: String,
    pub kit_contract: String,
    pub packs: Vec<String>,
    pub origin: Origin,
    /// Whole files this install wrote, with the SHA-256 it wrote.
    pub paths: BTreeMap<String, String>,
    /// Hook registrations this install merged, by id, with a hash of each.
    pub hooks: BTreeMap<String, String>,
    /// MCP servers this install merged, by name, with a hash of each.
    pub mcp_servers: BTreeMap<String, String>,
    /// What this install merged into user-owned files: file → section id → record.
    pub sections: BTreeMap<String, BTreeMap<String, Section>>,
}

/// One merge into a user-owned file, with what its strip needs to undo it exactly.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Section {
    pub format: Format,
    /// Container key path (empty for a Markdown block, whose id is the section id).
    pub key: Vec<String>,
    /// Entry names merged into the container.
    pub names: Vec<String>,
    /// Containers along `key` the merge created.
    pub created: usize,
    /// The file did not exist before the merge, so strip removes it once empty.
    pub file_created: bool,
}

#[derive(Debug, thiserror::Error)]
pub enum IndexError {
    #[error("cannot read ownership index {path}: {source}")]
    Io { path: String, source: io::Error },
    #[error("ownership index {0} is larger than {MAX_INDEX_BYTES} bytes")]
    TooLarge(String),
    #[error("ownership index {path} is not valid: {reason}")]
    Invalid { path: String, reason: String },
    #[error(
        "ownership index {path} has schema {found}, newer than this binary's {SCHEMA_VERSION}; \
         run `mewkit-next self-update`"
    )]
    Newer { path: String, found: u64 },
}

impl OwnershipIndex {
    /// An empty index for a fresh install.
    pub fn new(kit_version: &str, kit_contract: &str, origin: Origin) -> Self {
        Self {
            schema_version: SCHEMA_VERSION,
            kit_version: kit_version.to_owned(),
            kit_contract: kit_contract.to_owned(),
            packs: Vec::new(),
            origin,
            paths: BTreeMap::new(),
            hooks: BTreeMap::new(),
            mcp_servers: BTreeMap::new(),
            sections: BTreeMap::new(),
        }
    }

    /// Read an index; `Ok(None)` when there is none. Refuses an oversized file,
    /// a newer schema, unknown fields and any path that is not a safe `RelPath`.
    pub fn load(file: &Path) -> Result<Option<Self>, IndexError> {
        let shown = file.display().to_string();
        let io_err = |source| IndexError::Io {
            path: shown.clone(),
            source,
        };
        let meta = match std::fs::metadata(file) {
            Ok(m) => m,
            Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(None),
            Err(e) => return Err(io_err(e)),
        };
        if meta.len() > MAX_INDEX_BYTES {
            return Err(IndexError::TooLarge(shown));
        }
        let bytes = std::fs::read(file).map_err(io_err)?;
        let invalid = |reason: String| IndexError::Invalid {
            path: shown.clone(),
            reason,
        };
        // Schema first, so a newer index names self-update instead of an unknown field.
        let raw: serde_json::Value =
            serde_json::from_slice(&bytes).map_err(|e| invalid(e.to_string()))?;
        let found = raw
            .get("schema_version")
            .and_then(serde_json::Value::as_u64)
            .ok_or_else(|| invalid("missing schema_version".into()))?;
        if found > u64::from(SCHEMA_VERSION) {
            return Err(IndexError::Newer { path: shown, found });
        }
        let index: Self = serde_json::from_value(raw).map_err(|e| invalid(e.to_string()))?;
        for p in index.paths.keys().chain(index.sections.keys()) {
            RelPath::new(p).map_err(|e| invalid(e.to_string()))?;
        }
        Ok(Some(index))
    }

    pub fn to_json(&self) -> Vec<u8> {
        let mut out = serde_json::to_vec_pretty(self).expect("index serializes");
        out.push(b'\n');
        out
    }
}

/// How one path stands against the index and the kit.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Class {
    /// Bytes match the record and the kit: removable.
    Clean,
    /// Owned, but changed since install: removable only with force.
    Modified,
    /// Owned, but already gone.
    Missing,
    /// On disk in an owned root, not in the index: never removed.
    Orphan,
    /// User or machine state: never removed by any flag.
    Protected,
    /// The index's claim is not corroborated (the kit does not ship the path).
    Refused,
}

/// Classify every indexed path, then every unindexed file under `roots`.
/// `kit_hash` answers the SHA-256 of the kit's own bytes for a path, or `None`
/// when the kit does not ship it.
pub fn classify(
    root: &Path,
    index: &OwnershipIndex,
    roots: &[RelPath],
    kit_hash: &dyn Fn(&RelPath) -> Option<String>,
) -> io::Result<Vec<(RelPath, Class)>> {
    let mut out = Vec::new();
    for (raw, recorded) in &index.paths {
        let path = RelPath::new(raw).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
        let class = if is_never_delete(&path) {
            Class::Protected
        } else {
            match std::fs::read(path.under(root)) {
                Err(e) if e.kind() == io::ErrorKind::NotFound => Class::Missing,
                Err(e) => return Err(e),
                Ok(bytes) => match kit_hash(&path) {
                    None => Class::Refused,
                    Some(kit) => {
                        let actual = sha256_hex(&bytes);
                        if actual == *recorded && actual == kit {
                            Class::Clean
                        } else {
                            Class::Modified
                        }
                    }
                },
            }
        };
        out.push((path, class));
    }
    for r in roots {
        for path in files_under(root, r)? {
            if !index.paths.contains_key(path.as_str()) && !is_never_delete(&path) {
                out.push((path, Class::Orphan));
            }
        }
    }
    Ok(out)
}

/// Regular files at or under `dir`, without following symlinked directories.
fn files_under(root: &Path, dir: &RelPath) -> io::Result<Vec<RelPath>> {
    let mut out = Vec::new();
    let mut stack = vec![dir.clone()];
    while let Some(rel) = stack.pop() {
        let meta = match std::fs::symlink_metadata(rel.under(root)) {
            Ok(m) => m,
            Err(e) if e.kind() == io::ErrorKind::NotFound => continue,
            Err(e) => return Err(e),
        };
        if meta.is_file() {
            out.push(rel);
        } else if meta.is_dir() {
            for entry in std::fs::read_dir(rel.under(root))? {
                let name = entry?.file_name();
                let child = format!("{rel}/{}", name.to_string_lossy());
                // A name a RelPath cannot hold (`:`/`\`) is never ours to judge.
                if let Ok(child) = RelPath::new(&child) {
                    stack.push(child);
                }
            }
        }
    }
    out.sort();
    Ok(out)
}

#[cfg(test)]
#[path = "ownership_tests.rs"]
mod tests;
