//! `mewkit-next upgrade`: move every installed runtime here to a newer kit.
//!
//! Targets and skill packs come from the ownership indexes. Files the new
//! kit no longer ships are removed when their bytes still match what the
//! old kit installed; that needs the old kit, read from the cache.
use clap::Args;
use mewkit_adapters::contract::{Op, RelPath, written_hashes};
use mewkit_core::exec::ExecOptions;

use super::{Common, Job, emitter_for, hashes_of, parse_targets, prepare, run_jobs, stamp};
use crate::failure::Failure;
use crate::kit_args::{KitArgs, installed_kit};
use crate::output;
use crate::place::Place;

#[derive(Args, Debug)]
pub struct UpgradeArgs {
    /// Only these installed runtimes (comma-separated); default: every one here.
    #[arg(long, value_name = "TARGETS")]
    pub target: Vec<String>,
    /// Show what would change and change nothing installed (a downloaded
    /// kit is still kept in the cache).
    #[arg(long)]
    pub dry_run: bool,
    #[command(flatten)]
    pub common: Common,
    #[command(flatten)]
    pub kit: KitArgs,
}

pub fn run(args: &UpgradeArgs) -> Result<u8, Failure> {
    let place = Place::new(args.common.global)?;
    let installed = place.installed()?;
    let targets = if args.target.is_empty() {
        installed.clone()
    } else {
        parse_targets(&args.target)?
    };
    if let Some(r) = targets.iter().find(|r| !installed.contains(r)) {
        return Err(Failure::usage(format!(
            "{} is not installed here ({}); use `mewkit-next init --target {}`",
            r.name(),
            place.label(),
            r.name()
        )));
    }
    if targets.is_empty() {
        return Ok(output::nothing(
            &format!("nothing installed here ({}) to upgrade", place.label()),
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
        // An old kit that no longer plans cleanly is treated as missing:
        // its files are kept rather than the upgrade refused.
        let old = installed_kit(&place, &index)
            .and_then(|k| hashes_of(&place, e, &k, &packs).ok())
            .unwrap_or_default();
        let mut plan = prepare(&place, e, &kit, &packs)?;
        let new = written_hashes(&plan);
        let roots = e.roots(&place.scope);
        for path in index.paths.keys().filter(|p| !new.contains_key(*p)) {
            let path = RelPath::new(path)?;
            if roots.iter().any(|r| path.is_within(r)) {
                plan.ops.push(Op::RemoveFile { path });
            }
        }
        if old.is_empty() && index.paths.keys().any(|p| !new.contains_key(p)) {
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
            dry_run: args.dry_run,
            force: args.common.force,
        },
        args.common.json,
    )?;
    Ok(output::exit_code(&outcomes, args.dry_run))
}
