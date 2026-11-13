//! `trace` — on-demand, advisory recall over the append trace log: `score`,
//! `audit`, `propose [--commit]`, and `--friction "<note>"` to record one.
//!
//! Every reading path exits 0: this command reports, it never gates. Only a
//! failed friction WRITE is an error, as it is in the npm CLI. The analysis is
//! [`mewkit_core::trace_analysis`]; this file finds the project and prints.
use std::io::Write;
use std::path::{Path, PathBuf};

use clap::Args;
use mewkit_core::js_value::js_number_text;
use mewkit_core::time_utc::{now_millis, utc_date};
use mewkit_core::trace::{TraceRecord, append_trace_record, trace_log_path};
use mewkit_core::trace_analysis::{
    Proposal, audit_traces, parse_trace_log, propose_improvements, redact_friction_note,
    score_by_run, score_by_run_json, score_tier,
};
use serde_json::{Map, Value};

use crate::failure::{Failure, OK, USAGE};

const STALE_DAYS: i64 = 30;

#[derive(Args, Debug)]
pub struct TraceArgs {
    /// `score`, `audit` or `propose`; none prints the usage.
    pub subcommand: Option<String>,
    /// Run id: filters `score`, attributes `--friction`.
    #[arg(long)]
    pub id: Option<String>,
    /// Record a friction note instead of reading the log.
    #[arg(long)]
    pub friction: Option<String>,
    /// Attribute the friction note to one responsibility.
    #[arg(long)]
    pub responsibility: Option<String>,
    /// `propose`: append the items to the advisory backlog.
    #[arg(long)]
    pub commit: bool,
    /// Print JSON instead of text.
    #[arg(long)]
    pub json: bool,
}

const SUBCOMMANDS: [&str; 3] = ["score", "audit", "propose"];

pub fn run(args: &TraceArgs) -> Result<u8, Failure> {
    // Classified before anything runs, the way the npm CLI's dispatcher does:
    // a mistyped sub-verb is an invocation error (exit 2), even beside
    // `--friction`, never a silent fall-through to the usage text.
    if let Some(sub) = args
        .subcommand
        .as_deref()
        .filter(|s| !SUBCOMMANDS.contains(s))
    {
        eprintln!("Unknown `trace` subcommand: {sub}");
        eprintln!("Valid subcommands: {}", SUBCOMMANDS.join(", "));
        eprintln!("Run `mewkit trace --help` for usage.");
        return Ok(USAGE);
    }
    let Some(claude_dir) = find_claude_dir(&std::env::current_dir()?) else {
        eprintln!("Could not find .claude/ directory.");
        return Ok(OK);
    };
    let project_root = claude_dir.parent().unwrap_or(&claude_dir).to_path_buf();

    if let Some(note) = args.friction.as_deref().filter(|f| !f.is_empty()) {
        return record_friction(&project_root, args, note);
    }

    let log = trace_log_path(&project_root);
    let records = if log.exists() {
        let bytes = std::fs::read(&log)?;
        parse_trace_log(&String::from_utf8_lossy(&bytes))
    } else {
        Vec::new()
    };
    match args.subcommand.as_deref() {
        Some("score") => score(&records, args),
        Some("audit") => audit(&records, args),
        Some("propose") => propose(&project_root, &records, args)?,
        _ => usage(),
    }
    Ok(OK)
}

/// The nearest `.claude/` directory, walking up from `start`.
fn find_claude_dir(start: &Path) -> Option<PathBuf> {
    start
        .ancestors()
        .map(|dir| dir.join(".claude"))
        .find(|candidate| candidate.is_dir())
}

fn record_friction(project_root: &Path, args: &TraceArgs, note: &str) -> Result<u8, Failure> {
    let message = redact_friction_note(note);
    let mut data = Map::new();
    data.insert("message".into(), message.clone().into());
    let responsibility = args.responsibility.as_deref().filter(|r| !r.is_empty());
    if let Some(r) = responsibility {
        data.insert("responsibility".into(), r.into());
    }
    let record = TraceRecord {
        event: "friction".into(),
        data,
        run_id: Some(args.id.clone().unwrap_or_default()),
        ..TraceRecord::default()
    };
    append_trace_record(project_root, &record).map_err(|e| Failure::failed(e.to_string()))?;
    let tag = responsibility
        .map(|r| format!("[{r}] "))
        .unwrap_or_default();
    println!("Recorded friction. {tag}{message}");
    Ok(OK)
}

fn pretty(value: &Value) -> String {
    serde_json::to_string_pretty(value).unwrap_or_default()
}

