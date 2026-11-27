//! `~/.meowkit/host/`: machine-wide state shared by every project and runtime.
//! Created owner-only (0700 on Unix): it lists pids, worktrees and job logs.
use std::io;
use std::path::{Path, PathBuf};

/// The on-disk state layout version. A binary that finds a NEWER version
/// reads nothing and reports `unknown` rather than misreading the files.
pub const STATE_VERSION: u32 = 1;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct HostPaths {
    pub root: PathBuf,
}

impl HostPaths {
    /// `<home>/.meowkit/host`.
    pub fn under_home(home: &Path) -> Self {
        Self {
            root: home.join(".meowkit").join("host"),
        }
    }

    /// From `HOME` / `USERPROFILE`; `None` when neither is set.
    pub fn resolve() -> Option<Self> {
        crate::config::home_dir().map(|home| Self::under_home(&home))
    }

    pub fn status(&self) -> PathBuf {
        self.root.join("status.json")
    }
    pub fn version(&self) -> PathBuf {
        self.root.join("VERSION")
    }
    pub fn stats(&self) -> PathBuf {
        self.root.join("stats.json")
    }
    pub fn sample_lock(&self) -> PathBuf {
        self.root.join("sample.lock")
    }
    pub fn dir(&self, name: &str) -> PathBuf {
        self.root.join(name)
    }

    /// Create the root owner-only and stamp `VERSION` when absent.
    pub fn ensure(&self) -> io::Result<()> {
        create_private_dir(&self.root)?;
        if !self.version().exists() {
            crate::fsx::atomic_write(
                &self.version(),
                format!("{STATE_VERSION}\n").as_bytes(),
                None,
            )?;
        }
        Ok(())
    }

    /// False when `VERSION` names a layout newer than this binary knows.
    pub fn version_readable(&self) -> bool {
        match std::fs::read_to_string(self.version()) {
            Ok(text) => text.trim().parse::<u32>().is_ok_and(|v| v <= STATE_VERSION),
            Err(_) => true,
        }
    }
}

/// `create_dir_all`, then 0700 on Unix.
pub fn create_private_dir(dir: &Path) -> io::Result<()> {
    std::fs::create_dir_all(dir)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(dir, std::fs::Permissions::from_mode(0o700))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ensure_stamps_the_version_and_a_newer_one_is_unreadable() {
        let home = tempfile::tempdir().unwrap();
        let paths = HostPaths::under_home(home.path());
        paths.ensure().unwrap();
        assert_eq!(std::fs::read_to_string(paths.version()).unwrap(), "1\n");
        assert!(paths.version_readable());
        std::fs::write(paths.version(), "2\n").unwrap();
        assert!(!paths.version_readable());
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = std::fs::metadata(&paths.root).unwrap().permissions().mode();
            assert_eq!(mode & 0o777, 0o700);
        }
    }
}
