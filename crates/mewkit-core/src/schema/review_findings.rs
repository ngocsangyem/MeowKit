//! What a review FOUND: severities, findings, per-dimension state and the
//! decision they add up to.
//!
//! The vocabularies are closed and identical to the verdict proof bundle, so a
//! review's internal state and the artifact a human reads at Gate 2 cannot
//! disagree about what `FAIL` or `PASS_WITH_RISK` means. There is deliberately
//! no decision-level `WARN`: residual risk maps to `PASS_WITH_RISK`, so no
//! verdict can be half-approved.

use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::verdict::{DimensionVerdict, VerdictDecision};
use super::{Extra, Validation, parse_with, require_non_empty};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Severity {
    #[serde(rename = "CRITICAL")]
    Critical,
    #[serde(rename = "MAJOR")]
    Major,
    #[serde(rename = "MINOR")]
    Minor,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Confidence {
    #[serde(rename = "HIGH")]
    High,
    #[serde(rename = "MEDIUM")]
    Medium,
    #[serde(rename = "LOW")]
    Low,
}

/// One review finding. A finding with no failure scenario is an opinion, so the
/// scenario is required rather than optional.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Finding {
    pub location: String,
    pub failure_scenario: String,
    pub severity: Severity,
    pub confidence: Confidence,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub suggested_direction: Option<String>,
    #[serde(flatten)]
    pub extra: Extra,
}

impl Finding {
    pub fn validate(&self) -> Validation {
        let mut errors = Vec::new();
        require_non_empty("location", &self.location, &mut errors);
        require_non_empty("failureScenario", &self.failure_scenario, &mut errors);
        Validation::new(errors)
    }

    pub fn parse(value: &Value) -> Result<Self, Vec<String>> {
        parse_with(value, |f: &Self| f.validate())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DimensionState {
    pub name: String,
    pub verdict: DimensionVerdict,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
    #[serde(flatten)]
    pub extra: Extra,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct VerdictState {
    pub decision: VerdictDecision,
    pub dimensions: Vec<DimensionState>,
    #[serde(default)]
    pub findings: Vec<Finding>,
    #[serde(flatten)]
    pub extra: Extra,
}

impl VerdictState {
    pub fn validate(&self) -> Validation {
        let mut errors = Vec::new();
        for (i, dimension) in self.dimensions.iter().enumerate() {
            require_non_empty(
                &format!("dimensions.{i}.name"),
                &dimension.name,
                &mut errors,
            );
        }
        for (i, finding) in self.findings.iter().enumerate() {
            for problem in finding.validate().errors {
                errors.push(format!("findings.{i}.{problem}"));
            }
        }
        Validation::new(errors)
    }

    pub fn parse(value: &Value) -> Result<Self, Vec<String>> {
        parse_with(value, |v: &Self| v.validate())
    }
}

#[cfg(test)]
#[path = "review_findings_tests.rs"]
mod tests;
