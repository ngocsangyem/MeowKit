//! `validate` — argument parsing, the run headers, and the exit code.
//!
//! Every check lives in [`mewkit_core::validate`]; this file decides WHICH of
//! them one invocation runs and prints what the npm CLI prints, byte for byte.
//! No colour is emitted: `picocolors` disables itself off a TTY, so plain text
//! is already what CI and the pre-ship hook read.
mod scoped;
mod target;

use std::path::{Path, PathBuf};

use clap::Args;
use mewkit_core::validate::{
    CheckResult, ValidateMode, build_default_checks, check_memory_store, detect_validate_mode,
    exit_code, find_meowkit_dir, render_results, resolve_project_root,
};

use crate::failure::{FAILED, Failure};

use scoped::scoped_run;
use target::validate_target;

#[derive(Args, Debug)]
pub struct ValidateArgs {
    /// Maintainer override for the detected consumer profile.
    // The value is checked by hand rather than by a clap `value_parser`: the
    // npm CLI rejects a bad mode with its own message and exit 1, and clap's
    // usage error would exit 2 — a different answer to the same mistake.
    #[arg(long, value_name = "MODE")]
    pub mode: Option<String>,
    /// Validate a generated provider target instead of a `.claude/` project.
    #[arg(long, value_name = "PROVIDER")]
    pub target: Option<String>,
    /// The generated target directory to validate (with `--target`).
    #[arg(value_name = "DIR")]
    pub target_dir: Option<PathBuf>,
    /// Include the portable provider-contract checks.
    #[arg(long)]
    pub portable: bool,
    /// Treat WARN as failure (exit 1).
    #[arg(long)]
    pub strict: bool,
    /// Run only the workflow.yaml drift check.
    #[arg(long)]
    pub workflow: bool,
    /// Run only the gate-authority contract check.
    #[arg(long)]
    pub gates: bool,
    /// Run only the artifact ownership-completeness check.
    #[arg(long)]
    pub ownership: bool,
    /// Run only the declared agent-contract conformance checks.
    #[arg(long)]
    pub agents: bool,
    /// Run only the responsibility-substrate drift and untagged check.
    #[arg(long)]
    pub substrate: bool,
    /// Run only the pack-manifest coherence and safety check.
    #[arg(long)]
    pub packs: bool,
    /// Run only the routing-table-breadth check.
    #[arg(long)]
    pub rules: bool,
    /// Run only the capability-manifest checks.
    #[arg(long)]
    pub capabilities: bool,
    /// Run only the committed team-memory store lint.
    #[arg(long)]
    pub memory: bool,
    /// Run only the SKILL.md frontmatter schema and runtime-contract check.
    #[arg(long)]
    pub frontmatter: bool,
    /// Run only the `.claude` to `docs/*` reference allowlist check.
    #[arg(long = "docs-refs")]
    pub docs_refs: bool,
}

pub fn run(args: &ValidateArgs) -> Result<u8, Failure> {
    let cwd = std::env::current_dir()?;
    // The mode value is judged before anything runs, the way the npm CLI's
    // dispatcher judges it: an invalid mode is a user error about the argument,
    // not a finding about the project, and it must not print a report first.
    let mode_override = match &args.mode {
        Some(given) => match ValidateMode::parse(given) {
            Some(mode) => Some(mode),
            None => {
                eprintln!("Invalid --mode \"{given}\". Expected \"authoring\" or \"flat-copy\".");
                return Ok(FAILED);
            }
        },
        None => None,
    };
    if let Some(target) = &args.target {
        return validate_target(args, target, &cwd);
    }
    // `--memory` lints CONSUMER content under `.meowkit/memory/`, which exists
    // on every runtime — the Codex and Cursor bundles instruct the user to run
    // this lint too. So it runs FIRST and independently of any provider
    // directory: gating it behind the `.claude/` lookup made the only automated
    // guard unreachable on exactly those targets.
    if args.memory {
        let root = resolve_project_root(&cwd).unwrap_or_else(|| cwd.clone());
        println!("Linting the committed team-memory store...");
        println!("Project root: {}", root.display());
        println!();
        return report(check_memory_store(&root), args.strict);
    }

    println!("Validating .claude/ project structure...");
    println!(
        "Scope: structure & wiring only. Run `mewkit doctor --hard-gates` to verify the gates actually block."
    );
    println!();

    let Some(meowkit_dir) = find_meowkit_dir(&cwd) else {
        eprintln!("Could not find .claude/ directory in the current directory.");
        return Ok(FAILED);
    };
    println!("Found: {}", meowkit_dir.display());
    println!();
    let project_root = meowkit_dir.parent().unwrap_or(&cwd).to_path_buf();

    match scoped_run(args, &meowkit_dir, &project_root) {
        Some(results) => report(results, args.strict),
        None => default_run(args, mode_override, &meowkit_dir, &project_root),
    }
}

fn default_run(
    args: &ValidateArgs,
    mode_override: Option<ValidateMode>,
    meowkit_dir: &Path,
    project_root: &Path,
) -> Result<u8, Failure> {
    let mode = mode_override.unwrap_or_else(|| detect_validate_mode(project_root));
    println!(
        "Mode: {}{} — {}",
        mode.as_str(),
        if mode_override.is_some() {
            " (override)"
        } else {
            " (auto-detected)"
        },
        mode.description()
    );
    println!();
    report(
        build_default_checks(meowkit_dir, project_root, mode, args.portable),
        args.strict,
    )
}

/// Print the report and hand back the code it earned: 0, or 1 for a FAIL (or a
/// WARN under `--strict`). Nothing else exits non-zero from a completed run.
fn report(results: Vec<CheckResult>, strict: bool) -> Result<u8, Failure> {
    print!("{}", render_results(&results));
    Ok(exit_code(&results, strict))
}
