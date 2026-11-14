//! `mewkit-next init`: install the kit for one or more runtimes.
mod choose;
mod guard;
mod mcp;

use clap::Args;
use mewkit_adapters::claude_code::plugin_manifest;
use mewkit_adapters::contract::{OwnershipIndex, Runtime, written_hashes};
use mewkit_core::exec::ExecOptions;

use self::choose::Delivery;
use super::{
    Common, Job, drop_retired, emitter_for, parse_targets, prepare, run_jobs, stamp,
    unconfirmed_force,
};
use crate::adopt;
use crate::failure::{FAILED, Failure};
use crate::kit_args::{KitArgs, contract_label};
use crate::output;
use crate::place::Place;

#[derive(Args, Debug)]
pub struct InitArgs {
    /// Runtimes to install for: claude-code, codex, cursor (comma-separated)
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
    /// Codex and Cursor: comma-separated skill packs, or `all`. Omitted
    /// installs every skill; an empty value installs the default pack only.
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
        parse_targets(&args.target)?
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
    let skill_packs = choose::skill_packs(args.skill_packs.as_deref());
    let mut mcp_notes = Vec::new();

    let mut jobs = Vec::new();
    for runtime in targets {
        let e = emitter_for(runtime)?;
        let (packs, trims) = match runtime {
            Runtime::ClaudeCode => {
                let (packs, notice) =
                    choose::profile_packs(&kit, profile.as_deref()).map_err(Failure::failed)?;
                notice.iter().for_each(|n| eprintln!("note: {n}"));
                let narrowed = !packs.is_empty();
                (packs, narrowed)
            }
            _ => (skill_packs.clone(), false),
        };
        let mut plan = prepare(&place, e, &kit, &packs)?;
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
                None => OwnershipIndex::new(&kit.version, &contract_label(&kit), kit.origin),
            },
        };
        stamp_packs(&mut index, &kit, &packs, runtime);
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
    for note in mcp_notes {
        eprintln!("note: {note}");
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
