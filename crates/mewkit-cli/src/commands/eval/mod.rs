//! `eval` — measure the kit: `run` a case suite against a runtime and model,
//! and `compare` two reports of the same suite.
//!
//! Runs are opt-in and never start from a hook or an install. Each run works
//! in a disposable fixture copy with its own runtime home; reports go under
//! `.meowkit/telemetry/eval/`. The logic is [`mewkit_core::eval`]; this module
//! parses arguments, drives processes and prints.
mod arm;
mod case_source;
mod output;
mod run;

use std::path::PathBuf;

use clap::{Args, Subcommand};
use mewkit_core::eval::{Report, compare};

use crate::failure::{FAILED, Failure, OK};

#[derive(Args, Debug)]
pub struct EvalArgs {
    #[command(subcommand)]
    pub command: EvalCommand,
}

#[derive(Subcommand, Debug)]
pub enum EvalCommand {
    /// Run a case suite in disposable sandboxes and write a report.
    Run(RunArgs),
    /// Compare two reports of the same suite; refuses reports that differ in what they measured.
    Compare(CompareArgs),
}

#[derive(Args, Debug)]
pub struct RunArgs {
    /// Suite to run: the cases whose `suite` field names it.
    #[arg(long, default_value = "baseline")]
    pub suite: String,
    /// Runtime to drive: `claude-code` or `codex`.
    #[arg(long, default_value = "claude-code")]
    pub runtime: String,
    /// Pinned model version, recorded in the report (required unless --dry-run).
    #[arg(long)]
    pub model: Option<String>,
    /// Stop before total spend across concurrent eval runs here passes this many USD (required unless --dry-run).
    #[arg(long)]
    pub max_cost_usd: Option<f64>,
    /// Stop after this many runs (required unless --dry-run).
    #[arg(long)]
    pub max_runs: Option<u32>,
    /// Folder holding `<skill>/eval/*.yaml` cases; defaults to the installed eval pack (`.meowkit/eval`), else this project's `.claude/skills`.
    #[arg(long)]
    pub case_root: Option<PathBuf>,
    /// Accept a --case-root outside this project's `.claude/skills` (its cases run model turns).
    #[arg(long)]
    pub trust_cases: bool,
    /// Only these case ids (repeatable).
    #[arg(long = "case")]
    pub cases: Vec<String>,
    /// Kit archive installed into every sandbox (required unless --dry-run); a release `meowkit-release.zip`, or one built from a checkout.
    #[arg(long)]
    pub kit_archive: Option<PathBuf>,
    /// The expected SHA-256 of --kit-archive, in hex.
    #[arg(long)]
    pub kit_sha256: Option<String>,
    /// Seconds before one run is stopped and counted as an error.
    #[arg(long, default_value_t = 600)]
    pub timeout_secs: u64,
    /// Turn limit passed to the runtime for each run.
    #[arg(long, default_value_t = 12)]
    pub max_turns: u32,
    /// Exit 1 when the trigger, paired-on or mismatch-report rate is below this fraction.
    #[arg(long)]
    pub fail_under: Option<f64>,
    /// List the cases and runs that would happen, and run nothing.
    #[arg(long)]
    pub dry_run: bool,
}

#[derive(Args, Debug)]
pub struct CompareArgs {
    /// The earlier report (JSON).
    pub base: PathBuf,
    /// The later report (JSON).
    pub new: PathBuf,
    /// Print JSON instead of text.
    #[arg(long)]
    pub json: bool,
}

pub fn run(args: &EvalArgs) -> Result<u8, Failure> {
    match &args.command {
        EvalCommand::Run(a) => run::run(a),
        EvalCommand::Compare(a) => compare_reports(a),
    }
}

fn read_report(path: &PathBuf) -> Result<Report, Failure> {
    let text = std::fs::read_to_string(path)
        .map_err(|e| Failure::failed(format!("cannot read {}: {e}", path.display())))?;
    serde_json::from_str(&text)
        .map_err(|e| Failure::failed(format!("{} is not an eval report: {e}", path.display())))
}

fn compare_reports(args: &CompareArgs) -> Result<u8, Failure> {
    let (base, new) = (read_report(&args.base)?, read_report(&args.new)?);
    let c = match compare(&base, &new) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("Not comparable: {e}");
            return Ok(FAILED);
        }
    };
    if args.json {
        println!(
            "{}",
            serde_json::to_string_pretty(&c).expect("comparison serialises")
        );
        return Ok(OK);
    }
    println!("Margin: {:.1} points", c.margin_pp);
    for d in c.suite.iter().chain(&c.cases) {
        let flag = if d.beyond_margin {
            "  beyond margin"
        } else {
            ""
        };
        println!(
            "{:<32} {:>6.1}% -> {:>6.1}%  ({:+.1}){flag}",
            d.metric,
            d.base * 100.0,
            d.new * 100.0,
            d.delta_pp
        );
    }
    Ok(OK)
}
