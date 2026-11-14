//! `capabilities` — read-only inspection of the capability manifest:
//! `list` (default), `explain <id>`, `resolve --intent <text>`, `view`,
//! `bootstrap [--write]` and `projections`.
//!
//! The kit's SessionStart hook tells agents to run
//! `mewkit capabilities resolve --intent "..."`, so `resolve` is the contract
//! that matters. The manifest is on-disk CLI data; it is never injected into
//! a model session.
//!
//! `projections --provider` is accepted and ignored, exactly as the npm CLI
//! does: its catalogue lists the flag but the handler never reads it.
mod probes;
mod render;

use std::path::Path;

use clap::Args;
use mewkit_core::capability::bootstrap::{BOOTSTRAP, BOOTSTRAP_FILENAME, render_view};
use mewkit_core::capability::entry::Entry;
use mewkit_core::capability::manifest::{SourceKind, find_source};
use mewkit_core::capability::projection::{PROJECTION_PROVIDERS, is_projected_provider};
use mewkit_core::capability::resolve::resolve_with_host;
use mewkit_core::time_utc::now_millis;
use mewkit_core::validate::{IssueLevel, validate_capabilities};

use crate::failure::{Failure, OK, USAGE};

#[derive(Args, Debug)]
pub struct CapabilitiesArgs {
    /// `list` (default), `explain`, `resolve`, `view`, `bootstrap` or `projections`.
    pub subcommand: Option<String>,
    /// `explain`: the capability id; `resolve`: the intent, when `--intent` is absent.
    pub target: Option<String>,
    /// Print JSON instead of text.
    #[arg(long)]
    pub json: bool,
    /// `resolve`: the intent to resolve.
    #[arg(long)]
    pub intent: Option<String>,
    /// `resolve`: the host provider (default claude-code); `bootstrap`: the provider to render for.
    #[arg(long)]
    pub provider: Option<String>,
    /// `bootstrap`: write the generated file instead of printing it.
    #[arg(long)]
    pub write: bool,
}

const SUBCOMMANDS: [&str; 6] = [
    "list",
    "explain",
    "resolve",
    "view",
    "bootstrap",
    "projections",
];

/// Print a refusal on stderr and exit 1, as the npm CLI does.
fn refuse(message: &str) -> Result<u8, Failure> {
    eprintln!("{message}");
    Ok(1)
}

fn pretty(value: &serde_json::Value) -> String {
    serde_json::to_string_pretty(value).unwrap_or_default()
}

pub fn run(args: &CapabilitiesArgs) -> Result<u8, Failure> {
    let sub = args.subcommand.as_deref().unwrap_or("list");
    if !SUBCOMMANDS.contains(&sub) {
        eprintln!("Unknown `capabilities` subcommand: {sub}");
        eprintln!("Valid subcommands: {}", SUBCOMMANDS.join(", "));
        eprintln!("Run `mewkit capabilities --help` for usage.");
        return Ok(USAGE);
    }
    let cwd = std::env::current_dir()?;
    match sub {
        "projections" => {
            render::projections(args.json);
            return Ok(OK);
        }
        "bootstrap" => return bootstrap(args, &cwd),
        _ => {}
    }

    let home = std::env::var_os("HOME").map(std::path::PathBuf::from);
    let source = match find_source(&cwd, home.as_deref()) {
        Ok(Some(source)) => source,
        Ok(None) => {
            return refuse(
                "Could not find a capability source. Expected .claude/ or a Codex projection at .codex/capabilities.json. Run `npx mewkit init` or `npx mewkit init --target codex`.",
            );
        }
        Err(message) => return refuse(&message),
    };
    let entries = &source.entries;
    match sub {
        "explain" => explain(entries, args),
        "resolve" => resolve(entries, args, &cwd),
        "view" => {
            println!("{}", render_view(entries));
            Ok(OK)
        }
        _ => list(&source, args),
    }
}

