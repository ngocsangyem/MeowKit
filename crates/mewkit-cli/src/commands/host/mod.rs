//! `host` (beta) — machine load, who causes it, and admission for heavy
//! commands. Argument parsing and rendering only; the behaviour lives in
//! [`mewkit_core::host`].
mod status;

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
}

pub fn run(args: &HostArgs) -> Result<u8, Failure> {
    match &args.command {
        HostCommand::Status(a) => status::run(a),
    }
}
