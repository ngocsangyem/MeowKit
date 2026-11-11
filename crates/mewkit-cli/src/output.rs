//! What a command prints: one block per target, or one JSON document.
use mewkit_adapters::contract::Runtime;
use mewkit_core::report::EmitReport;
use serde_json::{Value, json};

use crate::failure::{KEPT_EDITS, OK, PENDING};

/// One target's outcome.
pub struct Outcome {
    pub runtime: Runtime,
    pub scope: &'static str,
    pub report: EmitReport,
}

impl Outcome {
    fn pending(&self) -> bool {
        !self.report.written.is_empty() || !self.report.removed.is_empty()
    }

    /// An owned file was kept: the user edited it (`--force` overrides), or
    /// the kit that would confirm it as the kit's is not available.
    fn kept_edits(&self) -> bool {
        self.report
            .preserved
            .iter()
            .any(|(_, why)| why.contains("--force") || why.contains("not corroborated"))
    }
}

/// The exit code for a finished command.
pub fn exit_code(outcomes: &[Outcome], dry_run: bool) -> u8 {
    if dry_run && outcomes.iter().any(Outcome::pending) {
        PENDING
    } else if outcomes.iter().any(Outcome::kept_edits) {
        KEPT_EDITS
    } else {
        OK
    }
}

/// A command that found nothing to act on: the message, or `[]` for JSON.
pub fn nothing(message: &str, json: bool) -> u8 {
    if json {
        println!("[]");
    } else {
        println!("{message}");
    }
    OK
}

/// More kept files than this for one reason print as one summary line.
const LIST_LIMIT: usize = 10;

pub fn print(outcomes: &[Outcome], json: bool) {
    if json {
        let doc: Vec<Value> = outcomes.iter().map(to_json).collect();
        println!("{}", serde_json::to_string_pretty(&doc).unwrap_or_default());
        return;
    }
    for o in outcomes {
        print_human(o);
    }
}

fn print_human(o: &Outcome) {
    let r = &o.report;
    let (write, remove) = if r.dry_run {
        ("would write", "would remove")
    } else {
        ("wrote", "removed")
    };
    println!(
        "{} ({}): {write} {}, {remove} {}, kept {}",
        o.runtime.name(),
        o.scope,
        r.written.len(),
        r.removed.len(),
        r.preserved.len()
    );
    for n in &r.notices {
        println!("  note: {n}");
    }
    let mut reasons: Vec<(&str, Vec<&str>)> = Vec::new();
    for (path, why) in &r.preserved {
        match reasons.iter_mut().find(|(w, _)| *w == why) {
            Some((_, paths)) => paths.push(path),
            None => reasons.push((why, vec![path])),
        }
    }
    for (why, paths) in reasons {
        if paths.len() > LIST_LIMIT {
            println!("  kept {} files: {why} (--json lists them)", paths.len());
        } else {
            for path in paths {
                println!("  kept {path}: {why}");
            }
        }
    }
    for name in &r.replaced {
        println!("  replaced your value: {name}");
    }
    for (label, list) in [
        ("unsupported", &r.unsupported),
        ("hook left out", &r.dropped_hooks),
        ("hook narrowed", &r.narrowed_hooks),
    ] {
        for item in list {
            println!("  {label}: {item}");
        }
    }
    if let Some(dir) = &r.backup {
        println!(
            "  backup: {} (may hold credentials from your config files; keep it private)",
            dir.display()
        );
    }
}

fn to_json(o: &Outcome) -> Value {
    let r = &o.report;
    json!({
        "target": o.runtime.name(),
        "scope": o.scope,
        "dryRun": r.dry_run,
        "written": r.written,
        "removed": r.removed,
        "kept": r.preserved.iter().map(|(p, why)| json!({"path": p, "reason": why})).collect::<Vec<_>>(),
        "replaced": r.replaced,
        "unsupported": r.unsupported,
        "droppedHooks": r.dropped_hooks,
        "narrowedHooks": r.narrowed_hooks,
        "notices": r.notices,
        "backup": r.backup.as_ref().map(|d| d.display().to_string()),
    })
}
