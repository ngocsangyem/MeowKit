//! The emitter contract: emitters compute, the core executes.
//!
//! An emitter turns a kit into a [`Plan`] of owned data and never touches
//! disk; `mewkit_core::exec::execute` is the only thing that applies a plan.
use std::path::PathBuf;

pub use mewkit_core::fsx::RelPath;
pub use mewkit_core::kit::Kit;
pub use mewkit_core::ownership::OwnershipIndex;
pub use mewkit_core::plan::{Format, Op, Plan};

/// A runtime the kit installs into.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum Runtime {
    ClaudeCode,
    Codex,
    Cursor,
}

impl Runtime {
    pub const ALL: [Runtime; 3] = [Runtime::ClaudeCode, Runtime::Codex, Runtime::Cursor];

    /// The `--target` name.
    pub fn name(self) -> &'static str {
        match self {
            Runtime::ClaudeCode => "claude-code",
            Runtime::Codex => "codex",
            Runtime::Cursor => "cursor",
        }
    }

    pub fn from_name(name: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|r| r.name() == name)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ScopeKind {
    /// Installed into one project.
    Project,
    /// Installed into the user's home directory.
    Global,
}

/// Where an install goes: a project root or the home directory.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Scope {
    pub kind: ScopeKind,
    pub root: PathBuf,
}

/// Everything `prepare` reads. The borrows end when `prepare` returns.
pub struct EmitRequest<'a> {
    pub kit: &'a Kit,
    pub scope: &'a Scope,
    /// Optional packs selected on top of the core kit.
    pub packs: &'a [String],
    /// Kit items the user turned off, by key.
    pub disabled: &'a [String],
    /// Ignore what is installed and plan a full reinstall.
    pub fresh: bool,
}

#[derive(Debug, thiserror::Error)]
pub enum EmitError {
    /// The kit is missing or malformed where this emitter needs it.
    #[error("kit: {0}")]
    Kit(String),
    /// This runtime cannot install at this scope.
    #[error("{runtime} does not support {what}")]
    Unsupported { runtime: &'static str, what: String },
}

pub trait Emitter: Sync {
    fn target(&self) -> Runtime;
    /// The only paths this emitter's plans may touch, relative to the scope root.
    /// On the emitter, not the plan, so uninstall and doctor can ask too.
    fn roots(&self, scope: &Scope) -> Vec<RelPath>;
    fn prepare(&self, req: &EmitRequest<'_>) -> Result<Plan, EmitError>;
    /// Removal is planned on the same contract as installation.
    fn plan_strip(&self, scope: &Scope, owned: &OwnershipIndex) -> Result<Plan, EmitError>;
}
