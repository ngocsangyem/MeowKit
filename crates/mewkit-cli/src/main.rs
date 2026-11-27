//! `mewkit` (also `mk`): the native mewkit CLI. It parses arguments and maps
//! outcomes to exit codes; the behaviour itself belongs in `mewkit-core` and
//! `mewkit-adapters`.
#![forbid(unsafe_code)]

mod adopt;
mod argv_compat;
mod commands;
mod failure;
mod kit_args;
mod minimist_flags;
mod output;
mod place;
mod prompt;
mod rebuild;
mod skill_selection;

use std::process::ExitCode;

use clap::{CommandFactory, Parser, Subcommand};

use commands::{
    advice::AdviceArgs, budget::BudgetArgs, doctor::DoctorArgs, init::InitArgs, note::NoteArgs,
    orient::OrientArgs, plan::PlanArgs, providers::ProvidersArgs, review::ReviewArgs,
    self_update::SelfUpdateArgs, task::TaskArgs, task_state::TaskStateArgs, trace::TraceArgs,
    uninstall::UninstallArgs, upgrade::UpgradeArgs, validate::ValidateArgs, versions::VersionsArgs,
};
use commands::{
    backups::BackupsArgs, capabilities::CapabilitiesArgs, eval::EvalArgs, host::HostArgs,
    pack::PackArgs, setup::SetupArgs, skill::SkillArgs,
};

#[derive(Parser)]
#[command(
    name = "mewkit",
    version = mewkit_core::VERSION,
    about = "Install and manage the MeowKit kit for Claude Code, Codex, Cursor, Grok, Pi, OMP and Antigravity.",
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
    /// Resume orientation from durable task state; reads records only.
    Orient(OrientArgs),
    /// Inspect, sync or archive a plan under tasks/plans/.
    Plan(PlanArgs),
    /// Append a lint-checked entry to the team-memory store (entry on stdin).
    Note(NoteArgs),
    /// Create and list task files.
    Task(TaskArgs),
    /// Show or update the durable task record.
    #[command(name = "task-state")]
    TaskState(TaskStateArgs),
    /// Check this project's structure and wiring (not that the guards block).
    Validate(ValidateArgs),
    /// Prepare, read, compose and submit a structured code review.
    Review(ReviewArgs),
    /// Athena supervision checkpoints: evidence in, advice out (never approval).
    //
    // Boxed: the npm CLI parses one global flag table, so this verb declares
    // every flag its four subcommands accept and its argument struct is twice
    // the size of the next largest. Inline, it would set the size of EVERY
    // variant of this enum. (Plain comment: a doc line would reach `--help`.)
    Advice(Box<AdviceArgs>),
    /// On-demand trace recall: score, audit, propose, record friction.
    Trace(TraceArgs),
    /// Measure the kit: run eval cases in sandboxes, compare two reports.
    Eval(EvalArgs),
    /// Token and USD spend from the cost log.
    Budget(BudgetArgs),
    /// Guided post-scaffold configuration.
    Setup(SetupArgs),
    /// Per-skill environments and the skill store (status of installed skills).
    Skill(SkillArgs),
    /// Manage install packs.
    Pack(PackArgs),
    /// Explain, resolve and project the kit's capabilities.
    Capabilities(CapabilitiesArgs),
    /// List or restore the backups lifecycle commands left behind.
    Backups(BackupsArgs),
    /// (beta) Machine load, who causes it, and admission for heavy commands.
    Host(HostArgs),
}

fn main() -> ExitCode {
    let result = match parse_cli().command {
        Command::Init(args) => commands::init::run(&args),
        Command::Upgrade(args) => commands::upgrade::run(&args),
        Command::Uninstall(args) => commands::uninstall::run(&args),
        Command::Doctor(args) => commands::doctor::run(&args),
        Command::Providers(args) => commands::providers::run(&args),
        Command::Versions(args) => commands::versions::run(&args),
        Command::SelfUpdate(args) => commands::self_update::run(&args),
        Command::Orient(args) => commands::orient::run(&args),
        Command::Plan(args) => commands::plan::run(&args),
        Command::Note(args) => commands::note::run(&args),
        Command::Task(args) => commands::task::run(&args),
        Command::TaskState(args) => commands::task_state::run(&args),
        Command::Validate(args) => commands::validate::run(&args),
        Command::Review(args) => commands::review::run(&args),
        Command::Advice(args) => commands::advice::run(&args),
        Command::Trace(args) => commands::trace::run(&args),
        Command::Eval(args) => commands::eval::run(&args),
        Command::Budget(args) => commands::budget::run(&args),
        Command::Setup(args) => commands::setup::run(&args),
        Command::Skill(args) => commands::skill::run(&args),
        Command::Pack(args) => commands::pack::run(&args),
        Command::Capabilities(args) => commands::capabilities::run(&args),
        Command::Backups(args) => commands::backups::run(&args),
        Command::Host(args) => commands::host::run(&args),
    };
    match result {
        Ok(code) => ExitCode::from(code),
        Err(failure) => {
            eprintln!("mewkit: {failure}");
            ExitCode::from(failure.code)
        }
    }
}

/// Parse argv; verbs ported from the npm CLI first get its minimist tolerance.
fn parse_cli() -> Cli {
    let argv: Vec<std::ffi::OsString> = std::env::args_os().collect();
    let ported = argv
        .get(1)
        .and_then(|verb| verb.to_str())
        .is_some_and(|verb| argv_compat::PORTED_VERBS.contains(&verb));
    if !ported {
        return Cli::parse_from(argv);
    }
    let argv = argv
        .iter()
        .map(|a| a.to_string_lossy().into_owned())
        .collect();
    // BUILT before the rewrite: clap propagates a `global = true` flag to its
    // subcommands during the build, and the rewrite asks each leaf which flags
    // it knows. Against an unbuilt command a global flag written AFTER its
    // subcommand (`task-state show --json`) looks unknown and is dropped like a
    // typo — which is how the npm CLI treats a typo, but not how it treats that
    // flag.
    let mut root = Cli::command();
    root.build();
    Cli::parse_from(argv_compat::normalise(argv, &root))
}
