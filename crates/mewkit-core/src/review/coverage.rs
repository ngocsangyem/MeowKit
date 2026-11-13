//! `review coverage` — what the roster REQUIRED against what the session can
//! show it read.
//!
//! The required roster is rebuilt from `impact-map.json`, never read from the
//! persisted `roster.json`: a roster on disk is a file the acting session can
//! edit, and a gate that trusts it can be satisfied by deleting rows.
//!
//! ## Honesty invariant
//!
//! `evidence.jsonl` and `hook-evidence.jsonl` are session-directory files the
//! acting session can also write. `session-observed` proves the corroboration
//! was RECORDED, not that it is unforgeable — it is anti-accidental, and it
//! never establishes independent-reviewer provenance. The gate stays a human
//! decision; this report is evidence a human reads, not authority.
use std::path::Path;

use serde::Serialize;
use serde_json::Value;

use super::impact_map::ImpactMap;
use super::roster::build_roster;
use super::session::{read_jsonl, relative, session_dir, str_field};
use crate::schema::review_session::EvidenceLevel;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct CoverageGap {
    #[serde(rename = "type")]
    pub kind: String,
    pub reviewer: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CoverageReport {
    pub ok: bool,
    pub session: String,
    pub evidence_level: EvidenceLevel,
    pub complete: bool,
    /// Complete AND session-observed. Attested evidence caps the verdict.
    pub approve_eligible: bool,
    pub gaps: Vec<CoverageGap>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Canonicalize a read target so the CLI's normalised path and the hook's raw
/// command token corroborate. Fail-safe in one direction only: a mismatch can
/// downgrade to attested, never upgrade.
fn norm_target(target: &str) -> &str {
    target
        .strip_prefix("./")
        .unwrap_or(target)
        .trim_end_matches('/')
}

fn bail(session: &str, error: String) -> CoverageReport {
    CoverageReport {
        ok: false,
        session: session.to_string(),
        evidence_level: EvidenceLevel::Attested,
        complete: false,
        approve_eligible: false,
        gaps: Vec::new(),
        error: Some(error),
    }
}

/// The gap kind a missing read reports as — named by WHAT was not opened, so
/// "the reviewer never ran" reads differently from "the reviewer ran but never
/// opened the diff".
fn gap_kind(target: &str) -> &'static str {
    if target == "diff.patch" {
        "diff-never-opened"
    } else if target.starts_with("briefs/") {
        "brief-never-read"
    } else {
        "required-read-missing"
    }
}

pub fn coverage(cwd: &Path, session: &str) -> CoverageReport {
    let dir = session_dir(cwd, session);
    let impact_path = dir.join("impact-map.json");
    if !impact_path.exists() {
        return bail(
            session,
            format!(
                "no impact-map.json in {} (run 'mewkit review prepare' first)",
                relative(cwd, &dir)
            ),
        );
    }
    let raw = match std::fs::read_to_string(&impact_path) {
        Ok(text) => text,
        Err(e) => return bail(session, format!("cannot read impact-map.json: {e}")),
    };
    // Every field defaults, so an impact map written before a field existed
    // still yields a roster (the small tier) instead of crashing the gate.
    let impact: ImpactMap = match serde_json::from_str(&raw) {
        Ok(map) => map,
        Err(e) => return bail(session, format!("cannot read impact-map.json: {e}")),
    };

    let roster = build_roster(&impact);
    let cli: Vec<Value> = read_jsonl(&dir.join("evidence.jsonl"))
        .into_iter()
        .filter(|e| str_field(e, "source") != "hook")
        .collect();
    let hook_targets: Vec<String> = read_jsonl(&dir.join("hook-evidence.jsonl"))
        .iter()
        .filter(|e| str_field(e, "kind") == "read")
        .map(|e| norm_target(str_field(e, "target")).to_string())
        .collect();

    let mut gaps: Vec<CoverageGap> = Vec::new();
    let mut required_reads: Vec<String> = Vec::new();
    for entry in &roster.entries {
        let mine: Vec<&Value> = cli
            .iter()
            .filter(|e| str_field(e, "reviewer") == entry.id && str_field(e, "kind") == "read")
            .collect();
        if mine.is_empty() {
            gaps.push(CoverageGap {
                kind: "reviewer-never-launched".to_string(),
                reviewer: entry.id.clone(),
                target: None,
            });
            continue;
        }
        for target in &entry.expected_reads {
            required_reads.push(target.clone());
            if !mine
                .iter()
                .any(|e| str_field(e, "target") == target.as_str())
            {
                gaps.push(CoverageGap {
                    kind: gap_kind(target).to_string(),
                    reviewer: entry.id.clone(),
                    target: Some(target.clone()),
                });
            }
        }
    }

    // Session-observed only when EVERY required read that was actually
    // performed through the CLI is corroborated by a hook-tagged event.
    let performed: Vec<&Value> = cli
        .iter()
        .filter(|e| {
            str_field(e, "kind") == "read"
                && required_reads
                    .iter()
                    .any(|r| r.as_str() == str_field(e, "target"))
        })
        .collect();
    let corroborated = !performed.is_empty()
        && performed.iter().all(|e| {
            let target = norm_target(str_field(e, "target"));
            hook_targets.iter().any(|h| h == target)
        });
    let evidence_level = if corroborated {
        EvidenceLevel::SessionObserved
    } else {
        EvidenceLevel::Attested
    };

    let complete = gaps.is_empty();
    CoverageReport {
        ok: complete,
        session: session.to_string(),
        evidence_level,
        complete,
        approve_eligible: complete && evidence_level == EvidenceLevel::SessionObserved,
        gaps,
        error: None,
    }
}

#[cfg(test)]
#[path = "coverage_tests.rs"]
mod tests;
