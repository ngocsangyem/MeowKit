//! One capability entry and the manifest that holds them.
//!
//! The entry is the RESOLUTION view: self-contained enough for a host to select
//! and invoke a capability, with `inventoryId` cross-referencing the
//! installation/governance view rather than duplicating it. Denormalized fields
//! (`owner`) are validated against inventory elsewhere — they exist so a
//! resolved entry can be read on its own, not so the two can disagree.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::capability::{
    CapabilityKind, ContextRequirement, FieldProvenance, Invocation, SupportLevels,
    TypedRequirement, Verification,
};
use super::{Validation, parse_with, require_non_empty};
use crate::path_shape::is_contained_relative;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum InstalledState {
    Installed,
    Absent,
    #[default]
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct Dependencies {
    #[serde(default)]
    pub upstream: Vec<String>,
    #[serde(default)]
    pub downstream: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CapabilityEntry {
    pub id: String,
    pub kind: CapabilityKind,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub aliases: Vec<String>,
    /// `.claude/`-relative source path, or null for an authored kind with no
    /// disk artifact.
    #[serde(default)]
    pub source_path: Option<String>,
    /// Cross-reference to the matching inventory entry, or null for
    /// authored-only kinds.
    #[serde(default)]
    pub inventory_id: Option<String>,
    /// Denormalized from inventory for self-contained output; agreement is
    /// validated against inventory, never assumed.
    #[serde(default)]
    pub owner: String,
    #[serde(default)]
    pub installed_state: InstalledState,
    /// Bounded selection terms — authored for flagship flows, else inferred.
    #[serde(default)]
    pub intents: Vec<String>,
    #[serde(default)]
    pub when_to_use: Option<String>,
    pub invocation: Invocation,
    #[serde(default)]
    pub requirements: Vec<TypedRequirement>,
    /// Set when this capability must acquire a task-scoped repo-context envelope
    /// before source-grounded work. Null = no repo grounding needed.
    /// Orchestration-only — never fed to availability adapters.
    #[serde(default)]
    pub context_requirement: Option<ContextRequirement>,
    /// Per-provider support levels; an absent provider ⇒ unknown support for it.
    ///
    /// `BTreeMap`, so a read→write SORTS the providers where the TypeScript
    /// preserves insertion order. Deterministic, which is what a diff needs,
    /// but not byte-identical to what the npm CLI wrote.
    #[serde(default)]
    pub support: BTreeMap<String, SupportLevels>,
    #[serde(default)]
    pub verification: Verification,
    #[serde(default)]
    pub dependencies: Dependencies,
    /// field name → where that field's value came from.
    #[serde(default)]
    pub provenance: BTreeMap<String, FieldProvenance>,
}

impl CapabilityEntry {
    pub fn validate(&self) -> Validation {
        let mut errors = Vec::new();
        require_non_empty("id", &self.id, &mut errors);
        errors.extend(self.invocation.validate().errors);
        for (i, requirement) in self.requirements.iter().enumerate() {
            errors.extend(requirement.validate(&format!("requirements.{i}")));
        }
        if let Some(context) = &self.context_requirement {
            errors.extend(context.validate().errors);
        }
        // A source path leaving `.claude/` would point the resolver at a file
        // the kit does not own. Same predicate as `isContained` in
        // `core/validate-capabilities.ts`, down to the Windows drive prefix and
        // the backslash separator, and the same message.
        if let Some(path) = &self.source_path
            && !is_contained_relative(path)
        {
            errors.push(format!("sourcePath escapes .claude/: {path}"));
        }
        Validation::new(errors)
    }

    pub fn parse(value: &Value) -> Result<Self, Vec<String>> {
        parse_with(value, |e: &Self| e.validate())
    }
}

pub const CAPABILITY_MANIFEST_SCHEMA_VERSION: &str = "1.0";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CapabilityManifest {
    pub schema_version: String,
    pub entries: Vec<CapabilityEntry>,
}

impl CapabilityManifest {
    pub fn validate(&self) -> Validation {
        let mut errors = Vec::new();
        if self.schema_version != CAPABILITY_MANIFEST_SCHEMA_VERSION {
            errors.push(format!(
                "schemaVersion: must be \"{CAPABILITY_MANIFEST_SCHEMA_VERSION}\""
            ));
        }
        for (i, entry) in self.entries.iter().enumerate() {
            for problem in entry.validate().errors {
                errors.push(format!("entries.{i}.{problem}"));
            }
        }
        Validation::new(errors)
    }

    pub fn parse(value: &Value) -> Result<Self, Vec<String>> {
        parse_with(value, |m: &Self| m.validate())
    }
}

#[cfg(test)]
#[path = "capability_entry_tests.rs"]
mod tests;
