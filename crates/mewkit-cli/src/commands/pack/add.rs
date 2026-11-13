//! `pack add`: write the files of newly named packs, and nothing else.
use std::collections::BTreeSet;

use mewkit_adapters::contract::{Op, Runtime, written_hashes};
use mewkit_core::exec::{ExecOptions, execute};
use mewkit_core::kit::Kit;
use mewkit_core::validate::{BASE_PACK, load_pack_manifest, resolve_packs};

use super::envelope::{self, changes};
use super::state::stored;
use super::{Context, PackArgs};
use crate::commands::{emitter_for, prepare};
use crate::failure::{FAILED, Failure, OK};
use crate::kit_args::KitArgs;

pub fn run(ctx: &Context, args: &PackArgs) -> Result<u8, Failure> {
    let requested: Vec<&String> = args.packs.iter().filter(|p| *p != BASE_PACK).collect();
    for name in &requested {
        if !ctx.manifest.has_pack(name) {
            eprintln!(
                "Unknown pack \"{name}\". Available: {}",
                ctx.manifest.available_packs().join(", ")
            );
            return Ok(FAILED);
        }
    }
    let new_packs: Vec<String> = requested
        .iter()
        .filter(|p| !ctx.installed.has(p))
        .map(|p| (*p).clone())
        .collect();
    if new_packs.is_empty() {
        let list = requested
            .iter()
            .map(|p| p.as_str())
            .collect::<Vec<_>>()
            .join(", ");
        let note = format!(
            "Already installed: {} — nothing to do.",
            if list.is_empty() {
                "(nothing requested)"
            } else {
                &list
            }
        );
        if args.json {
            envelope::print("pack add", args.dry_run, &[], &[], &[note]);
        } else {
            println!("{note}");
        }
        return Ok(OK);
    }

    let kit = kit_for(ctx, args)?;
    if !args.json {
        println!(
            "Fetching v{} to add: {}...",
            kit.version,
            new_packs.join(", ")
        );
    }
    // The kit is read even for a dry run: which files a pack consists of is
    // recorded in the kit's own manifest, so a plan that did not read it would
    // be a guess.
    let src_claude = kit.dir.join(".claude");
    let src_manifest =
        load_pack_manifest(&src_claude).map_err(|e| Failure::failed(e.to_string()))?;
    let have: BTreeSet<String> = ctx
        .installed
        .index
        .iter()
        .flat_map(|i| i.paths.keys())
        .filter_map(|p| p.strip_prefix(".claude/").map(str::to_owned))
        .collect();
    let allowed: BTreeSet<String> = resolve_packs(&src_claude, &src_manifest, &new_packs)
        .map_err(|e| Failure::failed(e.to_string()))?
        .paths
        .difference(&have)
        .cloned()
        .collect();
    let allowed_list: Vec<String> = allowed.iter().cloned().collect();
    let planned = changes("create", &allowed_list);

    let mut next = ctx.installed.non_base();
    next.extend(new_packs.iter().cloned());
    let e = emitter_for(Runtime::ClaudeCode)?;
    let mut plan = prepare(&ctx.place, e, &kit, &next)?;
    // Only the new packs' files: a pack add never rewrites or removes what is
    // already installed, and base (settings merges included) is installed.
    plan.ops.retain(|op| {
        matches!(op, Op::WriteFile { path, .. }
            if path.as_str().strip_prefix(".claude/").is_some_and(|p| allowed.contains(p)))
    });
    let hashes = written_hashes(&plan);
    let mut written = 0;
    if !args.dry_run {
        let mut index = ctx
            .installed
            .index
            .clone()
            .ok_or_else(|| Failure::failed("no Claude Code install to add packs to"))?;
        index.packs = stored(&next);
        let report = execute(
            &plan,
            &ctx.place.exec_scope(e),
            &mut index,
            &|p| hashes.get(p.as_str()).cloned(),
            ExecOptions::default(),
        )?;
        for (path, why) in &report.preserved {
            eprintln!("note: kept {path}: {why}");
        }
        written = report.written.len();
    }

    let list = new_packs.join(", ");
    let summary = if args.dry_run {
        format!(
            "Dry-run: would add {list} — {} file(s), nothing written.",
            planned.len()
        )
    } else {
        format!("Added {list}: {written} file(s) written, 0 updated.")
    };
    if args.json {
        let applied = if args.dry_run {
            vec![]
        } else {
            changes("create", &allowed_list)
        };
        envelope::print("pack add", args.dry_run, &planned, &applied, &[summary]);
        return Ok(OK);
    }
    for change in &planned {
        println!(
            "  {}{} {}",
            if args.dry_run { "would " } else { "" },
            change.action,
            change.path
        );
    }
    println!("{summary}");
    Ok(OK)
}

/// The kit the install was made from when it can be had, else the newest.
fn kit_for(ctx: &Context, args: &PackArgs) -> Result<Kit, Failure> {
    let k = &args.kit;
    let explicit =
        k.kit_dir.is_some() || k.kit_archive.is_some() || k.offline || k.kit_version.is_some();
    if !explicit && let Some(index) = &ctx.installed.index {
        let same = KitArgs {
            kit_version: Some(index.kit_version.clone()),
            allow_unverified_kit: k.allow_unverified_kit,
            ..KitArgs::default()
        };
        if let Ok(kit) = same.resolve(&ctx.place) {
            return Ok(kit);
        }
    }
    k.resolve(&ctx.place)
}
