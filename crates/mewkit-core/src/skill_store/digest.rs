//! A skill directory's tree digest.
//!
//! Built on the directory listing and per-file SHA-256 the npm-install reader
//! already computes ([`crate::adopt::tree_files`]), plus one permission fact:
//! whether the file is executable. That is the only mode bit a skill needs
//! (its scripts run), so a checkout with a different umask, or a file copied
//! 0600, digests the same as the kit, while a script that lost its execute bit
//! does not.
use std::io;
use std::path::Path;

use sha2::{Digest, Sha256};

/// One regular file of a skill tree.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TreeFile {
    /// Path relative to the skill directory, `/`-separated.
    pub path: String,
    pub sha256: String,
    pub exec: bool,
}

/// Byproducts a runtime leaves in a skill directory; never part of the skill.
fn ignored(rel: &str) -> bool {
    rel.split('/')
        .any(|part| part == "__pycache__" || part == ".DS_Store")
}

/// Every regular file under `dir`, sorted by path. Symlinks are not followed.
/// A missing directory is an empty tree.
pub fn read_tree(dir: &Path) -> io::Result<Vec<TreeFile>> {
    let listed = match crate::adopt::tree_files(dir) {
        Ok(listed) => listed,
        Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(e) => return Err(e),
    };
    let mut out = Vec::with_capacity(listed.len());
    for (path, sha256) in listed.into_iter().filter(|(p, _)| !ignored(p)) {
        let exec = is_exec(&dir.join(&path))?;
        out.push(TreeFile { path, sha256, exec });
    }
    Ok(out)
}

/// SHA-256 over `path \0 x|- \0 sha256 \n` for each file, in path order.
pub fn tree_digest(files: &[TreeFile]) -> String {
    let mut sorted: Vec<&TreeFile> = files.iter().collect();
    sorted.sort_by(|a, b| a.path.cmp(&b.path));
    let mut h = Sha256::new();
    for f in sorted {
        h.update(f.path.as_bytes());
        h.update([0]);
        h.update(if f.exec { b"x" } else { b"-" });
        h.update([0]);
        h.update(f.sha256.as_bytes());
        h.update(b"\n");
    }
    crate::fsx::hex(&h.finalize())
}

#[cfg(unix)]
fn is_exec(path: &Path) -> io::Result<bool> {
    use std::os::unix::fs::PermissionsExt;
    Ok(std::fs::symlink_metadata(path)?.permissions().mode() & 0o111 != 0)
}

#[cfg(not(unix))]
fn is_exec(_path: &Path) -> io::Result<bool> {
    Ok(false)
}
