//! `backups list` / `backups restore <id>` — read and undo the snapshots the
//! mutating commands take. A snapshot nobody can list or restore is a
//! directory, not a safety net.
//!
//! A restore overwrites what is on disk, so with no terminal and no `--yes` it
//! prints the plan `--dry-run` would print and exits 3. With a terminal it
//! restores WITHOUT asking: the npm CLI's handler never prompts, and this port
//! keeps that. Plain text throughout; colour is not ported.
use std::io::IsTerminal;
use std::path::Path;

use clap::Args;
use mewkit_core::project_root::resolve_project_root;
use mewkit_core::snapshot::{
    BACKUPS_REL, Manifest, list_snapshots, outside_path, plain_copies, plan_restore, read_snapshot,
    restore_snapshot,
};
use serde_json::{Value, json};

use crate::failure::{Failure, USAGE};

/// "A destructive command was asked for and could not confirm."
const NEEDS_CONFIRMATION: u8 = 3;

#[derive(Args, Debug)]
pub struct BackupsArgs {
    /// `list` (default) or `restore`.
    pub subcommand: Option<String>,
    /// `restore`: the snapshot id.
    pub id: Option<String>,
    /// Print JSON instead of text.
    #[arg(long)]
    pub json: bool,
    /// `restore`: print the plan and change nothing.
    #[arg(long)]
    pub dry_run: bool,
    /// `restore`: proceed without a terminal to confirm in.
    #[arg(long)]
    pub yes: bool,
}

fn pretty(value: &Value) -> String {
    serde_json::to_string_pretty(value).unwrap_or_default()
}

pub fn run(args: &BackupsArgs) -> Result<u8, Failure> {
    let sub = args.subcommand.as_deref();
    if let Some(sub) = sub.filter(|s| !["list", "restore"].contains(s)) {
        eprintln!("Unknown `backups` subcommand: {sub}");
        eprintln!("Valid subcommands: list, restore");
        eprintln!("Run `mewkit backups --help` for usage.");
        return Ok(USAGE);
    }
    // Snapshots live under the project root; without one there is nothing to list.
    let cwd = std::env::current_dir()?;
    let root = resolve_project_root(&cwd).unwrap_or(cwd);
    match sub {
        Some("restore") => restore(&root, args),
        _ => list(&root, args),
    }
}

fn list(root: &Path, args: &BackupsArgs) -> Result<u8, Failure> {
    let snapshots = list_snapshots(root);
    let copies = plain_copies(root);
    if args.json {
        let rows: Vec<Value> = snapshots
            .iter()
            .map(|s| json!({"id": s.id, "createdAt": s.created_at, "command": s.command, "fileCount": s.file_count}))
            .collect();
        let mut doc = json!({"snapshots": rows});
        if !copies.is_empty() {
            doc["copies"] = json!(copies);
        }
        println!("{}", pretty(&doc));
        return Ok(0);
    }
    if !copies.is_empty() {
        println!(
            "{} plain copy(ies) taken by mewkit-next init, upgrade or uninstall: {}",
            copies.len(),
            copies.join(", ")
        );
        println!(
            "  Not restorable with `backups restore`; copy files back from {BACKUPS_REL}/<id>/ by hand."
        );
    }
    if snapshots.is_empty() {
        if copies.is_empty() {
            println!("No snapshots. One is written before each init, upgrade and uninstall.");
        }
        return Ok(0);
    }
    println!("{} snapshot(s)", snapshots.len());
    for s in &snapshots {
        println!(
            "  {}  {}  {}  {} file(s)",
            s.id,
            s.created_at,
            s.command,
            count_text(&s.file_count)
        );
    }
    println!(
        "\nRestore one with `mewkit backups restore <id>` — the restore is itself snapshotted."
    );
    Ok(0)
}

fn count_text(count: &Value) -> String {
    match count {
        Value::String(s) => s.clone(),
        Value::Null => "undefined".into(),
        other => other.to_string(),
    }
}

fn restore(root: &Path, args: &BackupsArgs) -> Result<u8, Failure> {
    let available: Vec<String> = list_snapshots(root).into_iter().map(|s| s.id).collect();
    let Some(id) = args.id.as_deref().filter(|i| !i.trim().is_empty()) else {
        eprintln!("backups restore needs a snapshot id.");
        eprintln!(
            "Available: {}",
            if available.is_empty() {
                "none".into()
            } else {
                available.join(", ")
            }
        );
        return Ok(1);
    };
    let Some(manifest) = read_snapshot(root, id) else {
        let message = if available.is_empty() {
            format!(
                "No snapshot named {id}, and this project has none. A snapshot is written by init, upgrade and uninstall."
            )
        } else {
            format!(
                "No snapshot named {id}. Available: {}",
                available.join(", ")
            )
        };
        if args.json {
            println!(
                "{}",
                pretty(&json!({"ok": false, "id": id, "error": message, "available": available}))
            );
        } else {
            eprintln!("{message}");
            eprintln!("Run `mewkit backups list` to see what this project has.");
        }
        return Ok(1);
    };
    if let Some(path) = outside_path(&manifest) {
        let message = format!(
            "Snapshot {id} names a path outside the project ({path}); nothing was restored."
        );
        if args.json {
            println!(
                "{}",
                pretty(&json!({"ok": false, "id": id, "error": message}))
            );
        } else {
            eprintln!("{message}");
        }
        return Ok(1);
    }

    // stdout, not the prompt layer's stdin+stderr probe: this is the npm CLI's
    // test for a blind restore, and the two must refuse the same invocations.
    let interactive = std::io::stdout().is_terminal();
    let blind = !args.dry_run && !args.yes && !interactive;
    if args.dry_run || blind {
        return preview(root, id, &manifest, args, blind);
    }
    let result = restore_snapshot(root, id, &manifest)?;
    if args.json {
        let restored: Vec<Value> = result
            .restored
            .iter()
            .map(|r| json!({"path": r.path, "checksum": r.checksum}))
            .collect();
        println!(
            "{}",
            pretty(
                &json!({"ok": true, "id": id, "restored": restored, "unchanged": result.unchanged, "undoId": result.undo_id})
            )
        );
        return Ok(0);
    }
    println!("Restored {} file(s) from {id}", result.restored.len());
    for r in &result.restored {
        println!("  restored {}", r.path);
    }
    if !result.unchanged.is_empty() {
        println!("  {} already identical", result.unchanged.len());
    }
    if let Some(undo) = &result.undo_id {
        println!("\nThe pre-restore state is snapshot {undo} — this restore is itself undoable.");
    }
    Ok(0)
}

/// The plan a restore would carry out; also what a session that cannot confirm is shown.
fn preview(
    root: &Path,
    id: &str,
    manifest: &Manifest,
    args: &BackupsArgs,
    blind: bool,
) -> Result<u8, Failure> {
    let (write, unchanged) = plan_restore(root, manifest);
    if blind && !args.json {
        eprintln!(
            "backups restore can overwrite or remove files and this session has no terminal to confirm in. Nothing was written. Re-run with --yes (or --dry-run to see the plan)."
        );
    }
    if args.json {
        println!(
            "{}",
            pretty(
                &json!({"ok": true, "dryRun": true, "needsConfirmation": blind, "id": id, "write": write, "unchanged": unchanged})
            )
        );
    } else {
        println!("Would restore {} file(s) from {id}", write.len());
        for p in &write {
            println!("  restore {p}");
        }
        if !unchanged.is_empty() {
            println!("  {} already identical", unchanged.len());
        }
    }
    Ok(if blind { NEEDS_CONFIRMATION } else { 0 })
}
