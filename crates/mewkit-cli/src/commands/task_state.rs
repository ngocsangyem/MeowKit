//! `task-state show|update` — the durable task record.
//!
//! Argument parsing only; the reconstruction, the renderer and the locked
//! update live in [`mewkit_core::task_state`].
use clap::{Args, Subcommand};
use mewkit_core::task_state::{TaskStateUpdate, show, update};
use mewkit_core::task_store::now_iso_millis;

use crate::failure::{FAILED, Failure, OK};

#[derive(Args, Debug)]
pub struct TaskStateArgs {
    /// Omitted means `show`: a bare `task-state` reports state and writes
    /// nothing, the way the npm CLI's dispatcher defaults it.
    #[command(subcommand)]
    pub command: Option<TaskStateCommand>,
    /// Emit machine-readable JSON (`show` only).
    #[arg(long, global = true)]
    pub json: bool,
}

#[derive(Subcommand, Debug)]
pub enum TaskStateCommand {
    /// Print the durable state every active record carries.
    Show {
        /// Accepted and ignored: the pointer, not an argument, decides which
        /// record is the current one.
        //
        // The npm CLI documents the positional and ignores it too; dropping it
        // here would turn a command that works there into a parser error.
        #[arg(value_name = "TASK-ID")]
        task_id: Option<String>,
    },
    /// Record a transition on one task's record.
    Update {
        /// The task whose record to update.
        //
        // Optional to CLAP, required by the command: a missing id is the
        // command's own refusal (exit 1), not a parser error (exit 2).
        #[arg(value_name = "TASK-ID")]
        task_id: Option<String>,
        /// Task status: active, blocked, done.
        #[arg(long)]
        status: Option<String>,
        /// What just finished.
        #[arg(long)]
        step: Option<String>,
        /// The next action.
        #[arg(long)]
        next: Option<String>,
        /// Path to the plan this record joins.
        #[arg(long)]
        plan: Option<String>,
        /// Record a blocker; repeatable.
        #[arg(long, value_name = "TEXT")]
        blocker: Vec<String>,
        /// Record a verification as `ref=result`; repeatable.
        #[arg(long, value_name = "REF=RESULT")]
        verification: Vec<String>,
        /// Record an evidence reference; repeatable.
        #[arg(long = "evidence-ref", value_name = "PATH")]
        evidence_ref: Vec<String>,
        /// Record a capability decision as `capId|decision|reason`; repeatable.
        #[arg(long = "capability-decision", value_name = "DECISION")]
        capability_decision: Vec<String>,
    },
}

pub fn run(args: &TaskStateArgs) -> Result<u8, Failure> {
    let project_root = std::env::current_dir()?;
    let Some(TaskStateCommand::Update {
        task_id,
        status,
        step,
        next,
        plan,
        blocker,
        verification,
        evidence_ref,
        capability_decision,
    }) = &args.command
    else {
        print!("{}", show(&project_root, args.json)?);
        return Ok(OK);
    };

    let outcome = update(
        &project_root,
        &TaskStateUpdate {
            task_id: task_id.as_deref(),
            status: status.as_deref(),
            step: step.as_deref(),
            next: next.as_deref(),
            plan: plan.as_deref(),
            blockers: blocker,
            verifications: verification,
            evidence_refs: evidence_ref,
            capability_decisions: capability_decision,
            cli_version: Some(mewkit_core::VERSION),
            now: &now_iso_millis(),
        },
    );
    match outcome {
        Ok(done) => {
            print!("{}", done.stdout);
            if let Some(warning) = done.warning {
                eprint!("{warning}");
            }
            Ok(OK)
        }
        // Printed verbatim, not wrapped in a `Failure`: these refusals are the
        // npm CLI's own wording, and callers match on them.
        Err(text) => {
            eprint!("{text}");
            Ok(FAILED)
        }
    }
}
