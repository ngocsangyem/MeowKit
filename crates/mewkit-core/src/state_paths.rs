//! Pure path builders for the runtime-neutral `.meowkit/` taxonomy, plus the
//! runtime resolution of WHICH root a given project should use.
//!
//! Port of `state/meowkit-state-paths.ts` (the builders) and the `memory` half of
//! `state/resolve-state-dir.ts` (the pre-migration fallback). NO filesystem side
//! effects in the builders — callers create directories on write paths only;
//! `resolve_state_dir` reads the tree but never writes it.
//!
//! This module is the single authority for these paths. `adopt.rs` still formats
//! `.meowkit/state/{provider}-ledger.json` inline; that literal should be replaced
//! with [`MeowkitStatePaths::codex_ledger`] / [`MeowkitStatePaths::cursor_ledger`]
//! when the adopt path is next touched, so there is one place to change.
use std::path::{Path, PathBuf};

/// The project-local state root. Mirrors `.claude/hooks/lib/meowkit-paths.cjs`.
pub const MEOWKIT_DIR: &str = ".meowkit";

/// Where memory lived before the taxonomy settled.
const LEGACY_MEMORY: [&str; 2] = [".claude", "memory"];

/// Files that identify `.claude/memory/` as a real pre-migration MEMORY store.
///
/// Keying on "any entry" was too loose in both directions: unrelated writers
/// `mkdir -p` that path and drop a log into it, and the fallback then relocated
/// every state class — including the committed memory store — into a directory
/// `.gitignore` ignores. A store that is silently not committed defeats the
/// "reviewed in the PR diff" design.
const LEGACY_STORE_FILES: [&str; 2] = ["decisions.md", "gotchas.md"];

/// One taxonomy class under a project root.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum StateClass {
    Memory,
    Telemetry,
    State,
    Cache,
}

impl StateClass {
    pub fn as_str(self) -> &'static str {
        match self {
            StateClass::Memory => "memory",
            StateClass::Telemetry => "telemetry",
            StateClass::State => "state",
            StateClass::Cache => "cache",
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct MeowkitStatePaths {
    pub base: PathBuf,
    pub memory: PathBuf,
    pub telemetry: PathBuf,
    pub state: PathBuf,
    pub cache: PathBuf,
    pub migrations: PathBuf,
    /// Single project/migration lock authority (was `.mewkit/.lock`).
    pub migrate_lock: PathBuf,
    /// Per-store granularity locks, nested under the project lock.
    pub store_locks_dir: PathBuf,
    /// Project-local reconciliation ledger for the authored Codex bundle
    /// (PortableRegistryV3-shaped). Per-project storage — the home registry stays
    /// the authority for other providers. This is state, not source.
    pub codex_ledger: PathBuf,
    /// Project-local reconciliation ledger for the authored Cursor bundle. Same
    /// shape and rationale as [`MeowkitStatePaths::codex_ledger`].
    pub cursor_ledger: PathBuf,
}

/// Build the taxonomy paths from a resolved `.meowkit/` directory.
pub fn meowkit_state_paths(meowkit_root: &Path) -> MeowkitStatePaths {
    let state = meowkit_root.join("state");
    MeowkitStatePaths {
        base: meowkit_root.to_path_buf(),
        memory: meowkit_root.join("memory"),
        telemetry: meowkit_root.join("telemetry"),
        state: state.clone(),
        cache: meowkit_root.join("cache"),
        migrations: meowkit_root.join("migrations"),
        migrate_lock: state.join("migrate.lock"),
        store_locks_dir: state.join("locks"),
        codex_ledger: state.join("codex-ledger.json"),
        cursor_ledger: state.join("cursor-ledger.json"),
    }
}

/// The legacy memory directory for a project root (`.claude/memory`).
fn legacy_memory_dir(project_root: &Path) -> PathBuf {
    LEGACY_MEMORY
        .iter()
        .fold(project_root.to_path_buf(), |acc, part| acc.join(part))
}

/// True when the legacy tree holds a real MEMORY store and no `.meowkit/`
/// counterpart exists.
pub fn using_legacy_memory_tree(project_root: &Path) -> bool {
    if project_root.join(MEOWKIT_DIR).join("memory").exists() {
        return false;
    }
    let legacy = legacy_memory_dir(project_root);
    if !legacy.exists() {
        return false;
    }
    let Ok(entries) = std::fs::read_dir(&legacy) else {
        return false;
    };
    let names: Vec<String> = entries
        .filter_map(Result::ok)
        .map(|e| e.file_name().to_string_lossy().into_owned())
        .collect();
    LEGACY_STORE_FILES
        .iter()
        .any(|name| names.iter().any(|found| found == name))
}

/// Where session markers used to live, newest-first: the project root, then
/// inside the kit tree. A READER still accepts both, so a project that recorded
/// a pointer before the taxonomy settled keeps resolving it. No writer uses
/// them — a write always lands in `state/`, so these drain instead of filling.
/// Mirrors `.claude/hooks/lib/meowkit-paths.cjs`, so the hooks and the CLI agree.
pub const LEGACY_SESSION_STATE_RELS: [&str; 2] = ["session-state", ".claude/session-state"];

/// A session marker to READ: the canonical path when it exists, else a pre-move
/// path that does, else the canonical one — so an absent marker is reported at
/// the location a writer would use.
pub fn resolve_session_state_file(project_root: &Path, rel: &str) -> PathBuf {
    let canonical = resolve_state_dir(project_root, StateClass::State).join(rel);
    if canonical.exists() {
        return canonical;
    }
    for legacy in LEGACY_SESSION_STATE_RELS {
        // The constant uses `/` for both segments; `join` on each one keeps it
        // a real path separator on Windows too.
        let candidate = legacy
            .split('/')
            .fold(project_root.to_path_buf(), |acc, part| acc.join(part))
            .join(rel);
        if candidate.exists() {
            return candidate;
        }
    }
    canonical
}

/// Absolute directory for one taxonomy class under the given project root.
///
/// The legacy fallback is scoped to `memory` ONLY. Telemetry, state and cache were
/// never in the legacy tree, and resolving them there would put the trace log and
/// the security log inside the grep-read memory directory — exactly the content the
/// store must not carry.
pub fn resolve_state_dir(project_root: &Path, class: StateClass) -> PathBuf {
    if class == StateClass::Memory && using_legacy_memory_tree(project_root) {
        return legacy_memory_dir(project_root);
    }
    project_root.join(MEOWKIT_DIR).join(class.as_str())
}

#[cfg(test)]
#[path = "state_paths_tests.rs"]
mod tests;
