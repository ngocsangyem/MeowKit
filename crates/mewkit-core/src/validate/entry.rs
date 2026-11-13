//! The two entry points that are not themselves checks: where the project's
//! provider directory is, and how the memory lint's rows join this module's
//! row type.
use std::path::{Path, PathBuf};

use super::result::{CheckResult, Section, Status};

/// The committed team-memory store as `validate` rows.
///
/// The lint itself was ported with the memory module; this only re-labels its
/// rows into this module's row type, so `validate --memory` and the default run
/// share one implementation — the same property the TypeScript has, and the one
/// the pre-ship hook depends on.
pub fn check_memory_store(project_root: &Path) -> Vec<CheckResult> {
    crate::memory::check_memory_store(project_root)
        .into_iter()
        .map(|row| {
            CheckResult::new(
                row.name,
                match row.status {
                    crate::memory::CheckStatus::Pass => Status::Pass,
                    crate::memory::CheckStatus::Fail => Status::Fail,
                },
                row.detail,
                Section::Memory,
            )
        })
        .collect()
}

/// Find a provider install directory in `start_dir` ONLY — no walk up. A
/// `validate` run reports on the project it was invoked in; walking up would
/// report on a parent and read as a pass for the directory the user named.
pub fn find_meowkit_dir(start_dir: &Path) -> Option<PathBuf> {
    let candidate = start_dir.join(".claude");
    candidate.is_dir().then_some(candidate)
}
