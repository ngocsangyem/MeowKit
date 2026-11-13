//! `plan` — argument parsing only. The plan document's parser, structure
//! rules, approval receipt and archive live in [`mewkit_core::plan_doc`].
//!
//! The npm CLI prints its own failures on STDOUT and exits non-zero, so this
//! command returns the exit code it was given rather than a [`Failure`]: a
//! `Failure` would print `mewkit-next: …` on stderr and lose the parity the
//! hooks and skills that read this output depend on.
use std::path::Path;

use clap::{Args, Subcommand};
use mewkit_core::plan_doc::{
    ApproveOptions, Output, plan_approve, plan_archive, plan_check, plan_status,
};

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
        #[arg(long)]
        json: bool,
        /// Validate plan.md + every sibling phase file against the full template.
        #[arg(long)]
        structural: bool,
    },
    /// Stamp the Gate 1 approval receipt (mutating).
    Approve {
        /// The plan directory, or a plan.md inside it.
        target: Option<String>,
        /// Approver name recorded on the approval receipt.
        #[arg(long)]
        by: Option<String>,
        /// Also activate the task durably; the npm CLI's default is OFF.
        #[arg(long, overrides_with = "no_activate")]
        activate: bool,
        /// The explicit opt-out, accepted so a caller can state the default.
        #[arg(long = "no-activate", overrides_with = "activate")]
        no_activate: bool,
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

/// Best-effort approver identity: `git config user.email`, else `human`. Never
/// fabricates one.
fn git_user_or_human(project_root: &Path) -> String {
    std::process::Command::new("git")
        .args(["config", "user.email"])
        .current_dir(project_root)
        .output()
        .ok()
        .filter(|out| out.status.success())
        .map(|out| String::from_utf8_lossy(&out.stdout).trim().to_string())
        .filter(|email| !email.is_empty())
        .unwrap_or_else(|| "human".to_string())
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
        PlanCommand::Approve {
            target,
            by,
            activate,
            ..
        } => {
            let named = by.as_deref().map(str::trim).filter(|b| !b.is_empty());
            // Probe git only when no approver was named: the npm CLI reaches
            // the fallback through a ternary, so it spawns nothing either.
            let fallback = match named {
                Some(_) => String::new(),
                None => git_user_or_human(&root),
            };
            plan_approve(
                &root,
                &ApproveOptions {
                    target: target.as_deref(),
                    by: named,
                    activate: *activate,
                    cli_version: mewkit_core::VERSION,
                    fallback_approver: fallback,
                },
            )
        }
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
