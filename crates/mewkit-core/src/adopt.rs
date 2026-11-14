//! What the npm `mewkit` CLI recorded about an install, read so that
//! `mewkit` can take the install over.
//!
//! A path is adopted only when its bytes on disk still match the recorded
//! checksum, so a file the user edited after the npm install stays theirs.
//! Formats (bare lowercase SHA-256 hex throughout):
//! - Codex / Cursor: `.meowkit/state/{codex,cursor}-ledger.json`, a
//!   `{"version":"3.0","installations":[…]}` registry. Each row names a file or
//!   a directory by its project-relative `item`; a directory's checksum hashes
//!   every regular file below it, sorted by relative POSIX path, as
//!   `"<rel>\0<sha256-hex>\n"` into one SHA-256.
//! - Claude Code: `.meowkit/metadata.json` (or the legacy `.claude/metadata.json`)
//!   with `files[]` entries relative to `.claude/` and an `owner`.
use std::collections::BTreeMap;
use std::io::{self, Read};
use std::path::Path;

use serde::Deserialize;
use sha2::{Digest, Sha256};

use crate::fsx::{RelPath, sha256_hex};

/// Larger than any real install record; a bigger file is refused unread.
const MAX_RECORD_BYTES: u64 = 16 * 1024 * 1024;

/// Paths an npm install recorded and that still hold the recorded bytes.
#[derive(Debug, Default)]
pub struct Adopted {
    /// The recorded kit version, or `"unknown"` when the record has none.
    pub kit_version: String,
    /// Skill packs the npm install chose; empty means all.
    pub packs: Vec<String>,
    /// Root-relative path → SHA-256 of its current bytes.
    pub paths: BTreeMap<String, String>,
    /// Recorded paths left out because they were edited, missing or unsafe.
    pub skipped: usize,
    /// The record file, root-relative, for messages.
    pub source: String,
}

#[derive(Debug, thiserror::Error)]
#[error("cannot read the npm mewkit install record {path}: {reason}")]
pub struct AdoptError {
    pub path: String,
    pub reason: String,
}

