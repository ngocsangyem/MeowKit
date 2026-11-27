//! `host` (beta) — machine load, who causes it, and admission for heavy
//! commands. Argument parsing and rendering only; the behaviour lives in
//! [`mewkit_core::host`].
mod block;
mod caches;
mod clean;
mod internal;
mod jobs;
mod run;
mod status;
mod watch;

use clap::{Args, Subcommand};

use crate::failure::Failure;

#[derive(Args, Debug)]
pub struct HostArgs {
    #[command(subcommand)]
    pub command: HostCommand,
}

#[derive(Subcommand, Debug)]
pub enum HostCommand {
    /// (beta) Sample CPU, memory, disk, thermal and free space; print a verdict.
    Status(status::StatusArgs),
    /// (beta) Run a heavy command through the machine-wide queue; returns
    /// within a bounded wait (exit 75 = not finished, NOT VERIFIED).
    Run(run::RunArgs),
    /// (beta) List, wait for, read or cancel queued and running jobs.
    Jobs(jobs::JobsArgs),
    /// (beta) Remove mewkit's own stale host state (jobs, tickets, inbox, logs).
    Clean(clean::CleanArgs),
    /// (beta) Run the machine-wide watcher: samples every 5 s and writes each
    /// loaded worktree's inbox; exits after 30 min with no agent running.
    Watch(watch::WatchArgs),
    #[command(name = "__spawn", hide = true)]
    Spawn(internal::SpawnArgs),
    #[command(name = "__supervise", hide = true)]
    Supervise(internal::SuperviseArgs),
}

pub fn run(args: &HostArgs) -> Result<u8, Failure> {
    match &args.command {
        HostCommand::Status(a) => status::run(a),
        HostCommand::Run(a) => run::run(a),
        HostCommand::Jobs(a) => jobs::run(a),
        HostCommand::Watch(a) => watch::run(a),
        HostCommand::Clean(a) => clean::run(a),
        HostCommand::Spawn(a) => internal::spawn(a),
        HostCommand::Supervise(a) => internal::supervise(a),
    }
}
