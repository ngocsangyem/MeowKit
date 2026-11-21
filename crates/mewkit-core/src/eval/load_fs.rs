//! Filesystem walking for the case loader, refusing anything that could reach
//! outside the case root or hide from the fingerprint.
//!
//! Every directory on the way from the root is checked with `symlink_metadata`,
//! not just the last one: a symlinked middle folder would otherwise let a case
//! hash and hand the runner files from anywhere. Entries that cannot be read
//! or whose names are not UTF-8 are errors, because a file the runner copies
//! but the hash skips would make two different inputs look identical.

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use super::load::LoadError;
use crate::fsx::RelPath;

pub(super) fn io_err(path: &Path) -> impl FnOnce(std::io::Error) -> LoadError + '_ {
    move |source| LoadError::Io {
        path: path.to_path_buf(),
        source,
    }
}

/// Directory entries by name. Dot entries are skipped when walking skill and
/// eval folders, but kept inside a fixture, where `.claude/` is content.
pub(super) fn sorted_entries(dir: &Path, keep_dot: bool) -> Result<Vec<String>, LoadError> {
    let mut names = Vec::new();
    for entry in fs::read_dir(dir).map_err(io_err(dir))? {
        let entry = entry.map_err(io_err(dir))?;
        let name = entry
            .file_name()
            .into_string()
            .map_err(|raw| LoadError::BadName {
                path: dir.join(raw).display().to_string(),
            })?;
        if keep_dot || !name.starts_with('.') {
            names.push(name);
        }
    }
    names.sort();
    Ok(names)
}

/// `rel` under `root` when it is a real directory reached through no symlink;
/// `None` when it does not exist or is not a directory.
pub(super) fn real_dir(root: &Path, rel: &str) -> Result<Option<PathBuf>, LoadError> {
    let mut path = root.to_path_buf();
    let mut walked = String::new();
    for part in rel.split('/') {
        path.push(part);
        walked = if walked.is_empty() {
            part.to_owned()
        } else {
            format!("{walked}/{part}")
        };
        match fs::symlink_metadata(&path) {
            Ok(m) if m.file_type().is_symlink() => return Err(LoadError::Symlink { path: walked }),
            Ok(m) if m.is_dir() => {}
            Ok(_) => return Ok(None),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(e) => return Err(io_err(&path)(e)),
        }
    }
    Ok(Some(path))
}

pub(super) fn read_regular(path: &Path, rel: &str) -> Result<Vec<u8>, LoadError> {
    let meta = fs::symlink_metadata(path).map_err(io_err(path))?;
    if meta.file_type().is_symlink() {
        return Err(LoadError::Symlink { path: rel.into() });
    }
    fs::read(path).map_err(io_err(path))
}

/// Add every file under a fixture directory to the fingerprint.
pub(super) fn hash_fixture(
    root: &Path,
    rel: &str,
    hashed: &mut BTreeMap<String, Vec<u8>>,
) -> Result<RelPath, LoadError> {
    let rel_path = RelPath::new(rel).map_err(|e| LoadError::Parse {
        path: rel.into(),
        reason: e.to_string(),
    })?;
    let Some(top) = real_dir(root, rel)? else {
        return Err(LoadError::Io {
            path: rel_path.under(root),
            source: std::io::Error::new(std::io::ErrorKind::NotFound, "fixture folder not found"),
        });
    };
    let mut stack = vec![(top, rel.to_owned())];
    while let Some((dir, dir_rel)) = stack.pop() {
        for name in sorted_entries(&dir, true)? {
            let child_rel = format!("{dir_rel}/{name}");
            let child = dir.join(&name);
            let ft = fs::symlink_metadata(&child)
                .map_err(io_err(&child))?
                .file_type();
            if ft.is_symlink() {
                return Err(LoadError::Symlink { path: child_rel });
            } else if ft.is_dir() {
                stack.push((child, child_rel));
            } else {
                hashed.insert(child_rel.clone(), read_regular(&child, &child_rel)?);
            }
        }
    }
    Ok(rel_path)
}
