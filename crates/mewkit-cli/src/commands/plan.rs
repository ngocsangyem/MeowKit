//! `plan` — argument parsing only. The plan document's parser, structure
//! rules and archive live in [`mewkit_core::plan_doc`].
//!
//! The npm CLI prints its own failures on STDOUT and exits non-zero, so this
//! command returns the exit code it was given rather than a [`Failure`]: a
//! `Failure` would print `mewkit: …` on stderr and lose the parity the
//! hooks and skills that read this output depend on.
use clap::{Args, Subcommand};
use mewkit_core::plan_doc::{Output, plan_archive, plan_check, plan_status, plan_sync};

use crate::failure::Failure;

#[derive(Args, Debug)]
pub struct PlanArgs {
    #[command(subcommand)]
    pub command: PlanCommand,
}

#[derive(Subcommand, Debug)]
pub enum PlanCommand {
    /// Progress across plan.md + its phase files (read-only).
    Status {
        /// The plan directory.
        target: Option<String>,
        /// Print the summary as JSON instead of the progress block.
        #[arg(long)]
        json: bool,
    },
    /// Required-section report for one phase file (read-only).
    Check {
        /// The phase file, or the plan.md / plan directory with --structural.
        target: Option<String>,
        /// Print the report as JSON.
        #[arg(long)]
        json: bool,
        /// Validate plan.md + every sibling phase file against the full template.
        #[arg(long)]
        structural: bool,
    },
    /// Rewrite derived statuses from the checkboxes; never a checkbox (mutating).
    Sync {
        /// The plan directory, or a plan.md inside it.
        target: Option<String>,
        /// Write nothing; print the drift and exit 1 when there is any.
        #[arg(long)]
        check: bool,
        /// Print the changes as JSON.
        #[arg(long)]
        json: bool,
    },
    /// Mark statuses completed + move to tasks/plans/archive/ (mutating).
    Archive {
        /// The plan directory, or a plan.md inside it.
        target: Option<String>,
        /// Print what would happen without writing or moving anything.
        #[arg(long = "dry-run")]
        dry_run: bool,
    },
}

pub fn run(args: &PlanArgs) -> Result<u8, Failure> {
    let root = std::env::current_dir()?;
    let out: Output = match &args.command {
        PlanCommand::Status { target, json } => plan_status(&root, target.as_deref(), *json),
        PlanCommand::Check {
            target,
            json,
            structural,
        } => plan_check(&root, target.as_deref(), *json, *structural),
        PlanCommand::Sync {
            target,
            check,
            json,
        } => plan_sync(&root, target.as_deref(), *check, *json),
        PlanCommand::Archive { target, dry_run } => {
            plan_archive(&root, target.as_deref(), *dry_run)
        }
    };
    if !out.stderr.is_empty() {
        eprint!("{}", out.stderr);
    }
    if !out.stdout.is_empty() {
        println!("{}", out.stdout);
    }
    Ok(out.code)
}
