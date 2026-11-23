//! The lifecycle commands, and the pieces they share.
pub mod advice;
pub mod backups;
pub mod budget;
pub mod capabilities;
pub mod doctor;
pub mod eval;
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
pub mod skill_store;
pub mod task;
pub mod task_state;
pub mod trace;
pub mod uninstall;
pub mod upgrade;
mod upgrade_query;
pub mod validate;
pub mod versions;

use std::collections::BTreeMap;

use clap::Args;
use mewkit_adapters::contract::{Kit, Op, OwnershipIndex, Plan, RelPath, Runtime, written_hashes};
use mewkit_adapters::placement_resolver::resolve;
use mewkit_adapters::registry::emitted;
use mewkit_adapters::retired_eval_pack;
use mewkit_adapters::surface_table::table;
use mewkit_adapters::{EmitRequest, Emitter, ScopeKind, emitter};
use mewkit_core::exec::{ExecOptions, Merges, execute_merging};

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
    parse_targets_at(list, None)
}

/// As [`parse_targets`], where `all` means every runtime that installs at
/// `scope`. A runtime named outright is kept, so its emitter says why it
/// cannot install there.
pub fn parse_targets_at(
    list: &[String],
    scope: Option<ScopeKind>,
) -> Result<Vec<Runtime>, Failure> {
    let mut out = Vec::new();
    for name in list.iter().flat_map(|l| l.split(',')).map(str::trim) {
        if name == "all" {
            let fits = |r: &Runtime| {
                scope.is_none_or(|kind| emitter(*r).is_some_and(|e| e.supports(kind)))
            };
            return Ok(emitted().into_iter().filter(fits).collect());
        }
        // A runtime the surface table knows but no emitter installs yet is not a target.
        let installable = Runtime::from_name(name).filter(|r| emitter(*r).is_some());
        let r = installable.ok_or_else(|| {
            let known: Vec<_> = emitted().iter().map(|r| r.name()).collect();
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
    prepare_among(place, e, kit, packs, &[])
}

/// As [`prepare`], when `joining` are being installed in the same run: the
/// placement covers them as well as what is installed here already.
pub fn prepare_among(
    place: &Place,
    e: &dyn Emitter,
    kit: &Kit,
    packs: &[String],
    joining: &[Runtime],
) -> Result<Plan, Failure> {
    prepare_for(place, e, kit, packs, joining, &[])
}

/// As [`prepare`], when `leaving` are being uninstalled in the same run: the
/// placement is for the runtimes that stay.
pub fn prepare_without(
    place: &Place,
    e: &dyn Emitter,
    kit: &Kit,
    packs: &[String],
    leaving: &[Runtime],
) -> Result<Plan, Failure> {
    prepare_for(place, e, kit, packs, &[], leaving)
}

fn prepare_for(
    place: &Place,
    e: &dyn Emitter,
    kit: &Kit,
    packs: &[String],
    joining: &[Runtime],
    leaving: &[Runtime],
) -> Result<Plan, Failure> {
    let other = place
        .other()
        .and_then(|p| p.index(e.target()).ok().flatten());
    let placement = match place.scope.kind {
        ScopeKind::Project => {
            let mut set = place.installed()?;
            set.push(e.target());
            set.extend_from_slice(joining);
            set.retain(|r| !leaving.contains(r));
            Some(resolve(table(), &set))
        }
        ScopeKind::Global => None,
    };
    let disabled = crate::skill_selection::disabled(place, kit, packs)?;
    Ok(e.prepare(&EmitRequest {
        kit,
        scope: &place.scope,
        packs,
        disabled: &disabled,
        fresh: false,
        other_scope: other.as_ref(),
        placement: placement.as_ref(),
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
    /// For an upgrade: the previous kit's bytes for each skill file, the
    /// base for merging the user's edits (empty when that kit is not in the
    /// cache). `None` for every other command: nothing is merged.
    pub merge_base: Option<BTreeMap<String, Vec<u8>>>,
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
    let mut store = skill_store::lifecycle::before(place);
    let refresh = |store: Option<&_>| {
        if !opts.dry_run {
            skill_store::lifecycle::after(place, store);
        }
    };
    for mut job in jobs {
        let mut hashes = std::mem::take(&mut job.hashes);
        // No kit plans the retired eval pack's files, so their own record
        // corroborates removing them; a file edited since is still kept.
        for (path, hash) in retired_eval_pack::recorded_hashes(&job.index) {
            hashes.entry(path).or_insert(hash);
        }
        let kept = skill_store::lifecycle::keep(store.as_mut(), &mut job.plan, &mut job.index);
        // Planned after `keep`, so a skill the store keeps is never merged;
        // `--force` replaces edited files, so nothing is merged under it.
        let merged = job.merge_base.as_ref().filter(|_| !opts.force).map(|base| {
            skill_store::upgrade_merge::plan(place, job.e.target(), &job.plan, &job.index, base)
        });
        let report = execute_merging(
            &job.plan,
            &place.exec_scope(job.e),
            &mut job.index,
            &|p: &RelPath| hashes.get(p.as_str()).cloned(),
            merged.as_ref().map_or(&Merges::new(), |m| &m.merges),
            opts,
        );
        match report {
            Ok(mut report) => {
                report.preserved.extend(kept);
                if let Some(m) = &merged {
                    let lines = skill_store::upgrade_merge::notices(m, opts.dry_run);
                    report.notices.extend(lines);
                }
                outcomes.push(Outcome {
                    runtime: job.e.target(),
                    scope: place.label(),
                    report,
                });
            }
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
                refresh(store.as_ref());
                return Err(failure);
            }
        }
    }
    refresh(store.as_ref());
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

/// The runtimes among `installed` whose files depend on `changing` being here
/// or not, `changing` itself left out. Codex, Pi, OMP and Antigravity write one
/// `.agents/` tree in wording that depends on which of them are installed, and OMP
/// switches off its import of `.claude/` only beside Claude Code.
pub fn depends_on(changing: &[Runtime], installed: &[Runtime], scope: ScopeKind) -> Vec<Runtime> {
    let sharers = mewkit_adapters::agents_tree::WRITERS;
    let depends = |r: &Runtime| {
        (sharers.contains(r) && changing.iter().any(|c| sharers.contains(c)))
            || (*r == Runtime::Omp && changing.contains(&Runtime::ClaudeCode))
    };
    if scope != ScopeKind::Project {
        return Vec::new();
    }
    installed
        .iter()
        .copied()
        .filter(|r| !changing.contains(r) && depends(r))
        .collect()
}
