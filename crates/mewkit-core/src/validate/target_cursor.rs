//! The post-install quality gate for a GENERATED Cursor project. Read-only.
//!
//! The authored Cursor bundle is a minimal skeleton (AGENTS.md plus the state
//! directory's pointer), so the checks are deliberately narrow — richer
//! structural checks land alongside that content, the way the Codex profile
//! grew with its bundle. Port of `validate/targets/cursor-target.ts`.
use std::path::{Path, PathBuf};

use super::result::{CheckResult, Status};
use super::target_helpers::row;

/// The authored marker is the reconciliation ledger — the one artifact that
/// distinguishes an authored install from a bare `.cursor/` (legacy-converter
/// output, or a project with only user-authored rules). A root `AGENTS.md` is
/// not a safe signal: the Codex bundle installs one too.
pub fn ledger_path(dir: &Path) -> PathBuf {
    crate::state_paths::meowkit_state_paths(&dir.join(".meowkit")).cursor_ledger
}

pub fn detects(dir: &Path) -> bool {
    ledger_path(dir).exists()
}

pub fn check(dir: &Path) -> Vec<CheckResult> {
    let present = |name: &str, path: PathBuf, detail: &str| {
        if path.exists() {
            row(name, Status::Pass, detail.to_string())
        } else {
            row(name, Status::Fail, format!("Missing: {}", path.display()))
        }
    };
    vec![
        present(
            "Cursor AGENTS.md present",
            dir.join("AGENTS.md"),
            "instruction surface exists",
        ),
        present(
            "Cursor .meowkit/README.md present",
            dir.join(".meowkit").join("README.md"),
            "state-directory pointer exists",
        ),
        present(
            "Cursor reconciliation ledger present",
            ledger_path(dir),
            "authored-install marker exists",
        ),
    ]
}
