//! The post-scaffold setup steps: `skill-envs`, `mcp`, `env`, `gitignore`,
//! `project-context`. Each reports a verdict plus the file changes it made, or
//! under `dry_run` would have made.
mod changes;
mod gitignore;
mod skill_envs;
mod steps;
mod templates;

use std::path::Path;

pub use changes::{Changes, PlannedChange};
pub use gitignore::{strip_stale_memory_ignore, strip_superseded_meowkit_ignores};
pub use templates::KIT_DIR_GITIGNORE;

/// Step names in run order.
pub const STEP_NAMES: [&str; 5] = ["skill-envs", "mcp", "env", "gitignore", "project-context"];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StepStatus {
    Pass,
    Skip,
    Warn,
    Fail,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StepResult {
    pub status: StepStatus,
    pub message: String,
    /// Every file the step wrote, or would have written under `dry_run`.
    pub changes: Vec<PlannedChange>,
}

impl StepResult {
    pub(crate) fn new(status: StepStatus, message: impl Into<String>) -> Self {
        Self {
            status,
            message: message.into(),
            changes: Vec::new(),
        }
    }

    pub(crate) fn with_changes(mut self, changes: Vec<PlannedChange>) -> Self {
        self.changes = changes;
        self
    }
}

/// What a step may read.
pub struct StepOptions<'a> {
    /// Skills the user named; empty means create nothing.
    pub skills: &'a [String],
    pub dry_run: bool,
}

/// Run one step. `say` receives each stdout line the step prints on its own
/// (environment progress); `Err` is an unexpected I/O failure, not a verdict.
pub fn run_step(
    name: &str,
    dir: &Path,
    options: &StepOptions<'_>,
    say: &mut dyn FnMut(&str),
) -> Option<Result<StepResult, String>> {
    let io = |e: std::io::Error| e.to_string();
    Some(match name {
        "skill-envs" => skill_envs::run(dir, options, say),
        "mcp" => steps::mcp(dir, options).map_err(io),
        "env" => steps::env(dir, options).map_err(io),
        "gitignore" => gitignore::run(dir, options).map_err(io),
        "project-context" => Ok(steps::project_context(dir)),
        _ => return None,
    })
}

#[cfg(test)]
#[path = "tests.rs"]
mod tests;
