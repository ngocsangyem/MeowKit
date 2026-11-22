//! `pack add|remove eval`: the opt-in eval pack, which carries files to
//! `.meowkit/eval/` instead of selecting skills.
//!
//! Whether it is installed is read from the ownership index (a file recorded
//! under `.meowkit/eval/`), not from the index's pack list: that list names the
//! skill packs of a partial install, and an empty one means a full install,
//! which the eval pack must not turn into a partial one.
use std::collections::BTreeMap;

use mewkit_adapters::contract::{Op, Plan, RelPath, Runtime, written_hashes};
use mewkit_adapters::eval_pack::{self, INSTALL_DIR};
use mewkit_core::exec::{ExecOptions, execute};
use mewkit_core::fsx::sha256_hex;

use super::add::kit_for;
use super::envelope::{self, Change};
use super::{Context, PackArgs};
use crate::commands::emitter_for;
use crate::failure::{FAILED, Failure, OK};

/// Whether `name` is a file pack this manifest declares and this binary installs.
pub fn is_file_pack(ctx: &Context, name: &str) -> bool {
    name == eval_pack::PACK && ctx.manifest.has_file_pack(name)
}

/// The pack's files the Claude Code index records, with their hashes.
pub fn owned(ctx: &Context) -> BTreeMap<String, String> {
    let prefix = format!("{INSTALL_DIR}/");
    ctx.installed
        .index
        .iter()
        .flat_map(|i| i.paths.iter())
        .filter(|(p, _)| p.starts_with(&prefix))
        .map(|(p, h)| (p.clone(), h.clone()))
        .collect()
}

fn lines(action: &'static str, paths: &[String]) -> Vec<Change> {
    paths
        .iter()
        .map(|p| Change {
            action,
            path: p.clone(),
        })
        .collect()
}

fn report(args: &PackArgs, command: &str, planned: &[Change], applied: &[Change], note: String) {
    if args.json {
        envelope::print(command, args.dry_run, planned, applied, &[note]);
        return;
    }
    let would = if args.dry_run { "would " } else { "" };
    for c in planned {
        println!("  {would}{} {}", c.action, c.path);
    }
    println!("{note}");
}

pub fn add(ctx: &Context, args: &PackArgs) -> Result<u8, Failure> {
    if !owned(ctx).is_empty() {
        report(
            args,
            "pack add",
            &[],
            &[],
            "Already installed: eval — nothing to do.".into(),
        );
        return Ok(OK);
    }
    let kit = kit_for(ctx, args)?;
    let Some(ops) = eval_pack::ops(&kit.dir)? else {
        eprintln!("Kit v{} does not carry the eval pack.", kit.version);
        return Ok(FAILED);
    };
    let plan = Plan {
        ops,
        ..Plan::default()
    };
    let hashes = written_hashes(&plan);
    let paths: Vec<String> = hashes.keys().cloned().collect();
    let planned = lines("create", &paths);
    if args.dry_run {
        let note = format!(
            "Dry-run: would add eval — {} file(s) to {INSTALL_DIR}/, nothing written.",
            paths.len()
        );
        report(args, "pack add", &planned, &[], note);
        return Ok(OK);
    }
    let e = emitter_for(Runtime::ClaudeCode)?;
    let mut index = ctx
        .installed
        .index
        .clone()
        .ok_or_else(|| Failure::failed("no Claude Code install to add packs to"))?;
    let done = execute(
        &plan,
        &ctx.place.exec_scope(e),
        &mut index,
        &|p| hashes.get(p.as_str()).cloned(),
        ExecOptions::default(),
    )?;
    for (path, why) in &done.preserved {
        eprintln!("note: kept {path}: {why}");
    }
    let note = format!(
        "Added eval: {} file(s) written to {INSTALL_DIR}/.",
        done.written.len()
    );
    report(args, "pack add", &planned, &planned, note);
    Ok(OK)
}

pub fn remove(ctx: &Context, args: &PackArgs) -> Result<u8, Failure> {
    let owned = owned(ctx);
    let root = &ctx.place.scope.root;
    // Only a file still holding what the kit wrote is removed; an edited one is
    // the user's now and stays.
    let (deletable, kept): (Vec<String>, Vec<String>) = owned.keys().cloned().partition(|p| {
        std::fs::read(root.join(p)).is_ok_and(|bytes| owned.get(p) == Some(&sha256_hex(&bytes)))
    });
    let kept_note =
        (!kept.is_empty()).then(|| format!("{} modified file(s) preserved.", kept.len()));
    if deletable.is_empty() {
        let note = "Nothing to remove for eval (no pristine pack files).".to_owned();
        report(args, "pack remove", &[], &[], note);
        kept_note.iter().for_each(|k| eprintln!("{k}"));
        return Ok(OK);
    }
    let planned = lines("delete", &deletable);
    if args.dry_run {
        let note = format!(
            "Dry-run: would delete {} file(s) for eval — nothing was written.",
            deletable.len()
        );
        report(args, "pack remove", &planned, &[], note);
        return Ok(OK);
    }
    if !args.yes
        && !super::remove::confirmed(&format!("Delete {} file(s) for eval?", deletable.len()))?
    {
        report(args, "pack remove", &planned, &[], "Cancelled.".into());
        return Ok(OK);
    }
    let e = emitter_for(Runtime::ClaudeCode)?;
    let mut index = ctx
        .installed
        .index
        .clone()
        .ok_or_else(|| Failure::failed("no Claude Code install to remove packs from"))?;
    let mut plan = Plan::default();
    for path in &deletable {
        plan.ops.push(Op::RemoveFile {
            path: RelPath::new(path)?,
        });
    }
    let done = execute(
        &plan,
        &ctx.place.exec_scope(e),
        &mut index,
        &|p| owned.get(p.as_str()).cloned(),
        ExecOptions::default(),
    )?;
    let removed: Vec<String> = done.removed.iter().map(|p| p.to_string()).collect();
    let note = format!("Removed eval: {} file(s) deleted.", removed.len());
    report(
        args,
        "pack remove",
        &planned,
        &lines("delete", &removed),
        note,
    );
    kept_note.iter().for_each(|k| eprintln!("{k}"));
    Ok(OK)
}
