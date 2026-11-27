//! Guarded removal for tier 1 cleanup: an item must be a plain path under
//! the host root, not a protected file, free of symlinks on the way and
//! inside, and owned by the root's owner. It is renamed to a trash name in
//! its own directory, then deleted.
use std::io;
use std::path::{Component, Path};

use super::clean::{Item, entries};
use super::paths::HostPaths;

const NEVER: &[&str] = &["stats.json", "VERSION"];

#[cfg(unix)]
fn same_owner(a: &std::fs::Metadata, b: &std::fs::Metadata) -> bool {
    use std::os::unix::fs::MetadataExt;
    a.uid() == b.uid()
}
#[cfg(not(unix))]
fn same_owner(_: &std::fs::Metadata, _: &std::fs::Metadata) -> bool {
    true
}

/// Refuse anything outside the root, a protected file, a symlink on the way
/// or inside, or an entry owned by someone else.
fn check(root: &Path, path: &Path, owner: &std::fs::Metadata) -> io::Result<()> {
    let rel = path
        .strip_prefix(root)
        .map_err(|_| io::Error::other("outside the host directory"))?;
    if rel.components().any(|c| !matches!(c, Component::Normal(_))) || rel.as_os_str().is_empty() {
        return Err(io::Error::other(
            "not a plain path under the host directory",
        ));
    }
    if path
        .file_name()
        .and_then(|n| n.to_str())
        .is_some_and(|n| NEVER.contains(&n))
    {
        return Err(io::Error::other("protected file"));
    }
    crate::fsx::refuse_symlinks(root, path)?;
    let meta = std::fs::symlink_metadata(path)?;
    if !same_owner(&meta, owner) {
        return Err(io::Error::other("owned by another user"));
    }
    if meta.is_dir() {
        for child in entries(path) {
            if std::fs::symlink_metadata(&child)?.is_dir() {
                check(root, &child, owner)?;
            } else {
                crate::fsx::refuse_symlinks(root, &child)?;
            }
        }
    }
    Ok(())
}

/// Rename into a trash name beside it, then delete. Returns bytes freed.
pub fn remove(paths: &HostPaths, item: &Item) -> io::Result<u64> {
    let owner = std::fs::symlink_metadata(&paths.root)?;
    check(&paths.root, &item.path, &owner)?;
    let dir = item
        .path
        .parent()
        .ok_or_else(|| io::Error::other("no parent"))?;
    let stamp = crate::fsx::sha256_hex(
        format!("{}{}", item.path.display(), super::time_now_ms()).as_bytes(),
    );
    let trash = dir.join(format!(".meowkit-trash-{}", &stamp[..8]));
    std::fs::rename(&item.path, &trash)?;
    if std::fs::symlink_metadata(&trash)?.is_dir() {
        std::fs::remove_dir_all(&trash)?;
    } else {
        std::fs::remove_file(&trash)?;
    }
    Ok(item.bytes)
}
