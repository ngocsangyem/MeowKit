//! `pack list`: every pack the manifest has, and whether it is installed.
use mewkit_core::validate::{BASE_PACK, resolve_packs};
use serde_json::json;

use mewkit_adapters::eval_pack;

use super::{Context, PackArgs, file_pack};
use crate::failure::{Failure, OK};

pub fn run(ctx: &Context, args: &PackArgs) -> Result<u8, Failure> {
    let claude_dir = ctx.place.scope.root.join(".claude");
    let resolved = resolve_packs(&claude_dir, &ctx.manifest, &ctx.installed.non_base())
        .map_err(|e| Failure::failed(e.to_string()))?;
    let rows: Vec<_> = ctx
        .manifest
        .available_packs()
        .into_iter()
        .map(|name| {
            (
                name,
                ctx.installed.has(name),
                resolved.membership.get(name).map_or(0, |m| m.len()),
            )
        })
        .collect();

    // A file pack is listed only when the manifest declares one, after the
    // skill packs: it is opt-in and never part of a profile.
    let eval = file_pack::is_file_pack(ctx, eval_pack::PACK).then(|| file_pack::owned(ctx).len());
    if args.json {
        let mut doc: Vec<_> = rows
            .iter()
            .map(|(pack, installed, members)| {
                json!({"pack": pack, "installed": installed, "members": members})
            })
            .collect();
        if let Some(n) = eval {
            doc.push(
                json!({"pack": eval_pack::PACK, "installed": n > 0, "members": n, "kind": "files"}),
            );
        }
        println!("{}", serde_json::to_string_pretty(&doc).unwrap_or_default());
        return Ok(OK);
    }
    println!("MeowKit packs");
    println!("{BASE_PACK} is always installed (safety rules, hooks, settings, core commands).");
    println!();
    for (pack, installed, members) in rows {
        let mark = if installed { "installed" } else { "available" };
        let count = if installed {
            format!(" ({members} files)")
        } else {
            String::new()
        };
        println!("  [{mark}] {pack}{count}");
    }
    if let Some(n) = eval {
        let mark = if n > 0 { "installed" } else { "opt-in" };
        let count = if n > 0 {
            format!(" ({n} files)")
        } else {
            String::new()
        };
        println!(
            "  [{mark}] {}{count} — eval cases for `mewkit eval`, in .meowkit/eval/",
            eval_pack::PACK
        );
    }
    Ok(OK)
}
