//! `pack remove`: delete the files only the named packs own.
use std::collections::BTreeMap;

use mewkit_adapters::contract::{Op, Plan, RelPath, Runtime};
use mewkit_core::exec::{ExecOptions, execute};
use mewkit_core::fsx::sha256_hex;
use mewkit_core::pack_removal::{OnDisk, removable_paths};
use mewkit_core::validate::BASE_PACK;

use super::envelope::{self, changes};
use super::state::stored;
use super::{Context, PackArgs};
use crate::commands::emitter_for;
use crate::failure::{FAILED, Failure, OK};
use crate::prompt::{Ask, Flag, PromptError, default_prompt};

/// Packs that are core safety surface: never removable.
const PROTECTED: [&str; 2] = [BASE_PACK, "lifecycle-core"];

pub fn run(ctx: &Context, args: &PackArgs) -> Result<u8, Failure> {
    let requested = &args.packs;
    for name in requested {
        if PROTECTED.contains(&name.as_str()) {
            eprintln!("Refusing to remove \"{name}\" — core safety surface is not removable.");
            return Ok(FAILED);
        }
        if !ctx.manifest.has_pack(name) {
            eprintln!(
                "Unknown pack \"{name}\". Available: {}",
                ctx.manifest.available_packs().join(", ")
            );
            return Ok(FAILED);
        }
    }
    let next: Vec<String> = ctx
        .installed
        .non_base()
        .into_iter()
        .filter(|p| !requested.contains(p))
        .collect();

    let root = &ctx.place.scope.root;
    let recorded: BTreeMap<String, String> = ctx
        .installed
        .index
        .iter()
        .flat_map(|i| i.paths.iter().map(|(p, h)| (p.clone(), h.clone())))
        .collect();
    let on_disk = |path: &str| {
        let key = format!(".claude/{path}");
        let Ok(bytes) = std::fs::read(root.join(".claude").join(path)) else {
            return OnDisk::Missing;
        };
        match recorded.get(&key) {
            Some(hash) if *hash == sha256_hex(&bytes) => OnDisk::Pristine,
            _ => OnDisk::Other,
        }
    };
    let plan = removable_paths(
        &root.join(".claude"),
        &ctx.manifest,
        &ctx.installed.non_base(),
        requested,
        &on_disk,
    )
    .map_err(|e| Failure::failed(e.to_string()))?;

    let list = requested.join(", ");
    let planned = changes("delete", &plan.deletable);
    let kept: Vec<String> = if plan.preserved.is_empty() {
        vec![]
    } else {
        vec![format!(
            "{} shared/base/modified file(s) preserved.",
            plan.preserved.len()
        )]
    };

    if plan.deletable.is_empty() {
        let note = format!("Nothing to remove for {list} (no pristine pack-exclusive files).");
        if args.json {
            envelope::print(
                "pack remove",
                args.dry_run,
                &[],
                &[],
                &[vec![note], kept].concat(),
            );
        } else {
            println!("{note}");
            kept.iter().for_each(|k| println!("{k}"));
        }
        return Ok(OK);
    }

    // A dry run stops before the confirmation: nothing is going to be deleted.
    if args.dry_run {
        let note = format!(
            "Dry-run: would delete {} file(s) for {list} — nothing was written.",
            plan.deletable.len()
        );
        if args.json {
            envelope::print(
                "pack remove",
                true,
                &planned,
                &[],
                &[vec![note], kept].concat(),
            );
        } else {
            planned
                .iter()
                .for_each(|c| println!("  would delete {}", c.path));
            println!("{note}");
            kept.iter().for_each(|k| println!("{k}"));
        }
        return Ok(OK);
    }

    if !args.yes
        && !confirmed(&format!(
            "Delete {} file(s) for {list}?",
            plan.deletable.len()
        ))?
    {
        if args.json {
            envelope::print(
                "pack remove",
                false,
                &planned,
                &[],
                &["Cancelled.".to_owned()],
            );
        } else {
            println!("Cancelled.");
        }
        return Ok(OK);
    }

    let e = emitter_for(Runtime::ClaudeCode)?;
    let mut index = ctx
        .installed
        .index
        .clone()
        .ok_or_else(|| Failure::failed("no Claude Code install to remove packs from"))?;
    index.packs = stored(&next);
    let mut ops = Plan::default();
    let mut hashes = BTreeMap::new();
    for path in &plan.deletable {
        let rel = RelPath::new(&format!(".claude/{path}"))?;
        // The file is byte-identical to what was recorded, which is the kit's
        // own hash for it: the executor's corroboration for a removal.
        let hash = recorded.get(rel.as_str()).ok_or_else(|| {
            Failure::failed(format!("{rel} is deletable but has no recorded hash"))
        })?;
        hashes.insert(rel.to_string(), hash.clone());
        ops.ops.push(Op::RemoveFile { path: rel });
    }
    let report = execute(
        &ops,
        &ctx.place.exec_scope(e),
        &mut index,
        &|p| hashes.get(p.as_str()).cloned(),
        ExecOptions::default(),
    )?;
    let deleted: Vec<String> = report
        .removed
        .iter()
        .filter_map(|p| p.strip_prefix(".claude/").map(str::to_owned))
        .collect();
    let summary = format!("Removed {list}: {} file(s) deleted.", deleted.len());
    if args.json {
        let notes = [vec![summary], kept].concat();
        envelope::print(
            "pack remove",
            false,
            &planned,
            &changes("delete", &deleted),
            &notes,
        );
        return Ok(OK);
    }
    planned.iter().for_each(|c| println!("  delete {}", c.path));
    println!("{summary}");
    kept.iter().for_each(|k| println!("{k}"));
    Ok(OK)
}

/// Ask before deleting. No terminal means `--yes` is the only way to say so,
/// and that refusal names it; a cancelled prompt is a "no".
fn confirmed(message: &str) -> Result<bool, Failure> {
    match default_prompt().confirm(&Ask::new(message, Flag::new("--yes")), false) {
        Ok(answer) => Ok(answer),
        Err(PromptError::Cancelled { .. }) => Ok(false),
        Err(other) => Err(other.into()),
    }
}
