//! `mewkit uninstall`: take the kit out again. A dry run unless `--yes`.
//!
//! Only what the ownership index records is touched, and a file is removed
//! only when its bytes still match what the kit installed. That check needs
//! the installed kit: from the cache, or the kit flags (`--kit-dir` for a
//! development install).
use clap::Args;
use mewkit_core::exec::ExecOptions;

use super::{Common, Job, emitter_for, hashes_of, parse_targets, run_jobs};
use crate::failure::Failure;
use crate::kit_args::{KitArgs, installed_kit};
use crate::output;
use crate::place::Place;

#[derive(Args, Debug)]
pub struct UninstallArgs {
    /// Runtimes to remove (comma-separated) or all; default: every one here.
    #[arg(long, value_name = "TARGETS")]
    pub target: Vec<String>,
    /// Apply the removal; without it, only show what would go.
    #[arg(long)]
    pub yes: bool,
    #[command(flatten)]
    pub common: Common,
    /// The kit the install was made from, when it is not in the cache.
    #[command(flatten)]
    pub kit: KitArgs,
}

pub fn run(args: &UninstallArgs) -> Result<u8, Failure> {
    let place = Place::new(args.common.global)?;
    let installed = place.installed()?;
    let wanted = if args.target.is_empty() {
        installed.clone()
    } else {
        parse_targets(&args.target)?
    };
    let targets: Vec<_> = wanted
        .into_iter()
        .filter(|r| installed.contains(r))
        .collect();
    if targets.is_empty() {
        return Ok(output::nothing(
            &format!("nothing to uninstall here ({})", place.label()),
            args.common.json,
        ));
    }
    let named_kit = args.kit.kit_dir.is_some()
        || args.kit.kit_archive.is_some()
        || args.kit.kit_version.is_some();
    // Resolved once: the kit flags name one kit for every target.
    let named = if named_kit {
        Some(args.kit.resolve(&place)?)
    } else {
        None
    };
    let mut jobs = Vec::new();
    for runtime in targets {
        let e = emitter_for(runtime)?;
        let index = place.index(runtime)?.expect("listed as installed");
        let cached = if named.is_none() {
            installed_kit(&place, &index)
        } else {
            None
        };
        let mut plan = e.plan_strip(&place.scope, &index)?;
        // A kit that no longer plans cleanly counts as missing, not as fatal.
        let hashes = named
            .as_ref()
            .or(cached.as_ref())
            .and_then(|k| hashes_of(&place, e, k, &index.packs).ok())
            .unwrap_or_default();
        if hashes.is_empty() && !index.paths.is_empty() {
            plan.notices.insert(
                0,
                format!(
                    "kit {} is not available, so no installed file can be confirmed as the kit's: \
                     files are kept, config entries are still removed. Pass the kit it was \
                     installed from (--kit-version {0}, or --kit-archive) to remove the files too",
                    index.kit_version
                ),
            );
        }
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
            dry_run: !args.yes,
            force: args.common.force,
        },
        args.common.json,
    )?;
    if !args.yes && outcomes.iter().any(|o| !o.report.removed.is_empty()) {
        eprintln!("dry run: nothing was removed; run again with --yes to apply");
    }
    Ok(output::exit_code(&outcomes, !args.yes))
}
