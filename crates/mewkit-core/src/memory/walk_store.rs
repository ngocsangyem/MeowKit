//! Scan-SURFACE discovery for the committed team-memory store, kept separate from
//! the lint that interprets what it finds.
//!
//! Port of `core/walk-memory-store.ts`. The surface is derived from the documented
//! READ, not from a guess about it: read-set skills run
//! `grep -ril "<task keywords>" .meowkit/memory/`, which is recursive and not
//! extension-filtered. So the walk is recursive and returns every regular file —
//! and anything it cannot traverse is reported as unreadable rather than skipped,
//! because a guard that silently drops what it cannot open is worse than no guard.
use std::path::{Path, PathBuf};

use super::errno::errno_of;
use super::finding::{ContentFinding, MemoryFindingKind};

/// Bounded recursion so a deep or symlinked tree can never spin the walk.
const MAX_WALK_DEPTH: usize = 12;

/// A path the walk could not use — each one is a FAIL finding, not a skip.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct UnreadablePath {
    pub path: PathBuf,
    pub detail: String,
}

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct StoreWalk {
    /// Regular files to scan, in stable order.
    pub files: Vec<PathBuf>,
    pub unreadable: Vec<UnreadablePath>,
}

/// What a read of one store file produced.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ReadForScan {
    Body(String),
    Finding(ContentFinding),
}

/// Walk the store the way the documented `grep -ril` read does: recursively, every
/// file.
pub fn walk_store(dir: &Path) -> StoreWalk {
    walk_at_depth(dir, 0)
}

fn walk_at_depth(dir: &Path, depth: usize) -> StoreWalk {
    let mut out = StoreWalk::default();
    if depth > MAX_WALK_DEPTH {
        out.unreadable.push(UnreadablePath {
            path: dir.to_path_buf(),
            detail: format!("nesting deeper than {MAX_WALK_DEPTH} levels was not scanned"),
        });
        return out;
    }
    let entries = match std::fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(error) => {
            out.unreadable.push(UnreadablePath {
                path: dir.to_path_buf(),
                detail: format!("directory could not be read ({})", errno_of(&error)),
            });
            return out;
        }
    };

    let mut rows: Vec<(String, PathBuf, Option<std::fs::FileType>)> = Vec::new();
    for entry in entries {
        match entry {
            Ok(entry) => {
                let name = entry.file_name().to_string_lossy().into_owned();
                rows.push((name, entry.path(), entry.file_type().ok()));
            }
            Err(error) => out.unreadable.push(UnreadablePath {
                path: dir.to_path_buf(),
                detail: format!("directory could not be read ({})", errno_of(&error)),
            }),
        }
    }
    // The TS walk sorts with `localeCompare`, which is case-insensitive before it
    // is case-sensitive. Case-folded first, raw as the tie-break, keeps the common
    // store (`decisions.md`, `gotchas.md`, `notes.txt`) in the same order and stays
    // deterministic for the rest.
    rows.sort_by(|a, b| {
        a.0.to_lowercase()
            .cmp(&b.0.to_lowercase())
            .then_with(|| a.0.cmp(&b.0))
    });

    for (_, path, file_type) in rows {
        let Some(file_type) = file_type else {
            out.unreadable.push(UnreadablePath {
                path,
                detail: "not a regular file — not scanned".to_string(),
            });
            continue;
        };
        if file_type.is_symlink() {
            // Never followed: a symlink out of the store is a delivery channel the
            // reviewer cannot see in the diff. Reported so it cannot pass
            // unnoticed either.
            out.unreadable.push(UnreadablePath {
                path,
                detail: "symbolic link in the store — not followed, not scanned".to_string(),
            });
        } else if file_type.is_dir() {
            let nested = walk_at_depth(&path, depth + 1);
            out.files.extend(nested.files);
            out.unreadable.extend(nested.unreadable);
        } else if file_type.is_file() {
            out.files.push(path);
        } else {
            out.unreadable.push(UnreadablePath {
                path,
                detail: "not a regular file — not scanned".to_string(),
            });
        }
    }
    out
}

/// Read one store file, gating on size BEFORE the string read so an oversized file
/// cannot throw into a swallowed catch.
///
/// Invalid UTF-8 is replaced rather than rejected, matching Node's
/// `readFileSync(path, "utf-8")`: a mojibake file still gets scanned.
pub fn read_for_scan(path: &Path, max_bytes: u64) -> ReadForScan {
    let size = match std::fs::metadata(path) {
        Ok(meta) => meta.len(),
        Err(error) => {
            return ReadForScan::Finding(ContentFinding {
                line: 0,
                kind: MemoryFindingKind::Unreadable,
                detail: format!("could not be stat'd ({})", errno_of(&error)),
            });
        }
    };
    if size > max_bytes {
        return ReadForScan::Finding(ContentFinding {
            line: 0,
            kind: MemoryFindingKind::ByteCap,
            detail: format!(
                "{size} bytes exceeds the {max_bytes}-byte cap — not scanned; prune or split the store"
            ),
        });
    }
    match std::fs::read(path) {
        Ok(bytes) => ReadForScan::Body(String::from_utf8_lossy(&bytes).into_owned()),
        Err(error) => ReadForScan::Finding(ContentFinding {
            line: 0,
            kind: MemoryFindingKind::Unreadable,
            detail: format!("could not be read ({})", errno_of(&error)),
        }),
    }
}
