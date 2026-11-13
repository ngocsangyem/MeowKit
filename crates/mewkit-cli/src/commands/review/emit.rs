//! What each stage prints.
//!
//! Two shapes per stage: the `--json` record, which is the result struct
//! verbatim (field order included — callers parse it), and a one-line human
//! summary. Failures print on STDERR with the npm CLI's `✗` marker and leave
//! the exit code to the caller, so a stage that failed still reports before it
//! exits.
use serde_json::Value;

/// `JSON.stringify(value, null, 2)` on stdout.
///
/// Takes an already-converted [`Value`] so this crate needs no `serde`
/// dependency of its own: each stage's result struct converts itself through
/// `serde_json`, which keeps its declared field order.
pub fn json(value: &Value) {
    println!(
        "{}",
        serde_json::to_string_pretty(value).unwrap_or_else(|_| "null".into())
    );
}

pub fn failure(error: &str) {
    eprintln!("✗ {error}");
}

pub fn prepared(session: &str, session_dir: &str) {
    println!("✔ review session {session} → {session_dir}");
}

pub fn coverage(complete: bool, evidence_level: &str, gaps: usize) {
    let mark = if complete { "✓" } else { "✗" };
    let state = if complete { "complete" } else { "INCOMPLETE" };
    println!("{mark} coverage {state} · level={evidence_level} · {gaps} gap(s)");
}

pub fn composed(decision: &str, event: &str, reasons: &[String]) {
    let mark = match decision {
        "PASS" => "✓",
        "BLOCKED" => "✗",
        _ => "⚠",
    };
    let detail = if reasons.is_empty() {
        "clean".to_string()
    } else {
        reasons.join("; ")
    };
    println!("{mark} {decision} ({event}) — {detail}");
}

pub fn submitted(already_posted: bool) {
    if already_posted {
        println!("✓ already submitted (idempotent no-op)");
    } else {
        println!("✓ review posted");
    }
}

pub fn cleaned() {
    println!("✓ review worktree cleaned (session artifacts kept for the audit trail)");
}

/// A read happened but its receipt could not be appended. Reported, never
/// fatal: hiding the read would be worse than losing the receipt.
pub fn evidence_not_recorded(error: &str) {
    eprintln!("⚠ evidence not recorded: {error}");
}
