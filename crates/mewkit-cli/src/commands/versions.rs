//! `mewkit-next versions`: which kits are installed, cached and available,
//! and which kit contract this binary accepts.
use clap::Args;
use mewkit_adapters::contract::Runtime;
use mewkit_core::kit::http::UreqHttp;
use mewkit_core::kit::{self, contract};
use serde_json::{Value, json};

use crate::failure::{Failure, OK};
use crate::place::Place;

#[derive(Args, Debug)]
pub struct VersionsArgs {
    /// List the cache of your home directory instead of this project's.
    #[arg(long)]
    pub global: bool,
    /// Do not ask GitHub for the kits that can be installed.
    #[arg(long)]
    pub offline: bool,
    /// Include prereleases among the available kits.
    #[arg(long)]
    pub beta: bool,
    /// Print one JSON document instead of text.
    #[arg(long)]
    pub json: bool,
}

pub fn run(args: &VersionsArgs) -> Result<u8, Failure> {
    let place = Place::new(args.global)?;
    let mut installed = Vec::new();
    let mut notes = Vec::new();
    // Installs at both scopes: the other one is shown when it resolves.
    for p in std::iter::once(Place::new(args.global)?).chain(place.other()) {
        for r in Runtime::ALL {
            let index = match p.index(r) {
                Ok(i) => i,
                Err(e) => {
                    notes.push(format!("{} ({}): {}", r.name(), p.label(), e.message));
                    continue;
                }
            };
            if let Some(index) = index {
                installed.push(json!({
                    "target": r.name(),
                    "scope": p.label(),
                    "kitVersion": index.kit_version,
                    "origin": index.origin,
                    "packs": index.packs,
                }));
            }
        }
    }
    let cached: Vec<_> = kit::cached_kits(&place.cache_dir())
        .into_iter()
        .map(|e| {
            json!({
                "version": e.meta.version,
                "origin": e.meta.origin,
                "kitContract": e.contract.map(|c| c.kit_contract),
            })
        })
        .collect();
    let (available, note) = if args.offline {
        (None, None)
    } else {
        match kit::list_available(&UreqHttp::default(), args.beta) {
            Ok(list) => (Some(list), None),
            Err(e) => (None, Some(format!("available kits unknown: {e}"))),
        }
    };
    let available: Option<Vec<Value>> = available.map(|list| {
        list.into_iter()
            .map(|l| json!({"version": l.version, "prerelease": l.prerelease, "verified": l.verified}))
            .collect()
    });
    let range = contract::SUPPORTED;
    let doc = json!({
        "binary": mewkit_core::VERSION,
        "kitContract": {"min": range.start(), "max": range.end()},
        "installed": installed,
        "cached": {"scope": place.label(), "kits": cached},
        "available": available,
        "notes": notes.into_iter().chain(note).collect::<Vec<_>>(),
    });
    if args.json {
        println!("{}", serde_json::to_string_pretty(&doc).unwrap_or_default());
    } else {
        print_human(&doc);
    }
    Ok(OK)
}

fn print_human(doc: &Value) {
    let s = |v: &Value| v.as_str().map_or_else(|| v.to_string(), str::to_owned);
    println!(
        "mewkit-next {} (kit contract {}..={})",
        s(&doc["binary"]),
        doc["kitContract"]["min"],
        doc["kitContract"]["max"]
    );
    println!("installed:");
    let installed = doc["installed"].as_array().map_or(&[][..], Vec::as_slice);
    if installed.is_empty() {
        println!("  nothing");
    }
    for i in installed {
        println!(
            "  {} ({}): kit {} [{}]",
            s(&i["target"]),
            s(&i["scope"]),
            s(&i["kitVersion"]),
            s(&i["origin"])
        );
    }
    println!("cached ({}):", s(&doc["cached"]["scope"]));
    let kits = doc["cached"]["kits"]
        .as_array()
        .map_or(&[][..], Vec::as_slice);
    if kits.is_empty() {
        println!("  nothing");
    }
    for k in kits {
        println!("  {} [{}]", s(&k["version"]), s(&k["origin"]));
    }
    match doc["available"].as_array() {
        Some(list) => {
            println!("available:");
            for l in list {
                let mut tags = Vec::new();
                if l["prerelease"] == true {
                    tags.push("prerelease");
                }
                if l["verified"] != true {
                    tags.push("no checksum: needs --allow-unverified-kit");
                }
                let tags = if tags.is_empty() {
                    String::new()
                } else {
                    format!(" ({})", tags.join(", "))
                };
                println!("  {}{tags}", s(&l["version"]));
            }
        }
        None => println!("available: not checked"),
    }
    for n in doc["notes"].as_array().into_iter().flatten() {
        println!("note: {}", s(n));
    }
}
