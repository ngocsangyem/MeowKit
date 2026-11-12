//! The review pipeline record: manifest + evidence + verdict state.
//!
//! The severity/confidence/decision vocabularies are CLOSED and match the
//! verdict proof bundle, so a review's internal state and the artifact a human
//! reads at Gate 2 cannot disagree about what "FAIL" or "PASS_WITH_RISK" means.

use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::review_findings::VerdictState;
use super::review_manifest::ReviewManifest;
use super::{Extra, Validation, parse_with, require_non_empty};

/// Evidence level for a session. `session-observed` means CLI read receipts
/// corroborated by the real Bash hook; `attested` means receipts only, which
/// caps what the review may claim.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum EvidenceLevel {
    SessionObserved,
    Attested,
}

/// Who tagged a coverage event. `cli` is the read wrapper; `hook` is the Bash
/// PostToolUse handler. Corroborating the two upgrades a read to
/// session-observed.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EvidenceSource {
    Cli,
    Hook,
}

/// One coverage event. `reviewer` is a caller-supplied ROLE label for
/// aggregation, NOT an authenticated identity — nothing downstream may treat it
/// as proof of who read what.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EvidenceEvent {
    pub session: String,
    pub kind: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target: Option<String>,
    pub at: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reviewer: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<EvidenceSource>,
    #[serde(flatten)]
    pub extra: Extra,
}

impl EvidenceEvent {
    pub fn validate(&self) -> Validation {
        let mut errors = Vec::new();
        require_non_empty("session", &self.session, &mut errors);
        require_non_empty("kind", &self.kind, &mut errors);
        require_non_empty("at", &self.at, &mut errors);
        Validation::new(errors)
    }

    pub fn parse(value: &Value) -> Result<Self, Vec<String>> {
        parse_with(value, |e: &Self| e.validate())
    }
}

/// What a `--reply` submit sends to the host. `headSha` binds the submit to the
/// exact reviewed revision, so a stale SHA refuses instead of approving code
/// nobody read.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SubmitEvent {
    #[serde(rename = "APPROVE")]
    Approve,
    #[serde(rename = "REQUEST_CHANGES")]
    RequestChanges,
    #[serde(rename = "COMMENT")]
    Comment,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubmitPayload {
    pub host: super::review_manifest::ReviewHost,
    pub owner: String,
    pub repo: String,
    pub pr: i64,
    pub head_sha: String,
    pub event: SubmitEvent,
    pub body: String,
    #[serde(flatten)]
    pub extra: Extra,
}

impl SubmitPayload {
    pub fn validate(&self) -> Validation {
        let mut errors = Vec::new();
        require_non_empty("owner", &self.owner, &mut errors);
        require_non_empty("repo", &self.repo, &mut errors);
        require_non_empty("headSha", &self.head_sha, &mut errors);
        if self.pr <= 0 {
            errors.push("pr: must be a positive integer".to_string());
        }
        Validation::new(errors)
    }

    pub fn parse(value: &Value) -> Result<Self, Vec<String>> {
        parse_with(value, |p: &Self| p.validate())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewSession {
    pub schema_version: String,
    pub session: String,
    pub manifest: ReviewManifest,
    #[serde(default)]
    pub evidence: Vec<EvidenceEvent>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub verdict: Option<VerdictState>,
    #[serde(flatten)]
    pub extra: Extra,
}

impl ReviewSession {
    pub fn validate(&self) -> Validation {
        let mut errors = Vec::new();
        require_non_empty("schemaVersion", &self.schema_version, &mut errors);
        require_non_empty("session", &self.session, &mut errors);
        errors.extend(
            self.manifest
                .validate()
                .errors
                .into_iter()
                .map(|e| format!("manifest.{e}")),
        );
        for (i, event) in self.evidence.iter().enumerate() {
            for problem in event.validate().errors {
                errors.push(format!("evidence.{i}.{problem}"));
            }
        }
        if let Some(verdict) = &self.verdict {
            errors.extend(
                verdict
                    .validate()
                    .errors
                    .into_iter()
                    .map(|e| format!("verdict.{e}")),
            );
        }
        Validation::new(errors)
    }

    pub fn parse(value: &Value) -> Result<Self, Vec<String>> {
        parse_with(value, |s: &Self| s.validate())
    }
}

#[cfg(test)]
#[path = "review_session_tests.rs"]
mod tests;
