//! `mewkit-next`: the Rust mewkit CLI, installed beside the npm `mewkit` CLI
//! until cutover. It parses arguments and maps outcomes to exit codes; the
//! behaviour itself belongs in `mewkit-core` and `mewkit-adapters`.
#![forbid(unsafe_code)]

use std::process::ExitCode;

use clap::{Parser, Subcommand};

/// Exit code for a usage error, matching clap's own usage-error code.
const EXIT_USAGE: u8 = 2;

#[derive(Parser)]
#[command(
    name = "mewkit-next",
    version = mewkit_core::VERSION,
    about = "Install and manage the MeowKit kit for Claude Code, Codex and Cursor (preview).",
    after_help = "Commands not listed here still live in the npm `mewkit` CLI.",
    arg_required_else_help = true
)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Any command this binary does not implement yet.
    #[command(external_subcommand)]
    NotPorted(Vec<String>),
}

fn main() -> ExitCode {
    match Cli::parse().command {
        Command::NotPorted(argv) => {
            let name = argv.first().map(String::as_str).unwrap_or_default();
            eprintln!(
                "mewkit-next: unknown command '{name}'. It is not ported yet; \
                 run it with the npm `mewkit` CLI (`npx mewkit {name}`)."
            );
            ExitCode::from(EXIT_USAGE)
        }
    }
}
