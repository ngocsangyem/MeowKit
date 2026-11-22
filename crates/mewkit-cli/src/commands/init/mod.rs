//! `mewkit init`: install the kit for one or more runtimes.
mod choose;
mod guard;
mod mcp;
mod update_notice;

use clap::Args;
use mewkit_adapters::claude_code::plugin_manifest;
use mewkit_adapters::contract::{OwnershipIndex, Runtime, ScopeKind, written_hashes};
use mewkit_adapters::eval_pack;
use mewkit_core::exec::ExecOptions;

use self::choose::Delivery;
use super::{
    Common, Job, depends_on, drop_retired, emitter_for, parse_targets_at, prepare_among, run_jobs,
    stamp, unconfirmed_force,
};
use crate::adopt;
use crate::failure::{FAILED, Failure};
use crate::kit_args::{KitArgs, contract_label};
use crate::output;
use crate::place::Place;
use crate::rebuild;

#[derive(Args, Debug)]
pub struct InitArgs {
    /// Runtimes to install for: claude-code, codex, cursor, grok, pi, omp, antigravity (comma-separated)
    /// or all. Omitted: Claude Code with --yes or in a project that has
    /// `.claude/`, otherwise a picker.
    #[arg(long, value_name = "TARGETS")]
    pub target: Vec<String>,
    /// Claude Code: install a subset (core, developer, product, atlassian,
    /// security, research, or full). Re-running with a narrower profile
    /// removes what the narrower profile no longer includes, unless you
    /// edited it.
    #[arg(long, value_name = "PROFILE")]
    pub profile: Option<String>,
    /// Every runtime but Claude Code: comma-separated skill packs, or `all`. Omitted
    /// installs every skill; an empty value installs the default pack only.
    /// `eval` (any runtime) also installs the eval cases to .meowkit/eval/.
    #[arg(long, value_name = "PACKS")]
    pub skill_packs: Option<String>,
    /// Claude Code only: `native` (the host's own directory) or `plugin` (the
    /// same content plus a plugin manifest).
    #[arg(long, value_name = "SHAPE")]
    pub delivery: Option<String>,
    /// Cursor: MCP profile names, or `all`, to merge into .cursor/mcp.json.
    /// Without it no MCP config is written.
    #[arg(long, value_name = "NAMES")]
    pub mcp_profiles: Option<String>,
    /// Cursor: second opt-in for applying an MCP profile to a project that
    /// has a git remote (Cursor Cloud Agents run no local MCP hooks).
    #[arg(long)]
    pub allow_cloud_mcp: bool,
    /// Run even in the MeowKit source repo (whose `.claude/` is the kit's
    /// authored source, and which an install would overwrite).
    #[arg(long)]
    pub allow_kit_source: bool,
    /// Show what would change and change nothing installed (a downloaded
    /// kit is still kept in the cache).
    #[arg(long)]
    pub dry_run: bool,
    /// The kit release the files here came from (e.g. v3.0.0), when a project
    /// has the kit's files and no install record. Files that still match that
    /// release are taken as the kit's; the rest stay yours.
    #[arg(long, value_name = "TAG")]
    pub adopt_from: Option<String>,
    /// Answer every question with its default and do not ask any.
    #[arg(long, short = 'y')]
    pub yes: bool,
    #[command(flatten)]
    pub common: Common,
    #[command(flatten)]
    pub kit: KitArgs,
}

