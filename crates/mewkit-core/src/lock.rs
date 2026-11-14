//! One writer per scope: a second `mewkit` (or a concurrent run of the
//! same one) waiting on a half-applied install would see a torn tree.
use std::fs::{File, OpenOptions, TryLockError};
use std::io;
use std::path::Path;

/// Held for the life of the value; the OS releases it if the process dies.
pub struct ScopeLock {
    _file: File,
}

#[derive(Debug, thiserror::Error)]
pub enum LockError {
    #[error("another mewkit run holds {0}; wait for it to finish")]
    Busy(String),
    #[error("cannot open lock file {path}: {source}")]
    Io { path: String, source: io::Error },
}

impl ScopeLock {
    /// Take the lock at `file` without waiting.
    pub fn acquire(file: &Path) -> Result<Self, LockError> {
        let io_err = |source| LockError::Io {
            path: file.display().to_string(),
            source,
        };
        if let Some(dir) = file.parent() {
            std::fs::create_dir_all(dir).map_err(io_err)?;
        }
        let handle = OpenOptions::new()
            .create(true)
            .truncate(false)
            .write(true)
            .open(file)
            .map_err(io_err)?;
        match handle.try_lock() {
            Ok(()) => Ok(Self { _file: handle }),
            Err(TryLockError::WouldBlock) => Err(LockError::Busy(file.display().to_string())),
            Err(TryLockError::Error(e)) => Err(io_err(e)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn second_holder_is_refused_until_the_first_drops() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("state/mewkit.lock");
        let first = ScopeLock::acquire(&file).unwrap();
        assert!(matches!(ScopeLock::acquire(&file), Err(LockError::Busy(_))));
        drop(first);
        assert!(ScopeLock::acquire(&file).is_ok());
    }
}
