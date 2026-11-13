//! `pack list`: every pack the manifest has, and whether it is installed.
use mewkit_core::validate::{BASE_PACK, resolve_packs};
use serde_json::json;

use super::{Context, PackArgs};
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

    if args.json {
        let doc: Vec<_> = rows
            .iter()
            .map(|(pack, installed, members)| {
                json!({"pack": pack, "installed": installed, "members": members})
            })
            .collect();
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
    Ok(OK)
}
