//! `verdict-gate`: the Gate 2 paperwork check over the machine-readable verdict
//! (`tasks/reviews/<slug>-verdict.json`), ported from the npm CLI's
//! `review/verdict-schema.ts` `evaluateVerdictGate`.
//!
//! Gate authority: a pass here means the verdict file exists, parses and does
//! not itself say `BLOCKED`. It is evidence a human reads at Gate 2, never the
//! approval, and nothing in this module records one.
//!
//! The zod refusal messages are reproduced word for word (`zod_messages`), so
//! a refused verdict reads the same from either CLI. A markdown-only verdict
//! is TOLERATED (passes with a warning) exactly as the npm CLI does, even when
//! its text carries a FAIL line that `validate-gate-2.cjs` would block on.
//! That gap is known and pinned by a parity case; closing it is a behaviour
//! change that ships on its own, not inside this port.
use std::path::Path;

use serde_json::Value;

use crate::schema::verdict::resolve_verdict_path;
use crate::verdict_shape::verdict_issues;

/// How the check ended; the label is what the refusal line prints.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GateStatus {
    Pass,
    Blocked,
    Invalid,
    Missing,
    LegacyMd,
}

impl GateStatus {
    pub fn label(self) -> &'static str {
        match self {
            Self::Pass => "pass",
            Self::Blocked => "blocked",
            Self::Invalid => "invalid",
            Self::Missing => "missing",
            Self::LegacyMd => "legacy-md",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GateResult {
    /// The verdict does not stop a ship by itself. Not an approval.
    pub ok: bool,
    pub status: GateStatus,
    pub decision: Option<String>,
    pub errors: Vec<String>,
}

impl GateResult {
    fn refused(status: GateStatus, errors: Vec<String>) -> Self {
        Self {
            ok: false,
            status,
            decision: None,
            errors,
        }
    }
}

/// Run the check, resolving relative paths against the process directory the
/// way the npm CLI's `fs` calls do.
pub fn evaluate(slug_or_path: &str) -> GateResult {
    let json_path = resolve_verdict_path(slug_or_path);
    let md_path = match json_path.strip_suffix(".json") {
        Some(stem) => format!("{stem}.md"),
        None => json_path.clone(),
    };

    if !Path::new(&json_path).exists() {
        if Path::new(&md_path).exists() {
            return GateResult {
                ok: true,
                status: GateStatus::LegacyMd,
                decision: None,
                errors: vec![format!(
                    "No verdict JSON at {json_path}; markdown-only verdict tolerated during transition."
                )],
            };
        }
        return GateResult::refused(
            GateStatus::Missing,
            vec![format!("No verdict found at {json_path} (or sibling .md).")],
        );
    }

    let raw = match read_text(&json_path) {
        Ok(text) => text,
        Err(message) => {
            return GateResult::refused(
                GateStatus::Invalid,
                vec![format!("invalid JSON: {message}")],
            );
        }
    };
    let value: Value = match serde_json::from_str(&raw) {
        Ok(value) => value,
        Err(e) => {
            return GateResult::refused(GateStatus::Invalid, vec![format!("invalid JSON: {e}")]);
        }
    };

    let issues = verdict_issues(&value);
    if !issues.is_empty() {
        return GateResult::refused(GateStatus::Invalid, issues);
    }

    // Shape-checked above, so `decision` is one of the three enum strings.
    let decision = value["decision"].as_str().unwrap_or_default().to_string();
    if decision == "BLOCKED" {
        return GateResult {
            ok: false,
            status: GateStatus::Blocked,
            decision: Some(decision),
            errors: vec!["verdict decision is BLOCKED — Gate 2 blocks ship.".to_string()],
        };
    }
    GateResult {
        ok: true,
        status: GateStatus::Pass,
        decision: Some(decision),
        errors: Vec::new(),
    }
}

/// `fs.readFileSync(path, "utf-8")`: lossy UTF-8 (BOM kept, so it fails to
/// parse as Node's would), and the two read failures a user can actually hit
/// worded the way Node words them.
fn read_text(path: &str) -> Result<String, String> {
    if Path::new(path).is_dir() {
        return Err("EISDIR: illegal operation on a directory, read".to_string());
    }
    match std::fs::read(path) {
        Ok(bytes) => Ok(String::from_utf8_lossy(&bytes).into_owned()),
        Err(e) if e.kind() == std::io::ErrorKind::PermissionDenied => {
            Err(format!("EACCES: permission denied, open '{path}'"))
        }
        Err(e) => Err(e.to_string()),
    }
}

#[cfg(test)]
#[path = "verdict_gate_tests.rs"]
mod tests;
