//! `review compose` — the MECHANICAL coverage→verdict gate.
//!
//! In order: verify the captured diff still hashes to what the manifest
//! recorded, re-run coverage and HARD-REFUSE on any gap, validate every
//! finding, apply the deterministic cap table, pin inline anchors by snippet,
//! and emit the proof bundle plus the submit payload.
//!
//! A `PASS` is therefore impossible without complete, session-observed
//! coverage — and that coupling lives here, in code, not only in the prose of
//! a step file. What it produces is still EVIDENCE: the bundle is what a human
//! reads at the gate, and no path in this file records an approval.
use std::path::Path;
use std::sync::LazyLock;

use regex::Regex;
use serde::Serialize;
use serde_json::{Value, json};

use super::compose_bundle::{body_line, evidence_level_text, proof_bundle};
use super::coverage::coverage;
use super::exec::{Exec, argv};
use super::session::{read_json, relative, session_dir, str_field, write_json_pretty};
use super::verdict::{VerdictInput, compute_verdict};
use crate::fsx::sha256_hex;
use crate::js_regex::compile_ci;
use crate::schema::review_findings::{Finding, Severity};

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ComposeResult {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub decision: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub event: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reasons: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub verdict_path: Option<String>,
}

impl ComposeResult {
    fn bail(error: String) -> Self {
        Self {
            ok: false,
            error: Some(error),
            decision: None,
            event: None,
            reasons: None,
            verdict_path: None,
        }
    }
}

/// CI health read from the captured `gh pr checks` text. Best-effort by
/// design: an unreadable CI summary caps the verdict rather than claiming
/// green.
fn ci_status(text: Option<&str>) -> (bool, bool) {
    // The alternation is the npm CLI's, boundaries and all: `\bfail` matches
    // "fail-fast" but not "prefail", and `error\b` matches "error" but not
    // "errored". A looser substring test would read a passing run as red.
    static RED_RE: LazyLock<Regex> =
        LazyLock::new(|| compile_ci(r"\bfail|failing|failure|error\b").expect("static CI pattern"));
    static SKIP_RE: LazyLock<Regex> =
        LazyLock::new(|| compile_ci("skip").expect("static skip pattern"));
    let Some(text) = text.filter(|t| !t.trim().is_empty()) else {
        return (false, false);
    };
    let lines: Vec<&str> = text.split('\n').filter(|l| !l.trim().is_empty()).collect();
    let all_skipped = !lines.is_empty() && lines.iter().all(|l| SKIP_RE.is_match(l));
    (RED_RE.is_match(text), all_skipped)
}

/// Is the reviewing identity also the author? Unavailable identity leaves this
/// false — the cap table already caps on what the session could not capture.
fn self_pr(dir: &Path, cwd: &Path, exec: &dyn Exec) -> bool {
    let me = exec.run("gh", &argv(&["api", "user", "--jq", ".login"]), cwd);
    if !me.ok {
        return false;
    }
    let Some(meta) = read_json(&dir.join("untrusted").join("pr-metadata.json")) else {
        return false;
    };
    let author = match meta.get("author") {
        Some(Value::Object(map)) => map.get("login").and_then(Value::as_str).unwrap_or_default(),
        Some(Value::String(name)) => name.as_str(),
        _ => return false,
    };
    !author.is_empty() && me.out.trim() == author.trim()
}

fn findings_of(dir: &Path) -> Result<Vec<Value>, String> {
    let path = dir.join("findings.json");
    if !path.exists() {
        return Ok(Vec::new());
    }
    let Some(raw) = read_json(&path) else {
        return Err("findings.json must be an array".to_string());
    };
    let Value::Array(items) = raw else {
        return Err("findings.json must be an array".to_string());
    };
    for item in &items {
        Finding::parse(item).map_err(|errors| format!("invalid finding: {}", errors.join("; ")))?;
    }
    Ok(items)
}

