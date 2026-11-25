//! A digest of an extracted kit tree, so a cache entry can be re-checked later.
//!
//! The cache lives in the project, which a cloned repository controls: an
//! entry found there is not trusted because its `meta.json` says it was
//! verified. Online, a hit is compared against a fresh extraction of the
//! verified archive; offline, against the tree digest recorded when the entry
//! was cached.
use std::path::Path;

use crate::fsx::sha256_hex;

/// SHA-256 over every file under `dir`: its `/`-separated relative path, its
/// content hash and its executable bit, in path order. `None` when the tree
/// holds a symlink or anything that is neither a file nor a directory, or
/// cannot be read: an extracted kit holds neither, so such a tree is not one.
pub fn tree_digest(dir: &Path) -> Option<String> {
    let mut lines = Vec::new();
    walk(dir, "", &mut lines)?;
    lines.sort();
    Some(sha256_hex(lines.concat().as_bytes()))
}

fn walk(dir: &Path, prefix: &str, lines: &mut Vec<String>) -> Option<()> {
    for entry in std::fs::read_dir(dir).ok()? {
        let entry = entry.ok()?;
        let name = entry.file_name().into_string().ok()?;
        let rel = if prefix.is_empty() {
            name
        } else {
            format!("{prefix}/{name}")
        };
        let meta = std::fs::symlink_metadata(entry.path()).ok()?;
        if meta.is_dir() {
            walk(&entry.path(), &rel, lines)?;
        } else if meta.is_file() {
            let hash = sha256_hex(&std::fs::read(entry.path()).ok()?);
            lines.push(format!("{rel}\0{hash}\0{}\n", executable(&meta)));
        } else {
            return None;
        }
    }
    Some(())
}

#[cfg(unix)]
fn executable(meta: &std::fs::Metadata) -> bool {
    use std::os::unix::fs::PermissionsExt;
    meta.permissions().mode() & 0o111 != 0
}

#[cfg(not(unix))]
fn executable(_: &std::fs::Metadata) -> bool {
    false
}
