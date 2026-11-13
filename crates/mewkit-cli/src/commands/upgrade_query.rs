//! `upgrade --check` and `upgrade --list`: the installed kit against the
//! published releases. Both only read — no kit is downloaded, cached or
//! installed — so they run with nothing installed here too.
use mewkit_core::kit::Listed;
use mewkit_core::kit::channels::{self, Channels};
use mewkit_core::kit::http::UreqHttp;
use serde_json::{Value, json};

use crate::failure::{Failure, OK};
use crate::place::Place;

/// How many releases `--list` shows, newest first.
const LIST_LIMIT: usize = 10;

/// Which question was asked.
#[derive(Clone, Copy)]
pub enum Query {
    Check,
    List,
}

/// One installed runtime and the kit version it was installed from.
struct Installed {
    target: &'static str,
    kit: String,
}

pub fn run(
    place: &Place,
    query: Query,
    beta: bool,
    offline: bool,
    json: bool,
) -> Result<u8, Failure> {
    let installed = installed(place)?;
    let channels = if offline {
        channels::offline(&place.cache_dir())
    } else {
        channels::online(&UreqHttp::default())
            .map_err(|e| Failure::failed(format!("could not list kit releases: {e}")))?
    };
    let doc = match query {
        Query::Check => check_doc(place, &installed, &channels, beta),
        Query::List => list_doc(place, &installed, &channels),
    };
    if json {
        println!("{}", serde_json::to_string_pretty(&doc).unwrap_or_default());
    } else {
        print_human(query, &doc, offline);
    }
    Ok(OK)
}

fn installed(place: &Place) -> Result<Vec<Installed>, Failure> {
    let mut out = Vec::new();
    for r in place.installed()? {
        if let Some(index) = place.index(r)? {
            out.push(Installed {
                target: r.name(),
                kit: index.kit_version,
            });
        }
    }
    Ok(out)
}

fn release(l: &Listed) -> Value {
    json!({"version": l.version, "prerelease": l.prerelease, "verified": l.verified})
}

fn check_doc(place: &Place, installed: &[Installed], c: &Channels, beta: bool) -> Value {
    let target = c.target(beta);
    let rows: Vec<Value> = installed
        .iter()
        .map(|i| {
            let update = target
                .filter(|t| t.version != i.kit.trim_start_matches('v'))
                .map(|t| t.version.clone());
            json!({"target": i.target, "kitVersion": i.kit, "update": update})
        })
        .collect();
    json!({
        "scope": place.label(),
        "installed": rows,
        "latestStable": c.stable.as_ref().map(release),
        "latestBeta": c.beta.as_ref().map(release),
        "channel": if beta { "beta" } else { "stable" },
    })
}

fn list_doc(place: &Place, installed: &[Installed], c: &Channels) -> Value {
    let releases: Vec<Value> = c
        .releases
        .iter()
        .take(LIST_LIMIT)
        .map(|l| {
            let mut r = release(l);
            let on: Vec<&str> = installed
                .iter()
                .filter(|i| i.kit.trim_start_matches('v') == l.version)
                .map(|i| i.target)
                .collect();
            r["installedBy"] = json!(on);
            r
        })
        .collect();
    json!({
        "scope": place.label(),
        "installed": installed.iter().map(|i| json!({"target": i.target, "kitVersion": i.kit})).collect::<Vec<_>>(),
        "stable": c.stable.as_ref().map(|l| l.version.clone()),
        "beta": c.beta.as_ref().map(|l| l.version.clone()),
        "releases": releases,
    })
}

fn print_human(query: Query, doc: &Value, offline: bool) {
    let s = |v: &Value| v.as_str().map_or_else(|| "none".to_owned(), str::to_owned);
    let scope = s(&doc["scope"]);
    let rows = doc["installed"].as_array().map_or(&[][..], Vec::as_slice);
    if rows.is_empty() {
        println!("installed ({scope}): nothing");
    }
    for r in rows {
        println!(
            "installed ({scope}): {} kit {}",
            s(&r["target"]),
            s(&r["kitVersion"])
        );
    }
    let source = if offline { " (cached kits only)" } else { "" };
    match query {
        Query::List => {
            println!("channels{source}:");
            println!("  stable: {}", s(&doc["stable"]));
            println!("  beta:   {}", s(&doc["beta"]));
            println!("recent releases:");
            let releases = doc["releases"].as_array().map_or(&[][..], Vec::as_slice);
            if releases.is_empty() {
                println!("  none");
            }
            for r in releases {
                let mut tags = Vec::new();
                if r["prerelease"] == true {
                    tags.push("beta".to_owned());
                }
                for t in r["installedBy"].as_array().into_iter().flatten() {
                    tags.push(format!("installed: {}", s(t)));
                }
                let tags = if tags.is_empty() {
                    String::new()
                } else {
                    format!(" ({})", tags.join(", "))
                };
                println!("  {}{tags}", s(&r["version"]));
            }
        }
        Query::Check => {
            println!(
                "latest stable{source}: {}",
                s(&doc["latestStable"]["version"])
            );
            println!(
                "latest beta{source}:   {}",
                s(&doc["latestBeta"]["version"])
            );
            if doc["latestStable"].is_null() && doc["latestBeta"].is_null() {
                println!("no kit releases found");
                return;
            }
            let pending: Vec<&Value> = rows.iter().filter(|r| !r["update"].is_null()).collect();
            if pending.is_empty() && !rows.is_empty() {
                println!("already up to date ({} channel)", s(&doc["channel"]));
            }
            let flag = if doc["channel"] == "beta" {
                " --beta"
            } else {
                ""
            };
            for r in pending {
                println!(
                    "update available for {}: {} → {}; run `mewkit-next upgrade{flag}`",
                    s(&r["target"]),
                    s(&r["kitVersion"]),
                    s(&r["update"])
                );
            }
        }
    }
}
