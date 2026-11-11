//! `mewkit-next init`: install the kit for one or more runtimes.
use clap::Args;
use mewkit_adapters::contract::{OwnershipIndex, written_hashes};
use mewkit_core::exec::ExecOptions;

use super::{Common, Job, emitter_for, parse_targets, prepare, run_jobs, stamp};
use crate::failure::Failure;
use crate::kit_args::{KitArgs, contract_label};
use crate::output;
use crate::place::Place;

#[derive(Args, Debug)]
pub struct InitArgs {
    /// Runtimes to install for: claude-code, codex, cursor (comma-separated) or all.
    #[arg(long, required = true, value_name = "TARGETS")]
    pub target: Vec<String>,
    /// Optional skill packs on top of the core kit (comma-separated).
    #[arg(long, value_name = "PACKS", value_delimiter = ',')]
    pub skill_packs: Vec<String>,
    /// Show what would change and change nothing installed (a downloaded
    /// kit is still kept in the cache).
    #[arg(long)]
    pub dry_run: bool,
    /// Answer yes to every question (there are none yet; accepted for scripts).
    #[arg(long)]
    pub yes: bool,
    #[command(flatten)]
    pub common: Common,
    #[command(flatten)]
    pub kit: KitArgs,
}

pub fn run(args: &InitArgs) -> Result<u8, Failure> {
    let targets = parse_targets(&args.target)?;
    let place = Place::new(args.common.global)?;
    let kit = args.kit.resolve(&place)?;
    for n in &kit.notices {
        eprintln!("note: {n}");
    }
    let packs = args.skill_packs.clone();
    let mut jobs = Vec::new();
    for runtime in targets {
        let e = emitter_for(runtime)?;
        let plan = prepare(&place, e, &kit, &packs)?;
        let hashes = written_hashes(&plan);
        let mut index = place.index(runtime)?.unwrap_or_else(|| {
            OwnershipIndex::new(&kit.version, &contract_label(&kit), kit.origin)
        });
        stamp(&mut index, &kit, &packs);
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
