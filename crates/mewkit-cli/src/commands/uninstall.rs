//! `mewkit uninstall`: take the kit out again. A dry run unless `--yes`.
//!
//! Only what the ownership index records is touched, and a file is removed
//! only when its bytes still match what the kit installed. That check needs
//! the installed kit: from the cache, or the kit flags (`--kit-dir` for a
//! development install).
use clap::Args;
use mewkit_adapters::contract::{Op, OwnershipIndex, Plan, Runtime};
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
    let mut staying = Vec::new();
    for runtime in installed.iter().filter(|r| !targets.contains(r)) {
        staying.push((
            *runtime,
            place.index(*runtime)?.expect("listed as installed"),
        ));
    }
    let mut jobs = Vec::new();
    for runtime in targets {
        let e = emitter_for(runtime)?;
        let mut index = place.index(runtime)?.expect("listed as installed");
        let cached = if named.is_none() {
            installed_kit(&place, &index)
        } else {
            None
        };
        let mut plan = e.plan_strip(&place.scope, &index)?;
        keep_shared_blocks(&staying, &mut plan, &mut index);
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

/// A marked block that a runtime staying here installed too is still read by
/// it: the block stays in the file and only leaves this install's record.
fn keep_shared_blocks(
    staying: &[(Runtime, OwnershipIndex)],
    plan: &mut Plan,
    index: &mut OwnershipIndex,
) {
    let holder = |path: &str, id: &str| {
        staying
            .iter()
            .find(|(_, other)| other.sections.get(path).is_some_and(|s| s.contains_key(id)))
            .map(|(runtime, _)| *runtime)
    };
    let mut kept = Vec::new();
    plan.ops.retain(|op| {
        let Op::StripBlock { path, id } = op else {
            return true;
        };
        let Some(runtime) = holder(path.as_str(), id) else {
            return true;
        };
        kept.push((path.to_string(), id.clone(), runtime));
        false
    });
    for (path, id, runtime) in kept {
        if let Some(sections) = index.sections.get_mut(&path) {
            sections.remove(&id);
            if sections.is_empty() {
                index.sections.remove(&path);
            }
        }
        plan.notices.push(format!(
            "{path}: the {id} block stays, because the {} install here reads it too",
            runtime.name()
        ));
    }
}
