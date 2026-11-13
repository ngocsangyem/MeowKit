//! `task-state show|update` — the durable task-record surface.
//!
//! Port of `commands/task-state.ts`. `show` reconstructs resume state from
//! files only; `update` writes the record atomically through
//! [`crate::task_store`]. Distinct from [`crate::task_files`], which scaffolds
//! task FILES from templates: this owns durable STATE.
//!
//! Both halves render their own text, because the output IS the contract — the
//! cook, fix and review skills read it — and a renderer in the argument parser
//! could not be tested without a process.
mod decisions;
mod kit_version;
mod render;
mod transition_trace;
mod update;

use std::path::Path;

pub use decisions::{parse_capability_decision, parse_verification};
pub use kit_version::kit_version;
pub use render::{render_show, show_json};
pub use update::{TaskStateUpdate, UpdateOutput, update};

use crate::task_store::{PointerError, read_active_task_pointer, reconstruct_resume_state};

/// `show`: the resume state as text, or as the full JSON document.
pub fn show(project_root: &Path, json: bool) -> Result<String, PointerError> {
    let state = reconstruct_resume_state(project_root)?;
    if json {
        return Ok(format!("{}\n", show_json(&state)));
    }
    let pointer = read_active_task_pointer(project_root)?;
    Ok(render_show(&state, pointer.as_ref()))
}

#[cfg(test)]
#[path = "task_state_tests.rs"]
mod tests;
