//! OS file locks as liveness markers. The OS releases a lock when its holder
//! dies (probed on APFS and on a Windows runner), so "held" means "alive".
//! Lock files never carry data: Windows locks are mandatory, so a locked file
//! cannot be read by anyone else.
use std::fs::{File, OpenOptions, TryLockError};
use std::io;
use std::path::Path;
use std::time::{Duration, Instant};

fn open(path: &Path, create: bool) -> io::Result<File> {
    if create && let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir)?;
    }
    OpenOptions::new()
        .create(create)
        .truncate(false)
        .write(true)
        .open(path)
}

/// Take the lock now or return `None` when someone else holds it.
pub fn try_hold(path: &Path) -> io::Result<Option<File>> {
    let file = open(path, true)?;
    match file.try_lock() {
        Ok(()) => Ok(Some(file)),
        Err(TryLockError::WouldBlock) => Ok(None),
        Err(TryLockError::Error(e)) => Err(e),
    }
}

/// Keep trying for up to `timeout`: a liveness probe may hold the lock for a
/// moment, and Windows may take a moment to release a dead holder's lock.
pub fn hold_within(path: &Path, timeout: Duration) -> io::Result<Option<File>> {
    let started = Instant::now();
    loop {
        if let Some(file) = try_hold(path)? {
            return Ok(Some(file));
        }
        if started.elapsed() >= timeout {
            return Ok(None);
        }
        std::thread::sleep(Duration::from_millis(20));
    }
}

/// True while a live process holds the lock at `path`. A missing file is not
/// held. The probe holds the lock for an instant when it is free.
pub fn is_held(path: &Path) -> bool {
    let Ok(file) = open(path, false) else {
        return false;
    };
    matches!(file.try_lock(), Err(TryLockError::WouldBlock))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn held_until_dropped_and_missing_is_free() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("x/alive.lock");
        assert!(!is_held(&path));
        let guard = try_hold(&path).unwrap().unwrap();
        assert!(is_held(&path));
        assert!(try_hold(&path).unwrap().is_none());
        drop(guard);
        assert!(!is_held(&path));
        assert!(
            hold_within(&path, Duration::from_millis(50))
                .unwrap()
                .is_some()
        );
    }
}
