//! Running `git`, `gh` and the worktree action the way the npm CLI does:
//! ARRAY argv, never a shell.
//!
//! Every argument on these paths can carry PR-authored text (a branch name, a
//! search term lifted from a diff). A shell would make that text executable, so
//! the program and its arguments are passed as a vector and nothing is ever
//! interpolated into a command string.
//!
//! [`Exec`] is a trait rather than a function pointer so a test can record what
//! WOULD have run — which is how the cleanup guard is tested without any
//! directory existing to delete.
use std::path::Path;
use std::process::Command;

/// What `execFileSync` hands back: whether the child exited 0, and both
/// streams as text.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExecResult {
    pub ok: bool,
    pub out: String,
    pub err: String,
}

impl ExecResult {
    pub fn failed(err: impl Into<String>) -> Self {
        Self {
            ok: false,
            out: String::new(),
            err: err.into(),
        }
    }
}

pub trait Exec {
    fn run(&self, file: &str, args: &[String], cwd: &Path) -> ExecResult;
}

/// The real subprocess runner.
pub struct RealExec;

impl Exec for RealExec {
    fn run(&self, file: &str, args: &[String], cwd: &Path) -> ExecResult {
        match Command::new(file).args(args).current_dir(cwd).output() {
            Ok(out) => ExecResult {
                ok: out.status.success(),
                out: String::from_utf8_lossy(&out.stdout).into_owned(),
                err: String::from_utf8_lossy(&out.stderr).into_owned(),
            },
            // A binary that is not installed throws in Node with no captured
            // stderr, so the npm CLI falls back to the error MESSAGE — and that
            // message is what callers of `review prepare` see when `gh` is
            // absent. Same text here, or the two CLIs disagree on the one
            // outcome an operator hits most often.
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                ExecResult::failed(format!("spawnSync {file} ENOENT"))
            }
            Err(e) => ExecResult::failed(e.to_string()),
        }
    }
}

/// Owned argv, for the call sites that build arguments from runtime values.
pub fn argv(parts: &[&str]) -> Vec<String> {
    parts.iter().map(|p| (*p).to_string()).collect()
}

#[cfg(test)]
#[path = "exec_tests.rs"]
mod tests;
