//! A rollback journal for one install: every change to disk goes through it.
//!
//! Before a path is first touched its pre-image (absent, or bytes + mode) is
//! recorded; [`Journal::rollback`] restores pre-images in reverse order, deletes
//! files that did not exist, and removes directories it created once they are
//! empty again. Dropping a journal without [`Journal::commit`] rolls back, so an
//! early return or a panic mid-install leaves the tree as it was.
//!
//! Pre-images are held in memory: they cover a failed operation inside a
//! running process. Durable recovery after the process itself dies is the job
//! of the backup taken before the journal starts.
use std::collections::HashSet;
use std::io;
use std::path::{Path, PathBuf};

use crate::fsx::{RelPath, atomic_write};
use crate::layout::Layout;

enum PreImage {
    Absent,
    File { bytes: Vec<u8>, mode: Option<u32> },
}

pub struct Journal {
    layout: Layout,
    /// Pre-images in the order paths were first touched.
    entries: Vec<(PathBuf, PreImage)>,
    seen: HashSet<PathBuf>,
    /// Directories this journal created, in creation order.
    created_dirs: Vec<PathBuf>,
    done: bool,
}

impl Journal {
    pub fn new(layout: &Layout) -> Self {
        Self {
            layout: layout.clone(),
            entries: Vec::new(),
            seen: HashSet::new(),
            created_dirs: Vec::new(),
            done: false,
        }
    }

    /// Write `bytes` to `path`, recording its pre-image first.
    pub fn write(&mut self, path: &RelPath, bytes: &[u8], mode: Option<u32>) -> io::Result<()> {
        let abs = self.layout.resolve(path);
        self.record(&abs)?;
        if let Some(parent) = abs.parent() {
            self.create_dirs(parent)?;
        }
        atomic_write(&abs, bytes, mode)
    }

    /// Remove `path` if it exists, recording its pre-image first.
    pub fn remove(&mut self, path: &RelPath) -> io::Result<()> {
        let abs = self.layout.resolve(path);
        self.record(&abs)?;
        match std::fs::remove_file(&abs) {
            Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(()),
            other => other,
        }
    }

    /// Keep every change; nothing is restored when the journal is dropped.
    pub fn commit(mut self) {
        self.done = true;
    }

    /// Undo every change, newest first. Keeps going past a failure so one
    /// unrestorable path does not leave the rest changed, and reports the first.
    pub fn rollback(&mut self) -> io::Result<()> {
        self.done = true;
        let mut first_err = None;
        for (abs, pre) in self.entries.drain(..).rev() {
            let result = match pre {
                PreImage::Absent => match std::fs::remove_file(&abs) {
                    Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(()),
                    other => other,
                },
                PreImage::File { bytes, mode } => atomic_write(&abs, &bytes, mode),
            };
            if let Err(e) = result {
                first_err.get_or_insert(e);
            }
        }
        for dir in self.created_dirs.drain(..).rev() {
            // Fails harmlessly when the user put something there meanwhile.
            let _ = std::fs::remove_dir(&dir);
        }
        first_err.map_or(Ok(()), Err)
    }

    fn record(&mut self, abs: &Path) -> io::Result<()> {
        if !self.seen.insert(abs.to_path_buf()) {
            return Ok(());
        }
        let pre = match std::fs::read(abs) {
            Ok(bytes) => PreImage::File {
                bytes,
                mode: file_mode(abs)?,
            },
            Err(e) if e.kind() == io::ErrorKind::NotFound => PreImage::Absent,
            Err(e) => return Err(e),
        };
        self.entries.push((abs.to_path_buf(), pre));
        Ok(())
    }

    /// `create_dir_all`, remembering each directory that did not exist.
    fn create_dirs(&mut self, dir: &Path) -> io::Result<()> {
        let missing: Vec<PathBuf> = dir
            .ancestors()
            .take_while(|d| *d != self.layout.root() && !d.exists())
            .map(Path::to_path_buf)
            .collect();
        std::fs::create_dir_all(dir)?;
        self.created_dirs.extend(missing.into_iter().rev());
        Ok(())
    }
}

impl Drop for Journal {
    fn drop(&mut self) {
        if !self.done {
            let _ = self.rollback();
        }
    }
}

#[cfg(unix)]
fn file_mode(path: &Path) -> io::Result<Option<u32>> {
    use std::os::unix::fs::PermissionsExt;
    Ok(Some(std::fs::metadata(path)?.permissions().mode() & 0o7777))
}

#[cfg(not(unix))]
fn file_mode(_path: &Path) -> io::Result<Option<u32>> {
    Ok(None)
}

#[cfg(test)]
#[path = "journal_tests.rs"]
mod tests;