fn score(records: &[Value], args: &TraceArgs) {
    if let Some(id) = args.id.as_deref().filter(|id| !id.is_empty()) {
        let lane: Vec<&Value> = records
            .iter()
            .filter(|r| r.get("run_id").and_then(Value::as_str) == Some(id))
            .collect();
        let s = score_tier(&lane);
        if args.json {
            let mut out = Map::new();
            out.insert("run".into(), id.into());
            out.extend(s.to_json());
            println!("{}", pretty(&Value::Object(out)));
            return;
        }
        println!("Trace score — run {id}");
        println!(
            "  tier={}  events={}  types={}  verified={}",
            s.tier, s.events, s.types, s.has_verification
        );
        return;
    }
    let lanes = score_by_run(records);
    if args.json {
        println!("{}", pretty(&score_by_run_json(&lanes)));
        return;
    }
    println!("Trace score — by lane (run)");
    if lanes.is_empty() {
        println!("  no trace records yet.");
    }
    for (id, s) in &lanes {
        println!(
            "  {id}  tier={}  events={}  types={}",
            s.tier, s.events, s.types
        );
    }
}

fn audit(records: &[Value], args: &TraceArgs) {
    let audit = audit_traces(records, now_millis(), STALE_DAYS);
    if args.json {
        println!("{}", pretty(&audit.to_json()));
        return;
    }
    println!("Trace audit — entropy & drift");
    println!(
        "  records={}  entropy={} bits  orphaned={}  stale={}  unverified-runs={}",
        audit.total,
        js_number_text(audit.entropy),
        audit.orphaned,
        audit.stale,
        audit.unverified_runs
    );
    if audit.repeated_friction.is_empty() {
        println!("  No repeated friction.");
        return;
    }
    println!("  Repeated friction (≥2):");
    for g in &audit.repeated_friction {
        let resp = g
            .responsibility
            .as_ref()
            .map(|r| format!(" [{r}]"))
            .unwrap_or_default();
        println!("    ×{} {}{resp}", g.count, g.message);
    }
}

/// `(evidence ×N, responsibility)` — the same suffix on screen and in the backlog.
fn evidence(item: &Proposal) -> String {
    let resp = item
        .responsibility
        .as_ref()
        .map(|r| format!(", {r}"))
        .unwrap_or_default();
    format!("(evidence ×{}{resp})", item.evidence_count)
}

fn propose(project_root: &Path, records: &[Value], args: &TraceArgs) -> Result<(), Failure> {
    let now = now_millis();
    let items = propose_improvements(&audit_traces(records, now, STALE_DAYS));
    if args.json {
        let list: Vec<Value> = items.iter().map(Proposal::to_json).collect();
        println!("{}", pretty(&Value::Array(list)));
        return Ok(());
    }
    let dry = if args.commit { "" } else { " (dry-run)" };
    println!("Trace propose — {} advisory item(s){dry}", items.len());
    for item in &items {
        println!("  [{}] {} {}", item.kind, item.title, evidence(item));
    }
    if items.is_empty() {
        println!("  Nothing to propose — no repeated friction or drift.");
    }
    if !args.commit {
        println!("\nRe-run with --commit to append these to the advisory backlog.");
        return Ok(());
    }
    if items.is_empty() {
        return Ok(());
    }
    // The advisory backlog, NOT the committed memory store: friction text is
    // arbitrary and would trip the memory lint as "team knowledge".
    let backlog = project_root
        .join("tasks")
        .join("backlog")
        .join("improvement-backlog.md");
    let mut text = format!(
        "\n## {} — advisory proposals (trace propose)",
        utc_date(now)
    );
    for item in &items {
        text.push_str(&format!(
            "\n- [{}] {} {}",
            item.kind,
            item.title,
            evidence(item)
        ));
    }
    text.push('\n');
    std::fs::create_dir_all(backlog.parent().unwrap_or(project_root))?;
    std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&backlog)?
        .write_all(text.as_bytes())?;
    println!(
        "\nAppended {} item(s) to {}",
        items.len(),
        backlog.display()
    );
    Ok(())
}

fn usage() {
    println!("mewkit trace — on-demand, advisory trace recall");
    println!("  trace score [--id <run>]      trace-quality tier per lane");
    println!(
        "  trace audit                   entropy + drift (orphaned/stale/unverified/friction)"
    );
    println!("  trace propose [--commit]      group repeated friction + drift into advisory items");
    println!(
        "  trace --friction \"<note>\" [--id <run>] [--responsibility <r>]   record friction (no hook needed)"
    );
}
