//! `task new|list` — create and list task files.
//!
//! Argument parsing only; the scaffolding, the template lookup and the listing
//! live in [`mewkit_core::task_files`].
use clap::{Args, Subcommand};
use mewkit_core::task_files::{NewTask, list_tasks, new_task};

use crate::failure::{FAILED, Failure, OK};

#[derive(Args, Debug)]
pub struct TaskArgs {
    #[command(subcommand)]
    pub command: TaskCommand,
}

#[derive(Subcommand, Debug)]
pub enum TaskCommand {
    /// Scaffold a task file from the template for its type.
    New {
        /// The description, also the source of the slug and the title. Taken as
        /// every remaining positional joined by a space, so a description that
        /// escaped its quotes still reads as one sentence.
        #[arg(value_name = "DESCRIPTION", num_args = 0..)]
        description: Vec<String>,
        /// Task type: feature, bug-fix, refactor, security.
        #[arg(long = "type", value_name = "TYPE")]
        task_type: Option<String>,
        /// Task priority.
        #[arg(long)]
        priority: Option<String>,
        /// Activate the task on creation; `--no-activate` opts out.
        //
        // Default OFF, which is what the npm CLI does: its dispatcher tests
        // `args.activate === true`, so a run without the flag records no
        // durable state.
        #[arg(long, overrides_with = "no_activate")]
        activate: bool,
        #[arg(long = "no-activate", overrides_with = "activate")]
        no_activate: bool,
    },
    /// List task files with their status, type, priority and path.
    List {
        /// Include completed and backlog tasks (scan all of `tasks/`).
        #[arg(long)]
        all: bool,
        /// Filter the list by status: draft, in-progress, blocked, review, done.
        #[arg(long)]
        status: Option<String>,
    },
}

pub fn run(args: &TaskArgs) -> Result<u8, Failure> {
    let cwd = std::env::current_dir()?;
    let out = match &args.command {
        TaskCommand::New {
            description,
            task_type,
            priority,
            activate,
            no_activate: _,
        } => new_task(
            &cwd,
            &NewTask {
                task_type: task_type.as_deref(),
                priority: priority.as_deref(),
                description: &description.join(" "),
                activate: *activate,
                cli_version: Some(mewkit_core::VERSION),
            },
        ),
        TaskCommand::List { all, status } => list_tasks(&cwd, *all, status.as_deref()),
    };
    // Both streams, in this order: `task new --activate` reports the file it
    // created before a failed activation refuses on stderr. The refusals are
    // printed verbatim rather than returned as a `Failure`, which would prefix
    // them with the program name the npm CLI does not print.
    print!("{}", out.stdout);
    eprint!("{}", out.stderr);
    Ok(if out.failed { FAILED } else { OK })
}
