//! A redirected home for every command a test runs.
//!
//! An installer writes into `~`, so a test that inherits the developer's real
//! `HOME` can damage it. Every spawned command therefore gets `HOME` and
//! `USERPROFILE` pointing into a fresh temp directory, and the harness refuses
//! to spawn anything whose home is not under the OS temp dir.
use std::path::{Path, PathBuf};
use std::process::{Command, Output};

use tempfile::TempDir;

/// Prefixes of environment variables that could steer an install, stripped
/// from every spawned command so the invoking shell cannot decide a result.
const STRIPPED_PREFIXES: [&str; 3] = ["MEOWKIT_", "MEOW_", "MK_"];

/// A scratch home and project root, removed when dropped.
pub struct TempHome {
    dir: TempDir,
}

impl TempHome {
    pub fn new() -> Self {
        let dir = tempfile::Builder::new()
            .prefix("mewkit-next test-")
            .tempdir()
            .expect("create temp dir");
        std::fs::create_dir_all(dir.path().join("home")).expect("create home");
        std::fs::create_dir_all(dir.path().join("project")).expect("create project");
        Self { dir }
    }

    pub fn home(&self) -> PathBuf {
        self.dir.path().join("home")
    }

    pub fn project(&self) -> PathBuf {
        self.dir.path().join("project")
    }

    /// A command for `program` in the scratch project, with the redirected home.
    pub fn command(&self, program: impl AsRef<std::ffi::OsStr>) -> Command {
        let home = self.home();
        assert_home_is_temp(&home);
        let mut cmd = Command::new(program);
        for (key, _) in std::env::vars_os() {
            let key_str = key.to_string_lossy();
            if STRIPPED_PREFIXES.iter().any(|p| key_str.starts_with(p)) {
                cmd.env_remove(&key);
            }
        }
        cmd.current_dir(self.project())
            .env("HOME", &home)
            .env("USERPROFILE", &home);
        cmd
    }

    /// Run the `mewkit-next` binary built for this test run.
    pub fn mewkit_next(&self, args: &[&str]) -> Output {
        self.command(env!("CARGO_BIN_EXE_mewkit-next"))
            .args(args)
            .output()
            .expect("spawn mewkit-next")
    }
}

/// Abort unless `home` resolves to a path under the OS temp dir.
pub fn assert_home_is_temp(home: &Path) {
    let temp = canonical(&std::env::temp_dir());
    let home = canonical(home);
    assert!(
        home.starts_with(&temp) && home != temp,
        "refusing to run: HOME {} is not under the temp dir {}",
        home.display(),
        temp.display()
    );
}

/// Canonical form, so a symlinked temp dir (macOS `/var` → `/private/var`) compares equal.
fn canonical(path: &Path) -> PathBuf {
    std::fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf())
}
