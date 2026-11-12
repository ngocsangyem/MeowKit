//! The parent's per-checkpoint supervision receipt.
//!
//! It answers what the dossier deliberately cannot: what was asked, what came
//! back, and what the parent DID about it. `disposition` (the returned routing
//! signal, recorded verbatim) and `outcome` (what the parent did with it) stay
//! separate on purpose — collapsing them would erase the case that matters most,
//! a parent rightly REJECTING a directive. A receipt that cannot express
//! disagreement is a record of compliance, not of supervision.

use std::sync::LazyLock;

use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::supervision_protocol::{Disposition, SupervisionStage};
use super::supervision_scan::{scan_authority_language, scan_secrets};
use super::{Validation, quote, require_non_empty};

/// What the parent did with the directive — never what the directive authorized.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ReceiptOutcome {
    Adopted,
    Rejected,
    Deferred,
}

fn default_task_id() -> String {
    "none".to_string()
}

fn default_provider() -> String {
    "unknown".to_string()
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Receipt {
    pub run_id: String,
    pub stage: SupervisionStage,
    pub disposition: Disposition,
    pub outcome: ReceiptOutcome,
    /// Required even when the directive was adopted. "Why" is the one thing a
    /// later session cannot reconstruct from the artifacts, and an optional
    /// field only filled on disagreement quietly becomes a disagreement marker.
    pub reason: String,
    #[serde(default = "default_task_id")]
    pub task_id: String,
    #[serde(default = "default_provider")]
    pub provider: String,
    pub skill: String,
    pub checkpoint_id: String,
    /// Which release stage's budget this call was charged to, for a skill whose
    /// cap is per-partition. Without it a reader of three ship receipts cannot
    /// tell one over-supervised stage from three ordinary ones.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub release_stage: Option<String>,
    #[serde(default)]
    pub question: String,
    #[serde(default)]
    pub directive: String,
    #[serde(default)]
    pub required_corrections: Vec<String>,
    #[serde(default)]
    pub evidence_pointers: Vec<String>,
    #[serde(default)]
    pub next_safe_action: String,
}

/// Validate a receipt before it is written.
///
/// The prose scan is not redundant with output-packet validation: a packet is
/// validated on the way IN from the supervisor, while a receipt is assembled by
/// the parent from its own summary of that packet — a second, otherwise
/// unvalidated authoring step that could assert an approval the packet was
/// refused for asserting.
pub fn validate_receipt(candidate: &Value) -> Validation {
    let receipt: Receipt = match serde_json::from_value(candidate.clone()) {
        Ok(r) => r,
        Err(e) => return Validation::new(vec![e.to_string()]),
    };

    let mut errors = Vec::new();
    for (label, value) in [
        ("runId", &receipt.run_id),
        ("reason", &receipt.reason),
        ("skill", &receipt.skill),
        ("checkpointId", &receipt.checkpoint_id),
    ] {
        require_non_empty(label, value, &mut errors);
    }
    if receipt.release_stage.as_ref().is_some_and(String::is_empty) {
        errors.push("releaseStage: must not be empty".to_string());
    }
    if !errors.is_empty() {
        return Validation::new(errors);
    }

    let mut prose = vec![
        receipt.question.clone(),
        receipt.directive.clone(),
        receipt.reason.clone(),
        receipt.next_safe_action.clone(),
    ];
    prose.extend(receipt.required_corrections.clone());
    let prose = prose.join(" ");
    errors.extend(scan_authority_language(&prose));
    let mut scanned = vec![prose];
    scanned.extend(receipt.evidence_pointers.clone());
    errors.extend(scan_secrets(&scanned.join("\n")));

    // Mirrors the output-packet rule: returning work with nothing to change is
    // not actionable, and a receipt that records it that way hides an empty
    // return.
    if receipt.disposition == Disposition::ReturnToExecutor
        && receipt.required_corrections.is_empty()
    {
        errors.push("RETURN_TO_EXECUTOR requires at least one required correction".to_string());
    }

    Validation::new(errors)
}

// `[0-9]`, not `\d`: the result becomes a path component, and Rust's `\d`
// matches every Unicode decimal digit where the JS `\d` it ports is `[0-9]`.
static RECEIPT_DATE_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^[0-9]{6}$").expect("static receipt date pattern"));
static RECEIPT_SLUG_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^[a-z0-9][a-z0-9-]*$").expect("static receipt slug pattern"));

/// `tasks/reports/{YYMMDD}-{slug}-advice-{n}.md`. Every component is checked
/// because the result becomes a path: a free-form slug here would be a write
/// anywhere.
pub fn receipt_path(date: &str, slug: &str, n: u32) -> Result<String, String> {
    if !RECEIPT_DATE_RE.is_match(date) {
        return Err(format!("receipt date must be YYMMDD: {}", quote(date)));
    }
    if !RECEIPT_SLUG_RE.is_match(slug) {
        return Err(format!("receipt slug must be kebab-case: {}", quote(slug)));
    }
    if n < 1 {
        return Err(format!("receipt index must be a positive integer: {n}"));
    }
    Ok(format!("tasks/reports/{date}-{slug}-advice-{n}.md"))
}

#[cfg(test)]
#[path = "supervision_receipt_tests.rs"]
mod tests;
