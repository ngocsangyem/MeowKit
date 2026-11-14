//! `mewkit providers`: what each runtime gets from the kit at this scope —
//! files, skills actually projected, hooks, and what it cannot carry.
//!
//! `--lifecycle` switches to the capability-adapter view the npm CLI shares
//! (see `lifecycle`). Without it, this verb reports what the KIT PROJECTS per
//! runtime, and a positional `<provider>` is the same as `--target <provider>`.
//! The npm CLI's default view is a provider support matrix built by its
//! retired migrate layer; that view is not ported, on purpose, because this
//! verb was designed to report the projection rather than a support claim.
mod lifecycle;
use std::collections::BTreeSet;

use clap::Args;
use mewkit_adapters::contract::{Kit, Op, Plan};
use serde_json::{Value, json};

use super::{emitter_for, parse_targets, prepare};
use crate::failure::{Failure, OK};
use crate::kit_args::KitArgs;
use crate::place::Place;

#[derive(Args, Debug)]
pub struct ProvidersArgs {
    /// One runtime to show; the same as `--target <provider>`.
    pub provider: Option<String>,
    /// Show the capability-adapter view: the lifecycle-event matrix, or one
    /// provider's adapter detail.
    #[arg(long)]
    pub lifecycle: bool,
    /// Runtimes to show (comma-separated); default: all.
    #[arg(long, value_name = "TARGETS")]
    pub target: Vec<String>,
    /// Show the global (home directory) projection instead of this project's.
    #[arg(long)]
    pub global: bool,
    /// Print one JSON document instead of text.
    #[arg(long)]
    pub json: bool,
    /// The kit to project; default: the newest cached kit, else the latest
    /// release (a downloaded kit is kept in the cache).
    #[command(flatten)]
    pub kit: KitArgs,
}

pub fn run(args: &ProvidersArgs) -> Result<u8, Failure> {
    if args.lifecycle {
        return lifecycle::run(args.provider.as_deref(), args.json);
    }
    let place = Place::new(args.global)?;
    let mut wanted = args.target.clone();
    wanted.extend(args.provider.clone());
    let targets = if wanted.is_empty() {
        parse_targets(&["all".into()])?
    } else {
        parse_targets(&wanted)?
    };
    let kit = resolve(&args.kit, &place)?;
    let mut rows = Vec::new();
    for runtime in targets {
        let e = emitter_for(runtime)?;
        // An installed runtime is shown with the packs it was installed with.
        let packs = place.index(runtime)?.map(|i| i.packs).unwrap_or_default();
        let plan = prepare(&place, e, &kit, &packs)?;
        rows.push(row(runtime.name(), place.label(), &kit, &packs, &plan));
    }
    if args.json {
        println!(
            "{}",
            serde_json::to_string_pretty(&rows).unwrap_or_default()
        );
    } else {
        for r in &rows {
            print_human(r);
        }
    }
    Ok(OK)
}

/// The kit the flags name; with none, the newest cached kit, then the network.
/// Nothing installed changes, but a kit fetched here is kept in the cache,
/// as `upgrade --dry-run` keeps it.
fn resolve(flags: &KitArgs, place: &Place) -> Result<Kit, Failure> {
    let named = flags.kit_version.is_some()
        || flags.kit_archive.is_some()
        || flags.kit_dir.is_some()
        || flags.offline
        || flags.beta;
    if !named {
        let cached = KitArgs {
            offline: true,
            allow_unverified_kit: flags.allow_unverified_kit,
            ..KitArgs::default()
        };
        if let Ok(kit) = cached.resolve(place) {
            return Ok(kit);
        }
    }
    flags.resolve(place)
}

fn row(target: &str, scope: &str, kit: &Kit, packs: &[String], plan: &Plan) -> Value {
    let mut files = 0;
    let mut skills = BTreeSet::new();
    let mut hooks = 0;
    let mut config = 0;
    for op in &plan.ops {
        match op {
            Op::WriteFile { path, .. } => {
                files += 1;
                if let Some(name) = skill_of(path.as_str()) {
                    skills.insert(name.to_owned());
                }
            }
            Op::MergeHooks { handlers, .. } => hooks += handlers.len(),
            Op::MergeBlock { .. } | Op::MergeEntries { .. } => config += 1,
            _ => {}
        }
    }
    json!({
        "target": target,
        "scope": scope,
        "kitVersion": kit.version,
        "packs": packs,
        "files": files,
        "skills": skills.len(),
        "hookHandlers": hooks,
        "configMerges": config,
        "unsupported": plan.unsupported,
        "droppedHooks": plan.dropped_hooks,
        "narrowedHooks": plan.narrowed_hooks,
        "notices": plan.notices,
    })
}

/// `…/skills/<name>/…` → `<name>`.
fn skill_of(path: &str) -> Option<&str> {
    let mut parts = path.split('/');
    parts.find(|p| *p == "skills")?;
    let name = parts.next()?;
    parts.next().map(|_| name)
}

fn print_human(r: &Value) {
    let s = |v: &Value| v.as_str().map_or_else(|| v.to_string(), str::to_owned);
    let packs = r["packs"].as_array().filter(|p| !p.is_empty()).map_or_else(
        || "all packs".to_owned(),
        |p| p.iter().map(s).collect::<Vec<_>>().join(","),
    );
    println!(
        "{} ({}), kit {}, {packs}: {} files, {} skills, {} hook handlers, {} config merges",
        s(&r["target"]),
        s(&r["scope"]),
        s(&r["kitVersion"]),
        r["files"],
        r["skills"],
        r["hookHandlers"],
        r["configMerges"]
    );
    for (label, key) in [
        ("unsupported", "unsupported"),
        ("hook left out", "droppedHooks"),
        ("hook narrowed", "narrowedHooks"),
        ("note", "notices"),
    ] {
        for item in r[key].as_array().into_iter().flatten() {
            println!("  {label}: {}", s(item));
        }
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn skill_names_come_from_the_segment_after_skills() {
        use super::skill_of;
        assert_eq!(skill_of(".agents/skills/mk-plan/SKILL.md"), Some("mk-plan"));
        assert_eq!(skill_of(".claude/skills/mk-x/refs/a.md"), Some("mk-x"));
        assert_eq!(skill_of(".claude/skills/README.md"), None);
        assert_eq!(skill_of(".codex/agents/a.toml"), None);
    }
}
