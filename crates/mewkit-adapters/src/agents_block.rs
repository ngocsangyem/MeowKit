//! The kit's always-on text for every runtime that reads the project's
//! `AGENTS.md`: one authored file, merged as one marked block. Runtimes that
//! share a project write the same block, so each of them reads it once.
use std::path::Path;

use crate::contract::{EmitError, Op};
use crate::kit_files::rel;

pub const AGENTS_MD: &str = "AGENTS.md";
/// Where the kit keeps the text.
pub const SOURCE: &str = "kit/overlays/shared/AGENTS.md";
/// Marked-block id of the kit's guidance in the project's `AGENTS.md`.
pub const BLOCK_ID: &str = "meowkit";
/// Codex's default `project_doc_max_bytes`: guidance past it is never read.
pub const BUDGET: usize = 32 * 1024;

/// The text as the kit ships it.
pub fn read(kit_dir: &Path) -> Result<Vec<u8>, EmitError> {
    std::fs::read(kit_dir.join(SOURCE)).map_err(|e| {
        EmitError::Kit(format!(
            "the kit has no always-on text at {SOURCE} (kit too old for this binary?): {e}"
        ))
    })
}

/// The text as a managed block in `path`. Over budget fails: a truncated
/// block would drop the safety summary without saying so.
pub fn merge(text: &str, path: &str) -> Result<Op, EmitError> {
    if text.len() > BUDGET {
        return Err(EmitError::Kit(format!(
            "the AGENTS.md guidance is {} bytes, over the {BUDGET}-byte budget",
            text.len()
        )));
    }
    Ok(Op::MergeBlock {
        path: rel(path)?,
        id: BLOCK_ID.into(),
        content: text.trim_end().to_owned(),
    })
}
