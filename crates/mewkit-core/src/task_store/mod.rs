//! Reading the durable task state: the per-task records and the pointer that
//! names the current one.
//!
//! Port of `core/task-record.ts`. The record SHAPE lives in
//! [`crate::schema::task_record`]; this module owns where the files are, how a
//! bad one is surfaced, how the pointer is resolved, and how both are written.
//!
//! The honesty guarantee the readers carry: a corrupt or incompatible record is
//! reported as an ISSUE rather than crashing the reconstruction, so one bad file
//! never hides the rest — and never silently disappears either. The writers
//! carry the matching one: a record this binary cannot read is never clobbered,
//! and a reader never observes a half-written one.
mod activation;
mod clock;
mod pointer;
mod pointer_write;
mod records;
mod writes;

pub use activation::{
    ActivateTask, Activation, ActivationError, ActivationFailure, activate_task, blank_record,
};
pub use clock::{iso_millis, now_iso_millis};
pub use pointer::{
    ActiveTaskPointerRead, PointerError, read_active_plan_pointer, read_active_task_pointer,
};
pub use pointer_write::{clear_active_task_pointer, write_active_task_pointer};
pub use records::{
    ResumeState, TaskIssue, active_dir, list_task_record_ids, read_task_record,
    reconstruct_resume_state,
};
pub use writes::{RecordWriteError, remove_task_record, update_task_record, write_task_record};

#[cfg(test)]
#[path = "records_tests.rs"]
mod records_tests;

#[cfg(test)]
#[path = "pointer_tests.rs"]
mod pointer_tests;

#[cfg(test)]
#[path = "writes_tests.rs"]
mod writes_tests;
