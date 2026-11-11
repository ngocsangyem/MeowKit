//! The data an emitter returns: what to change on disk, as plain owned values.
//!
//! An emitter never touches disk. It returns a [`Plan`]; the one executor in
//! [`crate::exec`] validates it, derives dry-run output and backups from it and
//! applies it through the journal, so those can never disagree with the writes.
use serde_json::{Map, Value};

use crate::fsx::RelPath;
pub use crate::merge::hook_groups::Handler;

/// File format of a user-owned file the kit merges into.
#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Format {
    Markdown,
    Json,
    Toml,
}

#[derive(Clone, Debug, PartialEq)]
pub enum Op {
    /// A whole file the kit owns. `mode` is POSIX permissions (`None` = 0644).
    WriteFile {
        path: RelPath,
        bytes: Vec<u8>,
        mode: Option<u32>,
    },
    /// Remove a file the kit owns; refused unless the ownership index owns it.
    RemoveFile {
        path: RelPath,
    },
    /// Insert or replace marked block `id` in a Markdown file.
    MergeBlock {
        path: RelPath,
        id: String,
        content: String,
    },
    StripBlock {
        path: RelPath,
        id: String,
    },
    /// Insert or replace named entries in the container at `key` (JSON or TOML).
    MergeEntries {
        path: RelPath,
        format: Format,
        key: Vec<String>,
        entries: Map<String, Value>,
    },
    /// Undo a `MergeEntries`; the ownership index supplies what it created.
    StripEntries {
        path: RelPath,
        format: Format,
        key: Vec<String>,
        names: Vec<String>,
    },
    /// Insert or replace kit hook handlers in the `hooks.<event>` array of a
    /// Claude Code `settings.json` or Codex `hooks.json`.
    MergeHooks {
        path: RelPath,
        event: String,
        handlers: Vec<Handler>,
    },
    /// Undo a `MergeHooks`; the ownership index supplies the handlers it added.
    StripHooks {
        path: RelPath,
        event: String,
        ids: Vec<String>,
    },
}

impl Op {
    pub fn path(&self) -> &RelPath {
        match self {
            Op::WriteFile { path, .. }
            | Op::RemoveFile { path }
            | Op::MergeBlock { path, .. }
            | Op::StripBlock { path, .. }
            | Op::MergeEntries { path, .. }
            | Op::StripEntries { path, .. }
            | Op::MergeHooks { path, .. }
            | Op::StripHooks { path, .. } => path,
        }
    }
}

/// Everything one emitter wants done, plus what it could not express.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Plan {
    pub ops: Vec<Op>,
    pub notices: Vec<String>,
    /// Hook groups the runtime has no event for.
    pub dropped_hooks: Vec<String>,
    /// Hook groups installed with a narrower matcher than the canonical one.
    pub narrowed_hooks: Vec<String>,
    /// Kit content the runtime cannot carry at all.
    pub unsupported: Vec<String>,
}
