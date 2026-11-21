//! `mewkit doctor`: checks of the toolchain, the installs at this scope
//! and the other one, and whether their hooks can run. Plain `doctor` changes
//! nothing; `--adopt` writes the install baseline and `--hard-gates` runs the
//! kit's hooks in a scratch project. It never marks a project or hook as trusted.
//!
//! It also reports where the kit shares a host with something else — agent
//! names, hook registrations, instruction files, the skill listing and a host
//! loading a second runtime's tree — plus the two rows that can go non-green
//! without anything being broken: a check weakened by config or environment,
//! and a guard file that no longer matches what was installed. Those rows are
//! `ok` or `warn` and never `fail`, so they change no exit code. One row about
//! shared trees does fail: a copy of a kit skill or agent that no install here
//! recorded, under a second root an installed runtime reads.
mod adopt;
mod codex_trust;
mod coexistence;
mod coexistence_hooks;
mod coexistence_scan;
mod coexistence_sources;
mod extras;
mod hard_gates;
mod hook_commands;
mod hook_lines;
mod hooks;
mod host_config;
mod installs;
mod integrity;
mod overlap;
mod overlap_survey;
mod provenance;
mod skill_listing;
mod toolchain;
mod weakened;

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
    /// Live-probe the hard guards (privacy, injection, ship) in a scratch project.
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
        mewkit_adapters::registry::emitted()
    } else {
        parse_targets(&args.target)?
    };
    let place = Place::new(args.global)?;
    // The other scope may not resolve — an unset home is a scope fewer to read,
    // not an error — and when the project IS the home directory the two scopes
    // are one tree, where every name would be found at "both" scopes because
    // there is only one. Either way the coexistence rows get the scopes that
    // are really distinct; `installs` still sees both, because its question is
    // about two installs rather than two trees.
    let other = place.other();
    let elsewhere = other.as_ref().filter(|o| !same_root(o, &place));
    let scopes: Vec<&Place> = [Some(&place), elsewhere].into_iter().flatten().collect();
    let mut checks = toolchain::checks();
    checks.extend(installs::checks(&place, other.as_ref(), &targets));
    checks.extend(coexistence::checks(&scopes, &targets));
    checks.extend(overlap::checks(&scopes, &targets));
    checks.extend(skill_listing::checks(&scopes, &targets));
    checks.push(weakened::check(&scopes));
    checks.push(integrity::check(&scopes, &targets));
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

/// True when two places resolve to one directory, as they do for a project
/// opened in the home directory. The comparison canonicalizes both: the global
/// scope already resolves its root through any symlink, the project scope keeps
/// the working directory as given, and on macOS those two spellings of the same
/// directory differ (`/var/…` against `/private/var/…`).
fn same_root(a: &Place, b: &Place) -> bool {
    let real =
        |p: &Place| std::fs::canonicalize(&p.scope.root).unwrap_or_else(|_| p.scope.root.clone());
    real(a) == real(b)
}
