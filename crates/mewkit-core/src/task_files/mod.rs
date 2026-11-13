//! `task new|list` — the human task FILES, scaffolded from a template.
//!
//! Port of `commands/task.ts` and `commands/task-utils.ts`. Distinct from
//! [`crate::task_state`], which owns the durable task RECORD: a file here is a
//! document a human edits, and the only bridge between the two is
//! `task new --activate`, which also commits a durable record.
mod create;
mod discovery;
mod list;
mod naming;
mod output;

pub use create::{NewTask, new_task};
pub use discovery::{
    TaskFrontmatter, collect_md_files, find_project_root, find_tasks_dir, find_tasks_root,
    parse_frontmatter, read_template,
};
pub use list::list_tasks;
pub use naming::{
    TASK_TYPES, TaskType, stamp_iso, stamp_yymmdd, to_kebab, today_iso, today_yymmdd,
};
pub use output::TaskOutput;

#[cfg(test)]
#[path = "task_files_tests.rs"]
mod tests;
