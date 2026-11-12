//! The scope-driven reviewer roster.
//!
//! Reviewer ids MUST be unique. A duplicate id would let one launched reviewer
//! satisfy two roster entries and overwrite the other's brief, which reports as
//! complete coverage over code nobody read — so the uniqueness rule lives in the
//! contract rather than in the builder that happens to produce ids today.

use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::{Extra, Validation, parse_with, quote, require_non_empty};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ReviewTier {
    Small,
    Medium,
    Large,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RosterEntry {
    pub id: String,
    pub dimension: String,
    pub brief_file: String,
    pub expected_reads: Vec<String>,
    /// Whole-diff roles reason over the ENTIRE diff; a per-chunk reviewer
    /// structurally cannot prove them.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub whole_diff: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub focus: Option<String>,
    #[serde(flatten)]
    pub extra: Extra,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Roster {
    pub tier: ReviewTier,
    pub entries: Vec<RosterEntry>,
    #[serde(flatten)]
    pub extra: Extra,
}

impl Roster {
    pub fn validate(&self) -> Validation {
        let mut errors = Vec::new();
        for (i, entry) in self.entries.iter().enumerate() {
            require_non_empty(&format!("entries.{i}.id"), &entry.id, &mut errors);
            require_non_empty(
                &format!("entries.{i}.dimension"),
                &entry.dimension,
                &mut errors,
            );
            require_non_empty(
                &format!("entries.{i}.briefFile"),
                &entry.brief_file,
                &mut errors,
            );
            for (j, read) in entry.expected_reads.iter().enumerate() {
                require_non_empty(&format!("entries.{i}.expectedReads.{j}"), read, &mut errors);
            }
        }
        if self.duplicate_id().is_some() {
            // Same message as the TS refinement: a coverage failure is reported
            // in the words the reviewer pipeline already logs.
            errors.push("duplicate reviewer id in roster".to_string());
        }
        Validation::new(errors)
    }

    pub fn parse(value: &Value) -> Result<Self, Vec<String>> {
        parse_with(value, |r: &Self| r.validate())
    }

    /// The first repeated reviewer id, quoted the way an operator-facing message
    /// should name it.
    pub fn duplicate_id(&self) -> Option<String> {
        let mut seen = std::collections::BTreeSet::new();
        for entry in &self.entries {
            if !seen.insert(entry.id.as_str()) {
                return Some(quote(&entry.id));
            }
        }
        None
    }
}

#[cfg(test)]
#[path = "roster_tests.rs"]
mod tests;
