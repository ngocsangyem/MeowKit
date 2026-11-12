//! The parent-owned supervision continuity record.
//!
//! The supervisor is a long-lived LEAD but never a long-lived SESSION: each call
//! is a fresh fork, so continuity cannot come from a transcript and comes from
//! one compact file the parent owns. Two properties make that safe:
//!
//! 1. It stays SMALL. A fresh parent reloads the current directive and the
//!    pointers, not the history — an auto-growing record would reintroduce the
//!    context rot the fork exists to avoid.
//! 2. It cannot become a second task truth. The durable task record owns status,
//!    progress and verification; a dossier carrying any of them is REFUSED.
//!    Without that guard, "the dossier says verified" eventually outranks the
//!    tests, which is how an advisory surface silently acquires authority.

use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::dossier_doc::render_dossier;
use super::supervision_protocol::{Disposition, SupervisionStage, is_valid_run_id};
use super::{Validation, object_keys, quote, require_non_empty};

/// Frontmatter + active summary ceiling. History below it does not count.
pub const ACTIVE_SUMMARY_MAX_BYTES: usize = 2 * 1024;

/// Fields that would turn continuity into authority. Rejected outright rather
/// than stripped: silently dropping a field the caller believed it stored is
/// worse than refusing, because the caller then trusts state that was never
/// written.
pub const FORBIDDEN_DOSSIER_FIELDS: &[&str] = &[
    "progress",
    "percentComplete",
    "verification",
    "verified",
    "verificationResult",
    "testsPassed",
    "gate",
    "gate1",
    "gate2",
    "gateApproval",
    "approval",
    "approved",
    "verdict",
    "status",
];

/// Whether a checkpoint call is open or closed. `pending` is written BEFORE the
/// call and `committed` after its result lands, so a crashed call is visible
/// rather than free.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CheckpointState {
    Pending,
    Committed,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckpointMarker {
    pub checkpoint_id: String,
    pub stage: SupervisionStage,
    pub state: CheckpointState,
    /// Which budget this call is charged to, for a skill whose cap is
    /// per-partition. Carried on the MARKER so `commit` inherits it from
    /// `begin` — asking the caller to repeat it would let a call open against
    /// one budget and commit against another.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub partition: Option<String>,
}

/// One committed call, persisted so cap accounting survives a process boundary.
///
/// Every checkpoint runs as a separate invocation, so in-memory history does not
/// exist by the time the next call is evaluated. Without this list a run would
/// re-derive an empty history each time and every cap would reset to zero — and
/// a supervision budget that resets is not a budget.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckpointHistory {
    pub checkpoint_id: String,
    pub stage: SupervisionStage,
    pub disposition: Disposition,
    /// Optional so a history written before partitioning still parses — an
    /// entry with no partition belongs to a per-run budget, which is exactly
    /// what those runs had.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub partition: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Dossier {
    pub run_id: String,
    pub skill: String,
    pub stage: SupervisionStage,
    /// Pointers to locked decisions — never the decisions' full text.
    #[serde(default)]
    pub locked_decision_pointers: Vec<String>,
    #[serde(default)]
    pub latest_directive: String,
    #[serde(default)]
    pub correction_count: u64,
    #[serde(default)]
    pub receipt_pointers: Vec<String>,
    #[serde(default)]
    pub next_safe_action: String,
    #[serde(default)]
    pub checkpoint: Option<CheckpointMarker>,
    #[serde(default)]
    pub history: Vec<CheckpointHistory>,
    /// Set when supervision stopped and handed the decision to a human — a cap
    /// was reached, or work was returned twice unresolved.
    ///
    /// It exists because caps are per RUN and the run id comes from the caller:
    /// an agent told "escalate, do not retry" could otherwise mint a fresh run
    /// id and keep going, which defeats the escalation rather than the budget.
    /// This records that supervision STOPPED — it is not a verdict, a status or
    /// an approval, which all remain forbidden fields.
    #[serde(default)]
    pub escalated_to_human: bool,
}

/// Validate a candidate dossier: shape, forbidden authority fields, and the
/// active-summary byte cap.
///
/// The forbidden-field check runs against the RAW candidate, before the strict
/// shape narrows it — an unknown key reports as "unknown field", and the caller
/// needs to know it tried to store AUTHORITY.
pub fn validate_dossier(candidate: &Value) -> Validation {
    let mut errors = Vec::new();
    let keys = object_keys(candidate);
    for forbidden in FORBIDDEN_DOSSIER_FIELDS {
        if keys.contains(forbidden) {
            errors.push(format!(
                "\"{forbidden}\" belongs to the task record — the dossier carries no progress, verification, or gate state"
            ));
        }
    }

    let dossier: Dossier = match serde_json::from_value(candidate.clone()) {
        Ok(d) => d,
        Err(e) => {
            errors.push(e.to_string());
            return Validation::new(errors);
        }
    };

    if !is_valid_run_id(&dossier.run_id) {
        errors.push(format!("runId: invalid run id {}", quote(&dossier.run_id)));
    }
    require_non_empty("skill", &dossier.skill, &mut errors);
    if let Some(marker) = &dossier.checkpoint {
        require_non_empty(
            "checkpoint.checkpointId",
            &marker.checkpoint_id,
            &mut errors,
        );
        if marker.partition.as_ref().is_some_and(String::is_empty) {
            errors.push("checkpoint.partition: must not be empty".to_string());
        }
    }
    for (i, entry) in dossier.history.iter().enumerate() {
        require_non_empty(
            &format!("history.{i}.checkpointId"),
            &entry.checkpoint_id,
            &mut errors,
        );
    }
    if !errors.is_empty() {
        return Validation::new(errors);
    }

    let bytes = render_dossier(&dossier).len();
    if bytes > ACTIVE_SUMMARY_MAX_BYTES {
        errors.push(format!(
            "active summary is {bytes}B, over the {ACTIVE_SUMMARY_MAX_BYTES}B cap — shorten the directive"
        ));
    }

    Validation::new(errors)
}

#[cfg(test)]
#[path = "dossier_tests.rs"]
mod tests;
