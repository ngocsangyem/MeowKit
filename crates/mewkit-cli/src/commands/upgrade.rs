//! `mewkit upgrade`: move every installed runtime here to a newer kit.
//!
//! Targets and skill packs come from the ownership indexes. Files the new
//! kit no longer ships are removed when their bytes still match what the
//! old kit installed; that needs the old kit, read from the cache.
use clap::Args;
use mewkit_adapters::contract::written_hashes;
use mewkit_core::exec::ExecOptions;

use super::upgrade_query::{self, Query};
use super::{
    Common, Job, drop_retired, emitter_for, hashes_of, parse_targets, prepare, run_jobs, stamp,
    unconfirmed_force,
};
use crate::failure::{Failure, PENDING};
use crate::kit_args::{KitArgs, installed_kit};
use crate::output;
use crate::place::Place;

use mewkit_adapters::contract::Runtime;

#[derive(Args, Debug)]
pub struct UpgradeArgs {
    /// Only these installed runtimes (comma-separated); default: every one here.
    #[arg(long, value_name = "TARGETS")]
    pub target: Vec<String>,
    /// Show what would change and change nothing installed (a downloaded
    /// kit is still kept in the cache).
    #[arg(long)]
    pub dry_run: bool,
    /// Report the installed kit against the newest release; change nothing.
    #[arg(long, conflicts_with_all = ["list", "dry_run"])]
    pub check: bool,
    /// List the kit releases that can be installed; change nothing.
    #[arg(long, conflicts_with = "dry_run")]
    pub list: bool,
    /// Accepted for scripts written for the npm CLI. There is no download
    /// directory to keep: a downloaded kit always stays in the cache.
    #[arg(long)]
    pub no_cleanup: bool,
    /// Confirm --force in a session with no terminal (CI, a pipe, a hook).
    #[arg(long)]
    pub yes: bool,
    #[command(flatten)]
    pub common: Common,
    #[command(flatten)]
    pub kit: KitArgs,
}

pub fn run(args: &UpgradeArgs) -> Result<u8, Failure> {
    let place = Place::new(args.common.global)?;
    if args.check || args.list {
        let query = if args.check {
            Query::Check
        } else {
            Query::List
        };
        return upgrade_query::run(
            &place,
            query,
            args.kit.beta,
            args.kit.offline,
            args.common.json,
        );
    }
    let unconfirmed = unconfirmed_force("upgrade", args.common.force, args.yes);
    let dry_run = args.dry_run || unconfirmed;
    let installed = place.installed()?;
    let targets = if args.target.is_empty() {
        installed.clone()
    } else {
        parse_targets(&args.target)?
    };
    if let Some(r) = targets.iter().find(|r| !installed.contains(r)) {
        return Err(Failure::usage(format!(
            "{} is not installed here ({}); use `mewkit init --target {}`",
            r.name(),
            place.label(),
            r.name()
        )));
    }
    if targets.is_empty() {
        return Ok(output::nothing(
            &format!(
                "nothing installed here ({}) to upgrade{}",
                place.label(),
                unmanaged_hint(&place)
            ),
            args.common.json,
        ));
    }
    let kit = args.kit.resolve(&place)?;
    for n in &kit.notices {
        eprintln!("note: {n}");
    }
    let mut jobs = Vec::new();
    for runtime in targets {
        let e = emitter_for(runtime)?;
        let mut index = place.index(runtime)?.expect("listed as installed");
        let packs = index.packs.clone();
        // An old kit that no longer plans cleanly is treated as missing: its
        // files are kept rather than the upgrade refused.
        let old = installed_kit(&place, &index)
            .and_then(|k| hashes_of(&place, e, &k, &packs).ok())
            .unwrap_or_default();
        let mut plan = prepare(&place, e, &kit, &packs)?;
        let new = written_hashes(&plan);
        if drop_retired(&place, e, &index, &mut plan)? > 0 && old.is_empty() {
            plan.notices.insert(
                0,
                format!(
                    "kit {} is not available, so files the new kit dropped are kept",
                    index.kit_version
                ),
            );
        }
        stamp(&mut index, &kit, &packs);
        // New bytes first; the old kit corroborates only what the new one dropped.
        let mut hashes = old;
        hashes.extend(new);
        jobs.push(Job {
            e,
            plan,
            index,
            hashes,
        });
    }
    let outcomes = run_jobs(
        &place,
        jobs,
        ExecOptions {
            dry_run,
            force: args.common.force,
        },
        args.common.json,
    )?;
    if unconfirmed {
        return Ok(PENDING);
    }
    Ok(output::exit_code(&outcomes, dry_run))
}

/// What is here that `upgrade` does not manage, and the command that takes it over.
fn unmanaged_hint(place: &Place) -> String {
    if place.label() != "project" {
        return String::new();
    }
    let mut npm = Vec::new();
    let mut bare = Vec::new();
    for (dir, runtime) in [
        (".claude", Runtime::ClaudeCode),
        (".codex", Runtime::Codex),
        (".cursor", Runtime::Cursor),
    ] {
        if crate::adopt::has_record(place, runtime) {
            npm.push(runtime.name());
        } else if place.scope.root.join(dir).is_dir() {
            bare.push(runtime.name());
        }
    }
    let mut out = String::new();
    if !npm.is_empty() {
        out += &format!(
            "; the npm mewkit CLI installed {0} here: `mewkit init --target {0}` \
             (with the --skill-packs you want) takes it over, keeping files you edited",
            npm.join(",")
        );
    }
    if !bare.is_empty() {
        out += &format!(
            "; {0} has no install record: `mewkit init --target {0}` installs the kit \
             there and keeps every file that differs from it",
            bare.join(",")
        );
    }
    out
}
