//! The durable per-task record and the active-task pointer.
//!
//! Compatibility is governed by the record's own `schemaVersion` checked against
//! the range this binary supports — decoupled from both the CLI version line and
//! the kit-release version line, which ride along as provenance only. A record
//! outside the range is REFUSED loudly rather than migrated on a guess, because
//! a silently-migrated record is indistinguishable from one this binary wrote.

use std::sync::LazyLock;

use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::{Extra, Validation, parse_with, quote};

/// The record schema version THIS binary writes. Bump on a breaking shape change.
pub const TASK_RECORD_SCHEMA_VERSION: &str = "1.0";
/// Record schema versions this binary can safely READ.
pub const SUPPORTED_TASK_RECORD_SCHEMAS: &[&str] = &["1.0"];

/// Valid task id: lowercase slug, filename-safe (it becomes `<id>.json`).
static TASK_ID_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^[a-z0-9][a-z0-9-]{0,63}$").expect("static task id pattern"));

/// Whether `id` may be used as a task id — and therefore as a filename.
pub fn is_valid_task_id(id: &str) -> bool {
    TASK_ID_RE.is_match(id)
}

/// Coerce an arbitrary string (e.g. a plan slug) into a valid task id:
/// lowercase, non-slug characters collapsed to hyphens, trimmed, capped at 64
/// characters. Falls back to `task` when nothing survives.
pub fn normalize_task_id(raw: &str) -> String {
    let lowered = raw.to_lowercase();
    let mut collapsed = String::with_capacity(lowered.len());
    // A RUN of unusable characters collapses to one hyphen, which is what
    // `/[^a-z0-9-]+/g → "-"` does. The run flag matters: an authored hyphen next
    // to a stripped character must stay its own character, or `a-_b` would
    // normalize differently here than in the CLI that wrote the id.
    let mut in_run = false;
    for ch in lowered.chars() {
        if ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '-' {
            collapsed.push(ch);
            in_run = false;
        } else if !in_run {
            collapsed.push('-');
            in_run = true;
        }
    }
    // The TS cap counts UTF-16 units of an already-ASCII string, so a byte
    // truncation is the same cut.
    let trimmed: String = collapsed.trim_matches('-').chars().take(64).collect();
    let trimmed = trimmed.trim_end_matches('-').to_string();
    if trimmed.is_empty() {
        "task".to_string()
    } else {
        trimmed
    }
}

/// The refusal a filename-unsafe id earns, with the same text as the TS throw.
pub fn check_task_id(id: &str) -> Result<(), String> {
    if is_valid_task_id(id) {
        Ok(())
    } else {
        Err(format!("invalid task id: {}", quote(id)))
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TaskStatus {
    Active,
    Blocked,
    Done,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CapabilityDecisionKind {
    Selected,
    Skipped,
    Unavailable,
    Unsupported,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CapabilityDecision {
    pub capability_id: String,
    pub decision: CapabilityDecisionKind,
    pub reason: String,
    /// References the availability snapshot that justified the decision.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub adapter_snapshot_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RepoRef {
    /// Stable repository identity (remote URL, path hash, or name) — never invented.
    pub identity: String,
    /// VCS revision when available; `null` for a non-git root. A missing
    /// revision stays missing: nothing here fabricates one.
    pub revision: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct VerificationSummary {
    #[serde(rename = "ref")]
    pub reference: String,
    pub result: String,
}

/// The one per-task record that lets a fresh session resume and audit capability
/// use. Unknown keys pass through: a newer binary may add an additive field
/// without bumping `schemaVersion`, and an older one must not strip it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskRecord {
    pub schema_version: String,
    pub task_id: String,
    #[serde(default)]
    pub plan_path: Option<String>,
    pub status: TaskStatus,
    #[serde(default)]
    pub current_step: String,
    #[serde(default)]
    pub repos: Vec<RepoRef>,
    #[serde(default)]
    pub blockers: Vec<String>,
    #[serde(default)]
    pub next_action: String,
    #[serde(default)]
    pub verification_summaries: Vec<VerificationSummary>,
    #[serde(default)]
    pub evidence_refs: Vec<String>,
    #[serde(default)]
    pub capability_decisions: Vec<CapabilityDecision>,
    /// Provenance only, never the compatibility gate: who wrote this record.
    #[serde(default)]
    pub written_by_cli: String,
    #[serde(default)]
    pub written_by_kit: String,
    pub updated_at: String,
    #[serde(flatten)]
    pub extra: Extra,
}

impl TaskRecord {
    pub fn validate(&self) -> Validation {
        let mut errors = Vec::new();
        if self.schema_version != TASK_RECORD_SCHEMA_VERSION {
            errors.push(format!(
                "schemaVersion: must be {}",
                quote(TASK_RECORD_SCHEMA_VERSION)
            ));
        }
        if !is_valid_task_id(&self.task_id) {
            errors.push(format!("taskId: invalid task id {}", quote(&self.task_id)));
        }
        Validation::new(errors)
    }

    /// Deserialize + validate in one step, the way `TaskRecordSchema.parse` does.
    pub fn parse(value: &Value) -> Result<Self, Vec<String>> {
        parse_with(value, |r: &Self| r.validate())
    }
}

/// The compatibility gate TS applies BEFORE the schema: a record whose
/// `schemaVersion` this binary cannot read is refused with the version named, so
/// the operator sees which side is out of date.
pub fn check_record_schema_version(value: &Value) -> Result<(), String> {
    let Some(found) = value.get("schemaVersion").and_then(Value::as_str) else {
        return Ok(());
    };
    if SUPPORTED_TASK_RECORD_SCHEMAS.contains(&found) {
        return Ok(());
    }
    let supported =
        serde_json::to_string(SUPPORTED_TASK_RECORD_SCHEMAS).unwrap_or_else(|_| "[]".into());
    Err(format!(
        "Incompatible task record: record schemaVersion {} not in supported {supported}",
        quote(found)
    ))
}

#[cfg(test)]
#[path = "task_record_tests.rs"]
mod tests;