pub fn run(args: &InitArgs) -> Result<u8, Failure> {
    let named = if args.target.is_empty() {
        Vec::new()
    } else {
        let scope = if args.common.global {
            ScopeKind::Global
        } else {
            ScopeKind::Project
        };
        parse_targets_at(&args.target, Some(scope))?
    };
    // Checked first so a refused combination writes (and fetches) nothing.
    let for_delivery = if named.is_empty() {
        vec![Runtime::ClaudeCode]
    } else {
        named.clone()
    };
    let delivery = match choose::delivery(&for_delivery, args.delivery.as_deref()) {
        Ok(d) => d,
        Err(message) => {
            eprintln!("{message}");
            return Ok(FAILED);
        }
    };
    let place = Place::new(args.common.global)?;
    if !args.dry_run
        && !args.allow_kit_source
        && let Some(code) = guard::refuse_kit_source(&place)
    {
        return Ok(code);
    }
    let (targets, picked) = if named.is_empty() {
        let installed = place.scope.root.join(".claude").exists();
        choose::pick_targets(args.yes, installed)?
    } else {
        (named, false)
    };

    let unconfirmed = unconfirmed_force("init", args.common.force, args.yes);
    let dry_run = args.dry_run || unconfirmed;
    let kit = args.kit.resolve(&place)?;
    for n in &kit.notices {
        eprintln!("note: {n}");
    }
    let mut profile = args.profile.clone();
    let interactive = crate::prompt::is_interactive();
    if profile.is_none()
        && interactive
        && !args.yes
        && targets.contains(&Runtime::ClaudeCode)
        && !place.scope.root.join(".claude").exists()
    {
        profile = choose::prompt_profile(&kit)?;
    }
    if profile.is_some() && !targets.contains(&Runtime::ClaudeCode) {
        eprintln!("note: --profile applies to claude-code only; ignored");
    }
    // `eval` is not a skill pack: it adds the eval cases for every runtime this
    // run installs, so it is taken out before any runtime reads the list.
    let (skill_packs, eval_pack) =
        eval_pack::split(&choose::skill_packs(args.skill_packs.as_deref()));
    let mut mcp_notes = Vec::new();

    // Codex, Pi, OMP and Antigravity write one `.agents/` tree between them, in wording
    // that depends on which of them are here. One that is installed already is
    // planned again, first, so its files are in the wording the newcomer writes.
    let rejoining = depends_on(&targets, &place.installed()?, place.scope.kind);
    for runtime in &rejoining {
        eprintln!(
            "note: {} is installed here and what it installs depends on the runtimes beside it, so it is planned again for the new set",
            runtime.name()
        );
    }
    let order: Vec<Runtime> = rejoining.iter().chain(&targets).copied().collect();

    let mut jobs = Vec::new();
    for &runtime in &order {
        let e = emitter_for(runtime)?;
        let (packs, trims) = match runtime {
            // As it was installed: this run's flags are for the runtimes it names.
            _ if rejoining.contains(&runtime) => {
                let packs = place.index(runtime)?.map(|i| i.packs).unwrap_or_default();
                (packs, false)
            }
            Runtime::ClaudeCode => {
                let (packs, notice) =
                    choose::profile_packs(&kit, profile.as_deref()).map_err(Failure::failed)?;
                notice.iter().for_each(|n| eprintln!("note: {n}"));
                let narrowed = !packs.is_empty();
                (packs, narrowed)
            }
            _ => (skill_packs.clone(), false),
        };
        let mut asked = packs.clone();
        if eval_pack && !rejoining.contains(&runtime) {
            asked.push(eval_pack::PACK.to_owned());
        }
        let mut plan = prepare_among(&place, e, &kit, &asked, &targets)?;
        if runtime == Runtime::ClaudeCode && delivery == Delivery::Plugin {
            plan.ops.push(plugin_manifest(&kit.version)?);
        }
        if runtime == Runtime::Cursor {
            let out = mcp::plan(
                &kit,
                &place.scope.root,
                &mcp::Request {
                    flag: args.mcp_profiles.as_deref(),
                    allow_cloud: args.allow_cloud_mcp,
                    may_ask: picked,
                    dry_run,
                },
            );
            plan.ops.extend(out.op);
            mcp_notes.extend(out.notes);
        }
        let mut hashes = written_hashes(&plan);
        let mut index = match place.index(runtime)? {
            Some(index) => {
                if trims {
                    // A narrower profile trims the earlier, wider install.
                    drop_retired(&place, e, &index, &mut plan)?;
                    for (p, h) in &index.paths {
                        hashes.entry(p.clone()).or_insert_with(|| h.clone());
                    }
                }
                index
            }
            None => match adopt::record(&place, runtime)? {
                Some(record) => {
                    let index = adopt::take_over(&place, e, &record, &mut plan, &kit);
                    // No old kit exists: the adopted hashes corroborate removing
                    // what the npm install had and this kit no longer ships.
                    drop_retired(&place, e, &index, &mut plan)?;
                    for (p, h) in &index.paths {
                        hashes.entry(p.clone()).or_insert_with(|| h.clone());
                    }
                    index
                }
                None => {
                    let rebuilt = rebuild::source_kit(
                        &place,
                        args.adopt_from.as_deref(),
                        args.kit.allow_unverified_kit,
                        args.kit.may_fetch(),
                    )
                    .and_then(|old| rebuild::from_release(&place, e, &old, &packs, &mut plan));
                    match rebuilt {
                        Some((index, installs)) => {
                            // What that release installed corroborates removing
                            // the files this kit no longer ships.
                            drop_retired(&place, e, &index, &mut plan)?;
                            for (p, h) in installs {
                                hashes.entry(p).or_insert(h);
                            }
                            index
                        }
                        None => {
                            let differing = rebuild::collisions(&place, &plan);
                            if differing >= rebuild::MIXED_INSTALL_FLOOR && !args.common.force {
                                return Err(Failure::failed(mixed_install(
                                    runtime,
                                    differing,
                                    rebuild::recorded_version(&place).as_deref(),
                                )));
                            }
                            OwnershipIndex::new(&kit.version, &contract_label(&kit), kit.origin)
                        }
                    }
                }
            },
        };
        stamp_packs(&mut index, &kit, &packs, runtime);
        jobs.push(Job {
            e,
            plan,
            index,
            hashes,
            merge_base: None,
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
    for note in mcp_notes {
        eprintln!("note: {note}");
    }
    // Only where this run was allowed to reach GitHub for its kit anyway.
    if args.kit.may_fetch() {
        update_notice::show();
    }
    if unconfirmed {
        return Ok(crate::failure::PENDING);
    }
    Ok(output::exit_code(&outcomes, dry_run))
}

/// The index after this run: a Claude Code install records a pack subset with
/// `base` first (an index naming no pack records a full install).
fn stamp_packs(
    index: &mut OwnershipIndex,
    kit: &mewkit_core::kit::Kit,
    packs: &[String],
    runtime: Runtime,
) {
    let recorded: Vec<String> = if runtime == Runtime::ClaudeCode && !packs.is_empty() {
        std::iter::once("base".to_owned())
            .chain(packs.iter().cloned())
            .collect()
    } else {
        packs.to_vec()
    };
    stamp(index, kit, &recorded);
}

/// Why an install over an older kit with no record is refused, and the ways on.
fn mixed_install(runtime: Runtime, differing: usize, recorded: Option<&str>) -> String {
    let name = runtime.name();
    let from = match recorded {
        Some(version) => format!(
            "The files name kit {version}, which could not be fetched to compare them with; \
             run this again online"
        ),
        None => format!(
            "Name the kit release they came from and the files that still match it are taken as \
             the kit's: `mewkit init --target {name} --adopt-from <tag>` (a release before 3.0.0 \
             also needs --allow-unverified-kit)"
        ),
    };
    format!(
        "{differing} files the kit installs for {name} are already here with other contents, and \
         nothing records who put them there. That is what an older kit looks like once its install \
         record is gone, and installing over it would leave two kit versions mixed together, so \
         nothing was written. {from}. Or replace them all, each one backed up first: \
         `mewkit init --target {name} --force`."
    )
}
