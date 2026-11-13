//! The machine-readable review verdict — the companion to the human
//! `tasks/reviews/<slug>-verdict.md`.
//!
//! Gate authority note: this type RECORDS a decision a review reached. It is
//! evidence a human reads at Gate 2 and never the approval itself, so nothing
//! here derives "may ship" from anything but an explicit `BLOCKED` check the
//! caller performs.
//!
//! The wire keys are snake_case (`schema_version`, `evidence_refs`,
//! `created_at`) because that is what the npm CLI already writes — the rest of
//! the kit's JSON is camelCase, and this file deliberately keeps the shape it
//! has rather than breaking every verdict on disk.

use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::{Extra, Validation, parse_with, require_non_empty};

/// Per-dimension state. `WARN` exists here and NOT at decision level: a residual
/// risk maps to `PASS_WITH_RISK`, so no verdict can be half-approved.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DimensionVerdict {
    #[serde(rename = "PASS")]
    Pass,
    #[serde(rename = "WARN")]
    Warn,
    #[serde(rename = "FAIL")]
    Fail,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum VerdictGate {
    Review,
    Contract,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum VerdictDecision {
    #[serde(rename = "PASS")]
    Pass,
    #[serde(rename = "PASS_WITH_RISK")]
    PassWithRisk,
    #[serde(rename = "BLOCKED")]
    Blocked,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Dimension {
    pub name: String,
    pub verdict: DimensionVerdict,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
    #[serde(flatten)]
    pub extra: Extra,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Verdict {
    pub schema_version: String,
    pub slug: String,
    pub gate: VerdictGate,
    pub decision: VerdictDecision,
    pub dimensions: Vec<Dimension>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub evidence_refs: Option<Vec<String>>,
    pub created_at: String,
    #[serde(flatten)]
    pub extra: Extra,
}

impl Verdict {
    pub fn validate(&self) -> Validation {
        let mut errors = Vec::new();
        require_non_empty("slug", &self.slug, &mut errors);
        for (i, dimension) in self.dimensions.iter().enumerate() {
            require_non_empty(
                &format!("dimensions.{i}.name"),
                &dimension.name,
                &mut errors,
            );
        }
        Validation::new(errors)
    }

    pub fn parse(value: &Value) -> Result<Self, Vec<String>> {
        parse_with(value, |v: &Self| v.validate())
    }

    /// Whether this verdict's own decision blocks a ship. It answers ONLY the
    /// decision field — the gate still belongs to the human who reads it.
    pub fn decision_blocks(&self) -> bool {
        self.decision == VerdictDecision::Blocked
    }

    /// Dimension names carrying `FAIL`. A non-empty list is what the Gate 2
    /// paperwork check reports; it does not decide anything by itself.
    pub fn failed_dimensions(&self) -> Vec<&str> {
        self.dimensions
            .iter()
            .filter(|d| d.verdict == DimensionVerdict::Fail)
            .map(|d| d.name.as_str())
            .collect()
    }
}

/// Resolve a slug or an explicit path to the verdict JSON path, matching the TS
/// resolver: an explicit `.json` stands, a `.md` becomes its JSON sibling, and a
/// bare slug resolves under `tasks/reviews/` through `path.join` — normalised
/// and platform-separated, so a message naming the path reads the same.
pub fn resolve_verdict_path(slug_or_path: &str) -> String {
    if slug_or_path.ends_with(".json") {
        return slug_or_path.to_string();
    }
    if let Some(stem) = slug_or_path.strip_suffix(".md") {
        return format!("{stem}.json");
    }
    crate::node_path::join_relative(&["tasks", "reviews", &format!("{slug_or_path}-verdict.json")])
}

#[cfg(test)]
#[path = "verdict_tests.rs"]
mod tests;
