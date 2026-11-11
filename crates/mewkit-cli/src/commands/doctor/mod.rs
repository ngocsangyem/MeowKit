//! `mewkit-next doctor`: read-only checks of the toolchain, the installs at
//! this scope and the other one, and whether their hooks can run. It never
//! changes anything and never marks a project or hook as trusted.
mod codex_trust;
mod hook_commands;
mod hooks;
mod installs;
mod toolchain;

use clap::Args;
use mewkit_adapters::contract::Runtime;
use serde_json::{Value, json};

use super::parse_targets;
use crate::failure::{FAILED, Failure, OK};
use crate::place::Place;

#[derive(Args, Debug)]
pub struct DoctorArgs {
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
    let targets: Vec<Runtime> = if args.target.is_empty() {
        Runtime::ALL.to_vec()
    } else {
        parse_targets(&args.target)?
    };
    let place = Place::new(args.global)?;
    let mut checks = toolchain::checks();
    checks.extend(installs::checks(&place, place.other().as_ref(), &targets));
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
    Ok(if checks.iter().any(|c| c.status == Status::Fail) {
        FAILED
    } else {
        OK
    })
}
