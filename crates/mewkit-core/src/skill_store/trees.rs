//! Kept trees: the files of a skill at one digest, so any digest in a
//! record's history can be put back.
//!
//! A tree is kept as one file named after its digest, in machine-local state.
//! It is captured when indexing first sees the digest, before anything can
//! change the files; a tree no record names any more is deleted. A text file
//! is stored as text, anything else as hex. Loading checks every file's hash
//! and the digest of the whole, so a damaged or swapped tree is refused.
use std::io;
use std::path::Path;

use serde::{Deserialize, Serialize};

use super::digest::{TreeFile, tree_digest};
use super::record::{StoreError, read_capped};
use crate::fsx::{RelPath, sha256_hex};

const TREE_SCHEMA_VERSION: u32 = 1;
/// A skill larger than this is not kept: rolling it back is not offered.
const MAX_TREE_BYTES: u64 = 32 * 1024 * 1024;

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Kept {
    schema_version: u32,
    digest: String,
    files: Vec<KeptFile>,
}

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct KeptFile {
    path: String,
    exec: bool,
    sha256: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    text: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    hex: Option<String>,
}

/// One restored file: path inside the skill, bytes, execute bit.
pub struct RestoredFile {
    pub path: String,
    pub bytes: Vec<u8>,
    pub exec: bool,
}

/// Where the tree for `digest` is kept under the store's state directory.
pub fn tree_file(dir: &RelPath, digest: &str) -> RelPath {
    RelPath::new(&format!("{dir}/trees/{digest}.json")).expect("a digest is a safe file name")
}

/// The kept form of the files in `skill_dir` listed by `files`, or `None`
/// when a file changed since it was listed or the tree is too large to keep.
pub fn capture(skill_dir: &Path, files: &[TreeFile]) -> io::Result<Option<Vec<u8>>> {
    let mut kept = Kept {
        schema_version: TREE_SCHEMA_VERSION,
        digest: tree_digest(files),
        files: Vec::with_capacity(files.len()),
    };
    let mut total = 0u64;
    for f in files {
        let bytes = std::fs::read(skill_dir.join(&f.path))?;
        total += bytes.len() as u64;
        if total > MAX_TREE_BYTES || sha256_hex(&bytes) != f.sha256 {
            return Ok(None);
        }
        let (text, hex) = match String::from_utf8(bytes) {
            Ok(text) => (Some(text), None),
            Err(e) => (None, Some(to_hex(e.as_bytes()))),
        };
        kept.files.push(KeptFile {
            path: f.path.clone(),
            exec: f.exec,
            sha256: f.sha256.clone(),
            text,
            hex,
        });
    }
    Ok(Some(
        serde_json::to_vec(&kept).expect("a kept tree serializes"),
    ))
}

/// The files of the tree kept for `digest` at `file`, checked file by file and
/// as a whole. `Ok(None)` when no tree is kept for it.
pub fn load(file: &Path, digest: &str) -> Result<Option<Vec<RestoredFile>>, StoreError> {
    let shown = file.display().to_string();
    let invalid = |reason: String| StoreError::Invalid {
        path: shown.clone(),
        reason,
    };
    let Some(bytes) = read_capped(file, MAX_TREE_BYTES * 3).map_err(|source| StoreError::Io {
        path: shown.clone(),
        source,
    })?
    else {
        return Ok(None);
    };
    let kept: Kept = serde_json::from_slice(&bytes).map_err(|e| invalid(e.to_string()))?;
    if kept.schema_version > TREE_SCHEMA_VERSION {
        return Err(StoreError::Newer {
            path: shown,
            found: u64::from(kept.schema_version),
        });
    }
    let mut out = Vec::with_capacity(kept.files.len());
    let mut listed = Vec::with_capacity(kept.files.len());
    for f in kept.files {
        RelPath::new(&f.path).map_err(|e| invalid(e.to_string()))?;
        let bytes = match (f.text, f.hex) {
            (Some(text), None) => text.into_bytes(),
            (None, Some(hex)) => from_hex(&hex).ok_or_else(|| invalid("bad hex".into()))?,
            _ => return Err(invalid(format!("{}: no content", f.path))),
        };
        if sha256_hex(&bytes) != f.sha256 {
            return Err(invalid(format!("{} does not match its hash", f.path)));
        }
        listed.push(TreeFile {
            path: f.path.clone(),
            sha256: f.sha256,
            exec: f.exec,
        });
        out.push(RestoredFile {
            path: f.path,
            bytes,
            exec: f.exec,
        });
    }
    if kept.digest != digest || tree_digest(&listed) != digest {
        return Err(invalid(format!("the files do not make up {digest}")));
    }
    Ok(Some(out))
}

fn to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn from_hex(text: &str) -> Option<Vec<u8>> {
    if !text.len().is_multiple_of(2) {
        return None;
    }
    (0..text.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(text.get(i..i + 2)?, 16).ok())
        .collect()
}
