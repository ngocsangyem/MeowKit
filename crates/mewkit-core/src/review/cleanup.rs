//! `review cleanup` — hand the session's own worktree back to the
//! manifest-owned worktree action, and keep the audit trail.
//!
//! ## Why this file contains no delete
//!
//! Deleting a worktree needs an ownership proof this process cannot make: the
//! nonce in the manifest must match the back-reference INSIDE the worktree, the
//! worktree must be detached, under `.worktrees/`, named for the manifest's
//! pr/session, and not the main checkout. That guard lives in the worktree
//! action, so cleanup EXECS it and reports what it said. There is deliberately
//! no filesystem removal anywhere on this path: a refusal cannot half-delete
//! something, because nothing here can delete at all.
//!
//! The session directory — verdict, proof bundle, evidence — is kept on
//! purpose. It is what a human reads at Gate 2, and it has to outlive the
//! worktree it describes.
use std::path::{Path, PathBuf};

use serde::Serialize;

use super::exec::{Exec, argv};
use super::session::{relative, session_dir};

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupResult {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub removed_worktree: Option<bool>,
}

impl CleanupResult {
    fn refused(error: String) -> Self {
        Self {
            ok: false,
            error: Some(error),
            removed_worktree: None,
        }
    }
}

pub struct CleanupOptions<'a> {
    pub session: &'a str,
    pub cwd: &'a Path,
    /// Overridden only by tests; production uses the kit's own action.
    pub worktree_script: Option<PathBuf>,
}

/// The kit's worktree entry point, relative to the invocation directory.
pub fn default_worktree_script(cwd: &Path) -> PathBuf {
    cwd.join(".claude")
        .join("skills")
        .join("worktree")
        .join("scripts")
        .join("worktree.cjs")
}

pub fn cleanup(options: &CleanupOptions<'_>, exec: &dyn Exec) -> CleanupResult {
    let dir = session_dir(options.cwd, options.session);
    let manifest_path = dir.join("manifest.json");
    if !manifest_path.exists() {
        return CleanupResult::refused(format!(
            "no review session at {}",
            relative(options.cwd, &dir)
        ));
    }

    let script = options
        .worktree_script
        .clone()
        .unwrap_or_else(|| default_worktree_script(options.cwd));
    // The manifest is named RELATIVELY: the action resolves it against the git
    // root it finds for itself, so an absolute path from here could point at a
    // manifest outside the repository the action is willing to act on.
    let manifest_arg = relative(options.cwd, &manifest_path);
    let mut args = vec![script.to_string_lossy().into_owned()];
    args.extend(argv(&[
        "review-pr-cleanup",
        "--manifest",
        &manifest_arg,
        "--json",
    ]));
    let result = exec.run("node", &args, options.cwd);
    if !result.ok {
        let detail = if result.err.is_empty() {
            result.out
        } else {
            result.err
        };
        return CleanupResult::refused(format!("worktree cleanup refused/failed: {detail}"));
    }
    CleanupResult {
        ok: true,
        error: None,
        removed_worktree: Some(true),
    }
}

#[cfg(test)]
#[path = "cleanup_tests.rs"]
mod tests;
