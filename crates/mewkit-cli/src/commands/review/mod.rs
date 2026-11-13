//! `review` — argument parsing, output and exit codes for the six-stage PR
//! review pipeline. The pipeline itself is [`mewkit_core::review`].
//!
//! ## Why the sub-verb is a plain positional
//!
//! The npm CLI classifies a wrong sub-verb from its command catalogue BEFORE
//! dispatching, and hooks and skills read that exact text. A clap subcommand
//! enum would answer with clap's own wording instead, so the sub-verb arrives
//! as a string and [`run`] reproduces the catalogue's refusal verbatim.
//!
//! Like every ported verb, a failure prints the npm CLI's own line and exits
//! non-zero rather than returning a [`Failure`], which would prefix
//! `mewkit-next:` and break the parity those callers depend on.
mod emit;
mod stages;

use clap::Args;

use crate::failure::{FAILED, Failure, OK, USAGE};

#[derive(Args, Debug)]
pub struct ReviewArgs {
    /// `prepare`, `read`, `coverage`, `compose`, `submit` or `cleanup`.
    pub subcommand: Option<String>,
    /// `prepare`: the PR URL, `owner/repo#n` or number. `read`: the path.
    pub target: Option<String>,
    /// `prepare`: fetch the pull request from this remote.
    #[arg(long)]
    pub remote: Option<String>,
    /// The session id `review prepare` printed.
    #[arg(long)]
    pub session: Option<String>,
    /// `read`: the reviewer role the receipt is attributed to.
    #[arg(long = "as")]
    pub reviewer: Option<String>,
    /// `submit`: the only GitHub write authority.
    #[arg(long)]
    pub reply: bool,
    /// `submit`: the token bound to the composed payload.
    #[arg(long)]
    pub confirm: Option<String>,
    /// Print JSON instead of a summary line.
    #[arg(long)]
    pub json: bool,
}

const SUBCOMMANDS: [&str; 6] = [
    "prepare", "read", "coverage", "compose", "submit", "cleanup",
];

pub fn run(args: &ReviewArgs) -> Result<u8, Failure> {
    let Some(subcommand) = args.subcommand.as_deref() else {
        return Ok(invocation_error("`mewkit review` needs a subcommand."));
    };
    if !SUBCOMMANDS.contains(&subcommand) {
        return Ok(invocation_error(&format!(
            "Unknown `review` subcommand: {subcommand}"
        )));
    }

    let cwd = std::env::current_dir()?;
    match subcommand {
        "prepare" => stages::prepare(args, &cwd),
        "read" => stages::read(args, &cwd),
        "coverage" => stages::coverage(args, &cwd),
        "compose" => stages::compose(args, &cwd),
        "submit" => stages::submit(args, &cwd),
        "cleanup" => stages::cleanup(args, &cwd),
        _ => unreachable!("the sub-verb was checked against the catalogue"),
    }
}

/// The catalogue's refusal, word for word, on stderr with exit 2.
fn invocation_error(headline: &str) -> u8 {
    eprintln!("{headline}");
    eprintln!("Valid subcommands: {}", SUBCOMMANDS.join(", "));
    eprintln!("Run `mewkit review --help` for usage.");
    USAGE
}

/// The exit code a stage result carries: 1 on failure, 0 otherwise. The npm
/// CLI sets `process.exitCode` rather than throwing, so a failed stage still
/// prints its own report first.
fn code_for(ok: bool) -> u8 {
    if ok { OK } else { FAILED }
}
