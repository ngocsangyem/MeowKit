//! `mewkit-next`: the Rust mewkit CLI, installed beside the npm `mewkit` CLI
//! until cutover. It parses arguments and maps outcomes to exit codes; the
//! behaviour itself belongs in `mewkit-core` and `mewkit-adapters`.
#![forbid(unsafe_code)]

mod adopt;
mod commands;
mod failure;
mod kit_args;
mod output;
mod place;

use std::process::ExitCode;

use clap::{Parser, Subcommand};

use commands::{
    doctor::DoctorArgs, init::InitArgs, providers::ProvidersArgs, self_update::SelfUpdateArgs,
    uninstall::UninstallArgs, upgrade::UpgradeArgs, versions::VersionsArgs,
};
use failure::Failure;

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
    /// Install the kit into this project, or your home with --global.
    Init(InitArgs),
    /// Move the installed runtimes to a newer kit, keeping your edits.
    Upgrade(UpgradeArgs),
    /// Remove the kit again (shows what would go unless --yes).
    Uninstall(UninstallArgs),
    /// Check the toolchain, the installs here and their hooks.
    Doctor(DoctorArgs),
    /// What each runtime gets from the kit: files, skills, hooks, gaps.
    Providers(ProvidersArgs),
    /// Kits installed, cached and available, and the supported kit contract.
    Versions(VersionsArgs),
    /// Replace this binary with the newest release (SHA-256 verified).
    SelfUpdate(SelfUpdateArgs),
    /// Any command this binary does not implement yet.
    #[command(external_subcommand)]
    NotPorted(Vec<String>),
}

fn main() -> ExitCode {
    let result = match Cli::parse().command {
        Command::Init(args) => commands::init::run(&args),
        Command::Upgrade(args) => commands::upgrade::run(&args),
        Command::Uninstall(args) => commands::uninstall::run(&args),
        Command::Doctor(args) => commands::doctor::run(&args),
        Command::Providers(args) => commands::providers::run(&args),
        Command::Versions(args) => commands::versions::run(&args),
        Command::SelfUpdate(args) => commands::self_update::run(&args),
        Command::NotPorted(argv) => {
            let name = argv.first().map(String::as_str).unwrap_or_default();
            Err(Failure::usage(format!(
                "unknown command '{name}'. It is not ported yet; \
                 run it with the npm `mewkit` CLI (`npx mewkit {name}`)."
            )))
        }
    };
    match result {
        Ok(code) => ExitCode::from(code),
        Err(failure) => {
            eprintln!("mewkit-next: {failure}");
            ExitCode::from(failure.code)
        }
    }
}