#[derive(Deserialize)]
struct Ledger {
    version: String,
    installations: Vec<Row>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Row {
    item: String,
    provider: String,
    global: bool,
    target_checksum: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Metadata {
    #[serde(default)]
    version: Option<String>,
    #[serde(default)]
    files: Vec<MetaFile>,
    #[serde(default)]
    packs: Option<Vec<String>>,
}

#[derive(Deserialize)]
struct MetaFile {
    path: String,
    owner: String,
    checksum: String,
}

/// The Codex or Cursor ledger under `root`, for `provider` (`codex` / `cursor`).
pub fn ts_ledger(root: &Path, provider: &str) -> Result<Option<Adopted>, AdoptError> {
    let source = format!(".meowkit/state/{provider}-ledger.json");
    let Some(bytes) = read_record(root, &source)? else {
        return Ok(None);
    };
    let ledger: Ledger = parse(&source, &bytes)?;
    if ledger.version != "3.0" {
        return Err(AdoptError {
            path: source,
            reason: format!("unknown ledger version {:?}", ledger.version),
        });
    }
    let mut out = Adopted {
        kit_version: "unknown".into(),
        source,
        ..Adopted::default()
    };
    for row in ledger
        .installations
        .iter()
        .filter(|r| r.provider == provider && !r.global)
    {
        let Ok(item) = RelPath::new(&row.item.replace('\\', "/")) else {
            out.skipped += 1;
            continue;
        };
        let abs = item.under(root);
        let meta = std::fs::symlink_metadata(&abs);
        match meta {
            Ok(m) if m.is_file() => match file_sha(&abs) {
                Ok(sha) if sha == row.target_checksum => {
                    out.paths.insert(item.to_string(), sha);
                }
                _ => out.skipped += 1,
            },
            Ok(m) if m.is_dir() => match tree_files(&abs) {
                Ok(files) if tree_checksum(&files) == row.target_checksum => {
                    for (rel, sha) in files {
                        out.paths.insert(format!("{item}/{rel}"), sha);
                    }
                }
                _ => out.skipped += 1,
            },
            _ => out.skipped += 1,
        }
    }
    Ok(Some(out))
}

/// The Claude Code install metadata under `root`.
pub fn ts_metadata(root: &Path) -> Result<Option<Adopted>, AdoptError> {
    for source in [".meowkit/metadata.json", ".claude/metadata.json"] {
        let Some(bytes) = read_record(root, source)? else {
            continue;
        };
        let meta: Metadata = parse(source, &bytes)?;
        let mut out = Adopted {
            kit_version: meta.version.unwrap_or_else(|| "unknown".into()),
            packs: meta.packs.unwrap_or_default(),
            source: source.into(),
            ..Adopted::default()
        };
        for f in meta.files.iter().filter(|f| f.owner == "meowkit") {
            let rel = format!(".claude/{}", f.path.replace('\\', "/"));
            let Ok(path) = RelPath::new(&rel) else {
                out.skipped += 1;
                continue;
            };
            let abs = path.under(root);
            let regular = std::fs::symlink_metadata(&abs).is_ok_and(|m| m.is_file());
            match file_sha(&abs) {
                Ok(sha) if regular && sha == f.checksum => {
                    out.paths.insert(path.to_string(), sha);
                }
                _ => out.skipped += 1,
            }
        }
        return Ok(Some(out));
    }
    Ok(None)
}

/// Every regular file below `dir` as (relative POSIX path, SHA-256), sorted by
/// path the way JavaScript sorts strings (UTF-16 code units; equal to byte
/// order for the ASCII names a kit ships). Symlinks are not followed.
pub fn tree_files(dir: &Path) -> io::Result<Vec<(String, String)>> {
    let mut out = Vec::new();
    walk(dir, "", &mut out)?;
    out.sort_by(|a, b| a.0.encode_utf16().cmp(b.0.encode_utf16()));
    Ok(out)
}

/// The npm CLI's directory checksum over [`tree_files`].
pub fn tree_checksum(files: &[(String, String)]) -> String {
    let mut h = Sha256::new();
    for (rel, sha) in files {
        h.update(rel.as_bytes());
        h.update([0]);
        h.update(sha.as_bytes());
        h.update(b"\n");
    }
    hex(&h.finalize())
}

fn walk(dir: &Path, prefix: &str, out: &mut Vec<(String, String)>) -> io::Result<()> {
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let name = entry.file_name().to_string_lossy().into_owned();
        let rel = if prefix.is_empty() {
            name
        } else {
            format!("{prefix}/{name}")
        };
        let kind = entry.file_type()?;
        if kind.is_dir() {
            walk(&entry.path(), &rel, out)?;
        } else if kind.is_file() {
            out.push((rel, file_sha(&entry.path())?));
        }
    }
    Ok(())
}

fn file_sha(path: &Path) -> io::Result<String> {
    Ok(sha256_hex(&std::fs::read(path)?))
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn read_record(root: &Path, rel: &str) -> Result<Option<Vec<u8>>, AdoptError> {
    let err = |reason: String| AdoptError {
        path: rel.into(),
        reason,
    };
    let file = match std::fs::File::open(root.join(rel)) {
        Ok(f) => f,
        Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(err(e.to_string())),
    };
    let mut bytes = Vec::new();
    file.take(MAX_RECORD_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| err(e.to_string()))?;
    if bytes.len() as u64 > MAX_RECORD_BYTES {
        return Err(err(format!("larger than {MAX_RECORD_BYTES} bytes")));
    }
    Ok(Some(bytes))
}

fn parse<T: for<'de> Deserialize<'de>>(path: &str, bytes: &[u8]) -> Result<T, AdoptError> {
    serde_json::from_slice(bytes).map_err(|e| AdoptError {
        path: path.into(),
        reason: e.to_string(),
    })
}
