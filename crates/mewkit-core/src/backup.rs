//! Copies of every file an execution will change, taken before the first write.
//!
//! The journal undoes a failure inside a running process; a backup is what is
//! left if the process itself dies, or if the user wants yesterday's file back.
//! Backups can hold credentials from user-owned files, so the directory is 0700.
use std::io;
use std::path::{Path, PathBuf};

use crate::fsx::{RelPath, atomic_write};

/// Copy each existing `paths` entry from `root` into a new directory under
/// `backups_dir`. Returns `None` (and creates nothing) when none of them exist.
pub fn take(root: &Path, paths: &[&RelPath], backups_dir: &Path) -> io::Result<Option<PathBuf>> {
    let existing: Vec<&&RelPath> = paths.iter().filter(|p| p.under(root).is_file()).collect();
    if existing.is_empty() {
        return Ok(None);
    }
    let dest = unique_dir(backups_dir)?;
    for path in existing {
        let src = path.under(root);
        atomic_write(&path.under(&dest), &std::fs::read(&src)?, mode_of(&src)?)?;
    }
    Ok(Some(dest))
}

/// `<backups_dir>/<unix-seconds>-<pid>[-n]`, created 0700.
fn unique_dir(backups_dir: &Path) -> io::Result<PathBuf> {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |d| d.as_secs());
    let base = format!("{secs}-{}", std::process::id());
    std::fs::create_dir_all(backups_dir)?;
    for n in 0u32.. {
        let name = if n == 0 {
            base.clone()
        } else {
            format!("{base}-{n}")
        };
        let dir = backups_dir.join(name);
        match create_private_dir(&dir) {
            Ok(()) => return Ok(dir),
            Err(e) if e.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(e) => return Err(e),
        }
    }
    unreachable!("u32 range exhausted")
}

#[cfg(unix)]
fn create_private_dir(dir: &Path) -> io::Result<()> {
    use std::os::unix::fs::DirBuilderExt;
    std::fs::DirBuilder::new().mode(0o700).create(dir)
}

#[cfg(not(unix))]
fn create_private_dir(dir: &Path) -> io::Result<()> {
    std::fs::create_dir(dir)
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn copies_existing_files_only_into_a_private_dir() {
        let root = tempfile::tempdir().unwrap();
        let backups = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(root.path().join("a")).unwrap();
        std::fs::write(root.path().join("a/f.txt"), b"old").unwrap();
        let (f, missing) = (
            RelPath::new("a/f.txt").unwrap(),
            RelPath::new("new.txt").unwrap(),
        );
        let dir = take(root.path(), &[&f, &missing], backups.path())
            .unwrap()
            .unwrap();
        assert_eq!(std::fs::read(dir.join("a/f.txt")).unwrap(), b"old");
        assert!(!dir.join("new.txt").exists());
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(
                std::fs::metadata(&dir).unwrap().permissions().mode() & 0o777,
                0o700
            );
        }
        assert!(
            take(root.path(), &[&missing], backups.path())
                .unwrap()
                .is_none()
        );
    }
}
