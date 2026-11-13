//! Finding the project a write belongs to.
//!
//! Port of `state/meowkit-root-resolver.ts`. It keys off the version-control
//! root (`.git`, a directory OR a worktree file) as the primary sentinel, with a
//! `package.json` + existing `.meowkit/` fallback for a non-git checkout. It
//! NEVER keys off a provider directory (`.claude/`, `.codex/`, `.cursor/`):
//! those are install targets, not state-discovery sentinels.
use std::path::{Path, PathBuf};

/// A bounded walk, so a symlink loop or a pathologically deep tree cannot spin.
const DEFAULT_MAX_DEPTH: usize = 40;

/// A `.git` DIRECTORY (a normal clone) or a `.git` FILE (a worktree or
/// submodule) both mark a version-control root.
fn is_git_root(dir: &Path) -> bool {
    dir.join(".git").exists()
}

/// Non-git checkout: only a directory that already owns BOTH a manifest AND a
/// materialized `.meowkit/` counts. `package.json` alone is not enough — every
/// nested package has one — and the existing `.meowkit/` is what disambiguates
/// the true project state root.
fn is_fallback_root(dir: &Path) -> bool {
    dir.join("package.json").exists() && dir.join(".meowkit").is_dir()
}

/// Walk up from `start_dir` to the nearest project root. `.git` wins over the
/// fallback, and the NEAREST match wins (a nested package over its parent).
/// `None` at the filesystem root when nothing matches.
pub fn resolve_project_root(start_dir: &Path) -> Option<PathBuf> {
    resolve_project_root_bounded(start_dir, DEFAULT_MAX_DEPTH)
}

/// [`resolve_project_root`] with the walk depth named, for a test that needs to
/// prove the bound rather than trust it.
pub fn resolve_project_root_bounded(start_dir: &Path, max_depth: usize) -> Option<PathBuf> {
    // The resolved root is REALPATH'd, the way the TypeScript resolver does it:
    // a project reached through a symlink must resolve to one root, or two
    // sessions would write the same store through two different paths.
    let mut current = start_dir
        .canonicalize()
        .unwrap_or_else(|_| start_dir.to_path_buf());
    for _ in 0..max_depth {
        if is_git_root(&current) || is_fallback_root(&current) {
            return Some(current);
        }
        match current.parent() {
            // `dirname("/") === "/"` on the TypeScript side stops the walk; a
            // `None` parent is the same filesystem root.
            Some(parent) if parent != current => current = parent.to_path_buf(),
            _ => return None,
        }
    }
    None
}

#[cfg(test)]
#[path = "project_root_tests.rs"]
mod project_root_tests;
