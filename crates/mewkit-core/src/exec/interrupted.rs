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

use crate::fsx::{RelPath, atomic_write};
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

/// Put back every path an interrupted run listed, then drop the record.
/// Returns the paths restored, or `None` when there was nothing to recover.
pub(super) fn recover(layout: &Layout, file: &Path) -> io::Result<Option<Vec<RelPath>>> {
    let bytes = match std::fs::read(file) {
        Ok(b) => b,
        Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(e),
    };
    let record: Record = serde_json::from_slice(&bytes).map_err(|e| {
        io::Error::new(
            io::ErrorKind::InvalidData,
            format!(
                "{} is unreadable ({e}); remove it after checking your files",
                file.display()
            ),
        )
    })?;
    let mut restored = Vec::new();
    for raw in &record.paths {
        let path = RelPath::new(raw)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e.to_string()))?;
        // Never through a symlinked parent, same as a normal run.
        layout
            .check_parents(&path)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e.to_string()))?;
        let target = layout.resolve(&path);
        let saved = record.backup.as_ref().map(|b| path.under(b));
        match saved.filter(|s| s.is_file()) {
            Some(saved) => atomic_write(&target, &std::fs::read(&saved)?, mode_of(&saved)?)?,
            None => match std::fs::remove_file(&target) {
                Err(e) if e.kind() == io::ErrorKind::NotFound => {}
                other => other?,
            },
        }
        restored.push(path);
    }
    end(file)?;
    Ok(Some(restored))
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
