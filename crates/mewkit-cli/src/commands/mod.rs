//! The lifecycle commands, and the pieces they share.
pub mod advice;
pub mod backups;
pub mod budget;
pub mod capabilities;
pub mod doctor;
pub mod init;
pub mod note;
pub mod orient;
pub mod pack;
pub mod plan;
pub mod providers;
pub mod review;
pub mod self_update;
pub mod setup;
pub mod skill;
pub mod task;
pub mod task_state;
pub mod trace;
pub mod uninstall;
pub mod upgrade;
mod upgrade_query;
pub mod validate;
pub mod verdict_gate;
pub mod versions;

use std::collections::BTreeMap;

use clap::Args;
use mewkit_adapters::contract::{Kit, Op, OwnershipIndex, Plan, RelPath, Runtime, written_hashes};
use mewkit_adapters::{EmitRequest, Emitter, emitter};
use mewkit_core::exec::{ExecOptions, execute};

use crate::failure::Failure;
use crate::kit_args::contract_label;
use crate::output::{self, Outcome};
use crate::place::Place;

/// Flags every lifecycle command takes.
#[derive(Args, Debug)]
pub struct Common {
    /// Act on your home directory instead of this project.
    #[arg(long)]
    pub global: bool,
    /// Print one JSON document instead of text.
    #[arg(long)]
    pub json: bool,
    /// Replace or remove files you edited after the kit installed them.
    #[arg(long)]
    pub force: bool,
}

/// True when `--force` was asked for with no terminal to confirm it in and no
/// `--yes`: the command then previews and exits 3 instead of overwriting files
/// the user edited on an unseen plan. Prints why.
pub fn unconfirmed_force(command: &str, force: bool, yes: bool) -> bool {
    let unconfirmed = force && !yes && !crate::prompt::is_interactive();
    if unconfirmed {
        eprintln!(
            "{command} --force can overwrite or remove files and this session has no terminal \
             to confirm in. Nothing was written. Re-run with --yes (or --dry-run to see the plan)."
        );
    }
    unconfirmed
}

/// `claude-code,codex` (or `all`) as runtimes, in the order given.
pub fn parse_targets(list: &[String]) -> Result<Vec<Runtime>, Failure> {
    let mut out = Vec::new();
    for name in list.iter().flat_map(|l| l.split(',')).map(str::trim) {
        if name == "all" {
            return Ok(Runtime::ALL.to_vec());
        }
        let r = Runtime::from_name(name).ok_or_else(|| {
            let known: Vec<_> = Runtime::ALL.iter().map(|r| r.name()).collect();
            Failure::usage(format!(
                "unknown target '{name}' (known: {})",
                known.join(", ")
            ))
        })?;
        if !out.contains(&r) {
            out.push(r);
        }
    }
    Ok(out)
}

pub fn emitter_for(runtime: Runtime) -> Result<&'static dyn Emitter, Failure> {
    emitter(runtime).ok_or_else(|| Failure::failed(format!("{} has no emitter", runtime.name())))
}

/// `kit`'s install plan for `runtime` here, with the other scope's index.
pub fn prepare(
    place: &Place,
    e: &dyn Emitter,
    kit: &Kit,
    packs: &[String],
) -> Result<Plan, Failure> {
    let other = place
        .other()
        .and_then(|p| p.index(e.target()).ok().flatten());
    Ok(e.prepare(&EmitRequest {
        kit,
        scope: &place.scope,
        packs,
        disabled: &[],
        fresh: false,
        other_scope: other.as_ref(),
    })?)
}

/// What `kit` installs at each path, by path.
pub fn hashes_of(
    place: &Place,
    e: &dyn Emitter,
    kit: &Kit,
    packs: &[String],
) -> Result<BTreeMap<String, String>, Failure> {
    Ok(written_hashes(&prepare(place, e, kit, packs)?))
}

/// The index after this run records `kit` as its source.
pub fn stamp(index: &mut OwnershipIndex, kit: &Kit, packs: &[String]) {
    index.kit_version = kit.version.clone();
    index.kit_contract = contract_label(kit);
    index.origin = kit.origin;
    index.packs = packs.to_vec();
}

/// One target's prepared run: everything is planned before anything is
/// applied, so a bad kit or a bad index stops the command with nothing done.
pub struct Job {
    pub e: &'static dyn Emitter,
    pub plan: Plan,
    pub index: OwnershipIndex,
    /// What the kit installs at each path, to corroborate removals.
    pub hashes: BTreeMap<String, String>,
}

/// Apply every job in order and print the outcomes. When one fails, the
/// targets already applied are printed before the error is returned, so
/// the user sees what changed.
pub fn run_jobs(
    place: &Place,
    jobs: Vec<Job>,
    opts: ExecOptions,
    json: bool,
) -> Result<Vec<Outcome>, Failure> {
    let mut outcomes = Vec::new();
    for mut job in jobs {
        let hashes = std::mem::take(&mut job.hashes);
        let report = execute(
            &job.plan,
            &place.exec_scope(job.e),
            &mut job.index,
            &|p: &RelPath| hashes.get(p.as_str()).cloned(),
            opts,
        );
        match report {
            Ok(report) => outcomes.push(Outcome {
                runtime: job.e.target(),
                scope: place.label(),
                report,
            }),
            Err(err) => {
                output::print(&outcomes, json);
                let mut failure = Failure::from(err);
                failure.message = format!(
                    "{}: {}{}",
                    job.e.target().name(),
                    failure.message,
                    if outcomes.is_empty() {
                        String::new()
                    } else {
                        "; the targets listed above were applied".into()
                    }
                );
                return Err(failure);
            }
        }
    }
    output::print(&outcomes, json);
    Ok(outcomes)
}

/// Remove what `index` owns that the new plan no longer writes, inside the
/// emitter's roots. Each removal still needs the bytes to match a known kit
/// hash. Returns how many paths were queued.
pub fn drop_retired(
    place: &Place,
    e: &dyn Emitter,
    index: &OwnershipIndex,
    plan: &mut Plan,
) -> Result<usize, Failure> {
    let new = written_hashes(plan);
    let roots = e.roots(&place.scope);
    let mut queued = 0;
    for path in index.paths.keys().filter(|p| !new.contains_key(*p)) {
        let path = RelPath::new(path)?;
        if roots.iter().any(|r| path.is_within(r)) {
            plan.ops.push(Op::RemoveFile { path });
            queued += 1;
        }
    }
    Ok(queued)
}