fn explain(entries: &[Entry], args: &CapabilitiesArgs) -> Result<u8, Failure> {
    let Some(target) = args.target.as_deref().filter(|t| !t.is_empty()) else {
        return refuse("`capabilities explain` requires a capability id.");
    };
    let Some(entry) = entries.iter().find(|e| e.id == target) else {
        return refuse(&format!("No capability with id \"{target}\"."));
    };
    if args.json {
        println!("{}", pretty(&entry.to_json()));
    } else {
        render::explain(entry);
    }
    Ok(OK)
}

fn resolve(entries: &[Entry], args: &CapabilitiesArgs, cwd: &Path) -> Result<u8, Failure> {
    let Some(intent) = args
        .intent
        .as_deref()
        .or(args.target.as_deref())
        .filter(|i| !i.is_empty())
    else {
        return refuse(
            "`capabilities resolve` requires an intent (--intent \"…\" or a positional phrase).",
        );
    };
    let provider = args.provider.as_deref().unwrap_or("claude-code");
    let probes = probes::HostProbes {
        root: cwd.to_path_buf(),
    };
    let result = resolve_with_host(entries, intent, provider, &probes);
    if args.json {
        let checked_at = mewkit_core::snapshot::iso_millis(now_millis());
        println!("{}", pretty(&result.to_json(&checked_at)));
    } else {
        render::resolve(&result);
    }
    Ok(OK)
}

fn list(
    source: &mewkit_core::capability::manifest::Source,
    args: &CapabilitiesArgs,
) -> Result<u8, Failure> {
    let entries = &source.entries;
    if args.json {
        let list: Vec<_> = entries.iter().map(Entry::to_json).collect();
        println!(
            "{}",
            pretty(&serde_json::json!({"schemaVersion": "1.0", "entries": list}))
        );
        return Ok(OK);
    }
    println!("MeowKit Capabilities");
    let issues = if source.kind == SourceKind::ClaudeDirectory {
        validate_capabilities(&source.path)
    } else {
        Vec::new()
    };
    let errors: Vec<_> = issues
        .iter()
        .filter(|i| i.level == IssueLevel::Error)
        .collect();
    let warns: Vec<_> = issues
        .iter()
        .filter(|i| i.level == IssueLevel::Warn)
        .collect();
    println!(
        "{} capabilities — {} error(s), {} warning(s)\n",
        entries.len(),
        errors.len(),
        warns.len()
    );

    let mut kinds: Vec<&str> = entries.iter().map(|e| e.kind.as_str()).collect();
    kinds.sort_unstable();
    kinds.dedup();
    for kind in kinds {
        println!("{kind}");
        for e in entries.iter().filter(|e| e.kind == kind) {
            if e.description.is_empty() {
                println!("  {}", e.id);
            } else {
                println!("  {} — {}", e.id, e.description);
            }
        }
        println!();
    }
    for i in &errors {
        println!(
            "  [ERROR] {}: {}",
            i.capability_id.as_deref().unwrap_or("-"),
            i.message
        );
    }
    for i in &warns {
        println!(
            "  [WARN] {}: {}",
            i.capability_id.as_deref().unwrap_or("-"),
            i.message
        );
    }
    Ok(u8::from(!errors.is_empty()))
}

fn bootstrap(args: &CapabilitiesArgs, cwd: &Path) -> Result<u8, Failure> {
    let provider = args.provider.as_deref().unwrap_or("claude-code");
    if !is_projected_provider(provider) {
        let projected: Vec<&str> = PROJECTION_PROVIDERS
            .iter()
            .copied()
            .filter(|p| is_projected_provider(p))
            .collect();
        return refuse(&format!(
            "No bootstrap projection for provider \"{provider}\" (report-only). Projected: {}.",
            projected.join(", ")
        ));
    }
    if !args.write {
        println!("{BOOTSTRAP}");
        return Ok(OK);
    }
    // Regenerates the committed file the SessionStart hook emits.
    let dir = cwd.join(".claude");
    if !dir.is_dir() {
        return refuse("Could not find .claude/ directory to write the bootstrap file.");
    }
    let dest = dir.join(BOOTSTRAP_FILENAME);
    std::fs::write(&dest, format!("{BOOTSTRAP}\n"))?;
    println!(
        "Wrote {}",
        dest.strip_prefix(cwd).unwrap_or(&dest).display()
    );
    Ok(OK)
}
