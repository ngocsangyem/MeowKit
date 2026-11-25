//! Durable recovery when the process dies mid-apply.
//!
//! The journal rolls back a failure inside a running process, but a kill or
//! power loss skips it. So before the first write the executor records which
//! paths it will change and where their backup is; the record is removed once
//! the ownership index is written. A later run that finds the record restores
//! every listed path from the backup (deleting the ones that did not exist)
//! before it decides anything, so it starts from the tree as it was.
use std::io;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::fsx::{RelPath, atomic_write, check_within, is_never_delete};
use crate::layout::Layout;

#[derive(Serialize, Deserialize)]
struct Record {
    /// The backup taken before the run; `None` when no listed path existed.
    backup: Option<PathBuf>,
    /// Every path the run was going to write or remove, index file included.
    paths: Vec<String>,
}

/// The record sits beside the scope lock, which serializes every run.
pub(super) fn record_file(lock_file: &RelPath) -> RelPath {
    let dir = lock_file.as_str().rsplit_once('/').map_or("", |(d, _)| d);
    let name = "mewkit-interrupted.json";
    RelPath::new(&if dir.is_empty() {
        name.to_owned()
    } else {
        format!("{dir}/{name}")
    })
    .expect("derived from a valid path")
}

/// Note that a run is about to change `paths`, backed up in `backup`.
pub(super) fn begin(file: &Path, backup: Option<&Path>, paths: &[&RelPath]) -> io::Result<()> {
    let record = Record {
        backup: backup.map(Path::to_path_buf),
        paths: paths.iter().map(|p| p.to_string()).collect(),
    };
    let json = serde_json::to_vec_pretty(&record).map_err(io::Error::other)?;
    atomic_write(file, &json, None)
}

/// The run finished; nothing is left to recover.
pub(super) fn end(file: &Path) -> io::Result<()> {
    match std::fs::remove_file(file) {
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(()),
        other => other,
    }
}

/// Whether an earlier run died before finishing.
pub(super) fn pending(file: &Path) -> bool {
    file.is_file()
}

/// What [`recover`] found.
pub(super) enum Recovery {
    /// No earlier run was interrupted.
    Nothing,
    /// The listed paths were put back.
    Restored(Vec<RelPath>),
    /// The record names a backup or path this scope never writes, so it was not
    /// acted on; the message says why.
    Ignored(String),
}

/// What a genuine record can name: the scope's write roots and index file, and
/// a backup inside the scope's backups directory.
pub(super) struct Bounds<'a> {
    pub roots: &'a [RelPath],
    pub index_file: &'a RelPath,
    pub backups_dir: &'a Path,
}

/// Put back every path an interrupted run listed, then drop the record.
///
/// The record sits in the project, so a cloned repository can supply one. It is
/// acted on only when every path is one this scope may write and the backup
/// lies inside the scope's backups directory: anything else would let a
/// committed record copy a file from outside into the project, or delete
/// project files the kit never owned.
pub(super) fn recover(layout: &Layout, file: &Path, bounds: &Bounds<'_>) -> io::Result<Recovery> {
    let ignored = |why: String| {
        Ok(Recovery::Ignored(format!(
            "ignored {}: {why}; it was not written by an interrupted mewkit run",
            file.display()
        )))
    };
    match std::fs::symlink_metadata(file) {
        Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(Recovery::Nothing),
        Err(e) => return Err(e),
        Ok(meta) if meta.file_type().is_symlink() => return ignored("it is a symlink".into()),
        Ok(_) => {}
    }
    let bytes = std::fs::read(file)?;
    let record: Record = serde_json::from_slice(&bytes).map_err(|e| {
        io::Error::new(
            io::ErrorKind::InvalidData,
            format!(
                "{} is unreadable ({e}); remove it after checking your files",
                file.display()
            ),
        )
    })?;
    let backup = match &record.backup {
        None => None,
        Some(dir) => match inside_backups(dir, bounds.backups_dir) {
            Some(real) => Some(real),
            None => {
                return ignored(format!(
                    "its backup {} is not a mewkit backup",
                    dir.display()
                ));
            }
        },
    };
    // Every path is checked before any is touched, so a bad entry restores nothing.
    let mut paths = Vec::new();
    for raw in &record.paths {
        let Ok(path) = RelPath::new(raw) else {
            return ignored(format!("it lists {raw:?}, which is not a relative path"));
        };
        let in_scope = path == *bounds.index_file
            || (check_within(&path, bounds.roots).is_ok() && !is_never_delete(&path));
        if !in_scope {
            return ignored(format!("it lists {path}, which this install never writes"));
        }
        // Never through a symlinked parent, same as a normal run.
        layout
            .check_parents(&path)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e.to_string()))?;
        let saved = backup
            .as_ref()
            .map(|b| path.under(b))
            .filter(|s| s.is_file());
        // A link inside the backup would restore a file from elsewhere.
        if let (Some(s), Some(b)) = (&saved, &backup)
            && !inside_dir(s, b)
        {
            return ignored(format!("its backup of {path} leads outside the backup"));
        }
        paths.push((path, saved));
    }
    let mut restored = Vec::new();
    for (path, saved) in paths {
        let target = layout.resolve(&path);
        match saved {
            Some(saved) => atomic_write(&target, &std::fs::read(&saved)?, mode_of(&saved)?)?,
            None => match std::fs::remove_file(&target) {
                Err(e) if e.kind() == io::ErrorKind::NotFound => {}
                other => other?,
            },
        }
        restored.push(path);
    }
    end(file)?;
    Ok(Recovery::Restored(restored))
}

/// `dir` resolved, when it lies strictly inside `backups_dir` once both are.
fn inside_backups(dir: &Path, backups_dir: &Path) -> Option<PathBuf> {
    let real = dir.canonicalize().ok()?;
    let base = backups_dir.canonicalize().ok()?;
    (real != base && real.starts_with(&base)).then_some(real)
}

/// Whether `path` resolves inside the already-resolved directory `dir`.
fn inside_dir(path: &Path, dir: &Path) -> bool {
    path.canonicalize().is_ok_and(|real| real.starts_with(dir))
}

#[cfg(unix)]
fn mode_of(path: &Path) -> io::Result<Option<u32>> {
    use std::os::unix::fs::PermissionsExt;
    Ok(Some(std::fs::metadata(path)?.permissions().mode() & 0o7777))
}

#[cfg(not(unix))]
fn mode_of(_path: &Path) -> io::Result<Option<u32>> {
    Ok(None)
}
