//! `mewkit doctor`: checks of the toolchain, the installs at this scope
//! and the other one, and whether their hooks can run. Plain `doctor` changes
//! nothing; `--adopt` writes the install baseline and `--hard-gates` runs the
//! kit's hooks in a scratch project. It never marks a project or hook as trusted.
mod adopt;
mod codex_trust;
mod extras;
mod hard_gates;
mod hook_commands;
mod hooks;
mod installs;
mod provenance;
mod toolchain;

use clap::Args;
use mewkit_adapters::contract::Runtime;
use serde_json::{Value, json};

use super::parse_targets;
use crate::failure::{FAILED, Failure, OK};
use crate::place::Place;

#[derive(Args, Debug)]
pub struct DoctorArgs {
    /// `provenance`: what the install baseline can and cannot prove.
    pub subcommand: Option<String>,
    /// Append a shareable report block to the text output.
    #[arg(long)]
    pub report: bool,
    /// Also report what each provider adapter can enforce.
    #[arg(long)]
    pub providers: bool,
    /// Also report the state taxonomy.
    #[arg(long)]
    pub state: bool,
    /// `provenance`: name the files behind each count.
    #[arg(long)]
    pub explain: bool,
    /// Live-probe the hard gates (plan, privacy, injection, ship) in a scratch project.
    #[arg(long)]
    pub hard_gates: bool,
    /// Rebuild the npm CLI's ownership baseline from the local kit cache, or refuse.
    #[arg(long)]
    pub adopt: bool,
    /// Only these runtimes (comma-separated); default: all.
    #[arg(long, value_name = "TARGETS")]
    pub target: Vec<String>,
    /// Check your home directory's installs first instead of this project's.
    #[arg(long)]
    pub global: bool,
    /// Print one JSON document instead of text.
    #[arg(long)]
    pub json: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Status {
    Ok,
    Warn,
    Fail,
}

/// One finding.
#[derive(Debug)]
pub struct Check {
    pub name: String,
    pub status: Status,
    pub detail: String,
}

impl Check {
    pub fn new(name: impl Into<String>, status: Status, detail: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            status,
            detail: detail.into(),
        }
    }

    fn to_json(&self) -> Value {
        let status = match self.status {
            Status::Ok => "ok",
            Status::Warn => "warn",
            Status::Fail => "fail",
        };
        json!({"name": self.name, "status": status, "detail": self.detail})
    }
}

pub fn run(args: &DoctorArgs) -> Result<u8, Failure> {
    if let Some(sub) = args.subcommand.as_deref().filter(|s| *s != "provenance") {
        eprintln!("Unknown `doctor` subcommand: {sub}");
        eprintln!("Valid subcommands: provenance");
        eprintln!("Run `mewkit doctor --help` for usage.");
        return Ok(crate::failure::USAGE);
    }
    // Adoption writes the baseline, so it is its own operation rather than a row.
    if args.adopt {
        return adopt::run(extras::project_root().as_deref(), args.json);
    }
    if args.subcommand.is_some() {
        return provenance::run(extras::project_root().as_deref(), args.explain);
    }
    let targets: Vec<Runtime> = if args.target.is_empty() {
        Runtime::ALL.to_vec()
    } else {
        parse_targets(&args.target)?
    };
    let place = Place::new(args.global)?;
    let mut checks = toolchain::checks();
    checks.extend(installs::checks(&place, place.other().as_ref(), &targets));
    let root = extras::project_root();
    if args.providers {
        checks.extend(extras::provider_checks());
    }
    if args.state {
        checks.extend(extras::state_checks(root.as_deref()));
    }
    if args.hard_gates {
        checks.extend(hard_gates::checks(
            &root
                .clone()
                .unwrap_or_else(|| std::env::current_dir().unwrap_or_default()),
        ));
    }
    if args.json {
        println!(
            "{}",
            serde_json::to_string_pretty(&checks.iter().map(Check::to_json).collect::<Vec<_>>())
                .unwrap_or_default()
        );
    } else {
        for c in &checks {
            let mark = match c.status {
                Status::Ok => "ok  ",
                Status::Warn => "warn",
                Status::Fail => "FAIL",
            };
            println!("{mark} {}: {}", c.name, c.detail);
        }
    }
    if args.report && !args.json {
        println!(
            "\n--- Report ---\n{}",
            extras::report(&checks, root.as_deref())
        );
    }
    Ok(if checks.iter().any(|c| c.status == Status::Fail) {
        FAILED
    } else {
        OK
    })
}
