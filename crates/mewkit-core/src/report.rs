//! What one execution did, or in dry-run would do.
use std::path::PathBuf;

#[derive(Clone, Debug, Default, PartialEq)]
pub struct EmitReport {
    pub dry_run: bool,
    /// Files written or merged into.
    pub written: Vec<String>,
    /// Files removed, or whose merged section was stripped.
    pub removed: Vec<String>,
    /// Paths left alone, with why (user edits, unowned files, uncorroborated claims).
    pub preserved: Vec<(String, String)>,
    /// `file: entry` names a merge overwrote with a different value.
    pub replaced: Vec<String>,
    pub notices: Vec<String>,
    pub dropped_hooks: Vec<String>,
    pub narrowed_hooks: Vec<String>,
    pub unsupported: Vec<String>,
    /// Where pre-change copies were saved; `None` when nothing existed to back up.
    pub backup: Option<PathBuf>,
}
