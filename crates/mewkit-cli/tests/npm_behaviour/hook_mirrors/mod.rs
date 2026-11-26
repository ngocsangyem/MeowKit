//! The shipped Node hook modules that re-implement what the Rust CLI owns.
//!
//! Hooks stay `.cjs` and ship without a build, so some of them carry a
//! hand-written copy of a rule or a file format the CLI also implements. A copy
//! drifts silently: the CLI's tests stay green, the hook's stay green, and the
//! rule it enforces misbehaves in a real project. Each test here runs the REAL
//! Rust binary on a temp project to produce the artifact, then the REAL `.cjs`
//! module over it, and asserts the module's verdict — plus a negative case that
//! changes the artifact's shape, proving the check would notice a rename.
//!
//! Coverage by module:
//! - `meowkit-paths.cjs`: where `note`, `task new --activate` and `orient` put
//!   and look for state.
//! - `orientation-ritual.cjs`: its end-to-end acceptance of the orientation is in
//!   `hook_contract.rs`; this file adds the runtime descriptor the Rust schema
//!   module produces (`init --target claude-code` writes it through the adapters
//!   launcher), which that test writes by hand.
mod meowkit_paths;
mod orientation_ritual;

use std::ffi::OsStr;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde_json::Value;

use crate::npm;

/// A temp project and a temp home, kept alive by the guard.
pub(super) struct Scratch {
    _guard: tempfile::TempDir,
    pub(super) project: PathBuf,
    pub(super) home: PathBuf,
}

pub(super) fn scratch(prefix: &str, fixture: &str) -> Scratch {
    let guard = tempfile::Builder::new()
        .prefix(prefix)
        .tempdir()
        .expect("create the scratch dir");
    let project = guard.path().join("project");
    let home = guard.path().join("home");
    std::fs::create_dir_all(&home).expect("create the temp home");
    npm::copy_fixture(fixture, &project);
    Scratch {
        _guard: guard,
        project,
        home,
    }
}

pub(super) fn rust(s: &Scratch, args: &[&str], stdin: Option<&str>) -> npm::Run {
    npm::run_rust(&s.project, &s.home, args, &[], stdin)
}

pub(super) fn hook(rel: &str) -> PathBuf {
    let path = npm::repo_root().join(".claude/hooks").join(rel);
    assert!(
        path.is_file(),
        "the shipped hook is missing: {}",
        path.display()
    );
    path
}

/// `(exit code, stdout + stderr)` of `node <args>` run in the project.
pub(super) fn node(s: &Scratch, args: &[&OsStr]) -> (i32, String) {
    let out = Command::new("node")
        .args(args)
        .current_dir(&s.project)
        .env("CLAUDE_PROJECT_DIR", &s.project)
        .env("HOME", &s.home)
        .env("USERPROFILE", &s.home)
        .output()
        .expect("spawn node");
    let text = format!(
        "{}{}",
        String::from_utf8_lossy(&out.stdout),
        String::from_utf8_lossy(&out.stderr)
    );
    (out.status.code().unwrap_or(-1), text.trim().to_string())
}

pub(super) fn copy_tree(source: &Path, dest: &Path) {
    std::fs::create_dir_all(dest).expect("create a directory");
    for entry in std::fs::read_dir(source).expect("read a directory") {
        let entry = entry.expect("a directory entry");
        let target = dest.join(entry.file_name());
        if entry.path().is_dir() {
            copy_tree(&entry.path(), &target);
        } else {
            std::fs::copy(entry.path(), &target).expect("copy a file");
        }
    }
}