pub fn compose(cwd: &Path, session: &str, exec: &dyn Exec) -> ComposeResult {
    let dir = session_dir(cwd, session);
    if !dir.join("manifest.json").exists() {
        return ComposeResult::bail(format!("no review session at {}", relative(cwd, &dir)));
    }
    let Some(manifest) = read_json(&dir.join("manifest.json")) else {
        return ComposeResult::bail(format!("no review session at {}", relative(cwd, &dir)));
    };

    // 1. Tamper-evident diff. A modified capture means the review was done
    //    against something other than what was recorded: restart, never patch.
    let diff_text = std::fs::read_to_string(dir.join("diff.patch")).unwrap_or_default();
    let recorded = str_field(&manifest, "diffSha256");
    if !recorded.is_empty() && recorded != sha256_hex(diff_text.as_bytes()) {
        return ComposeResult::bail(
            "diff.patch hash does not match the manifest — the captured diff was modified; restart the review".to_string(),
        );
    }

    // 2. Coverage, re-run here rather than trusted from an earlier call.
    let report = coverage(cwd, session);
    if !report.ok || !report.complete {
        return ComposeResult::bail(format!(
            "coverage incomplete ({} gap(s)) — complete reviewer coverage before composing; run 'mewkit review coverage --session {session}'",
            report.gaps.len()
        ));
    }

    let findings = match findings_of(&dir) {
        Ok(findings) => findings,
        Err(error) => return ComposeResult::bail(error),
    };

    let ci_text = std::fs::read_to_string(dir.join("untrusted").join("ci-checks.txt")).ok();
    let (ci_red, ci_all_skipped) = ci_status(ci_text.as_deref());
    let verdict = compute_verdict(&VerdictInput {
        confirmed_critical: findings
            .iter()
            .any(|f| Finding::parse(f).is_ok_and(|parsed| parsed.severity == Severity::Critical)),
        coverage_complete: report.complete,
        evidence_level: report.evidence_level,
        ci_red,
        ci_all_skipped,
        context_unavailable: manifest
            .get("contextUnavailable")
            .and_then(Value::as_array)
            .map(|items| items.iter().map(str_field_value).collect())
            .unwrap_or_default(),
        self_pr: self_pr(&dir, cwd, exec),
    });

    let bundle = proof_bundle(session, &manifest, &report, &verdict, &findings, &diff_text);
    let verdict_file = dir.join(format!("{session}-verdict.json"));
    if let Err(e) = write_json_pretty(&verdict_file, &bundle) {
        return ComposeResult::bail(e.to_string());
    }
    let payload = json!({
        "host": manifest.get("host").cloned().unwrap_or(Value::Null),
        "owner": manifest.get("owner").cloned().unwrap_or(Value::Null),
        "repo": manifest.get("repo").cloned().unwrap_or(Value::Null),
        "pr": manifest.get("pr").cloned().unwrap_or(Value::Null),
        "headSha": manifest.get("headSha").cloned().unwrap_or(Value::Null),
        "event": verdict.event.as_str(),
        "body": body_line(&verdict),
    });
    if let Err(e) = write_json_pretty(&dir.join("submit-payload.json"), &payload) {
        return ComposeResult::bail(e.to_string());
    }
    let caps = if verdict.reasons.is_empty() {
        String::new()
    } else {
        format!(
            "\nCaps/risks:\n{}\n",
            verdict
                .reasons
                .iter()
                .map(|r| format!("- {r}"))
                .collect::<Vec<_>>()
                .join("\n")
        )
    };
    if let Err(e) = std::fs::write(
        dir.join("verdict.md"),
        format!(
            "# Review verdict — {}\n\nEvent: {}\nEvidence level: {}\n{caps}",
            verdict.decision.as_str(),
            verdict.event.as_str(),
            evidence_level_text(report.evidence_level),
        ),
    ) {
        return ComposeResult::bail(e.to_string());
    }

    ComposeResult {
        ok: true,
        error: None,
        decision: Some(verdict.decision.as_str().to_string()),
        event: Some(verdict.event.as_str().to_string()),
        reasons: Some(verdict.reasons),
        verdict_path: Some(relative(cwd, &verdict_file)),
    }
}

/// `String(value)` for an array element, so a non-string entry in
/// `contextUnavailable` reads the way the template literal would print it.
fn str_field_value(value: &Value) -> String {
    crate::js_value::js_string(value)
}

#[cfg(test)]
#[path = "compose_tests.rs"]
mod tests;
