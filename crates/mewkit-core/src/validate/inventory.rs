//! The unified harness inventory: every artifact, merged with its governance
//! metadata from the hybrid store.
//!
//! Frontmatter carries it for skills and agents, the central registry for rules
//! and hooks. Missing records and missing required fields become ISSUES — never
//! a silently-defaulted passing value, which is the whole point of a governance
//! inventory. Port of the building half of `core/build-inventory.ts`.

use serde_json::{Map, Value};

use super::inventory_enumerate::InventoryIssue;

/// The typed dependency-edge vocabulary.
pub const DEPENDENCY_EDGE_TYPES: [&str; 7] = [
    "requires",
    "peer",
    "optional_bridge",
    "redirect",
    "consumes_artifact",
    "human_handoff",
    "provider_adapter",
];

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DependencyEdge {
    pub id: String,
    pub edge_type: String,
}

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct InventoryEntry {
    pub artifact_type: String,
    /// Path relative to `.claude/`.
    pub path: String,
    pub id: String,
    pub owner: String,
    pub criticality: String,
    pub status: String,
    pub runtime: String,
    pub context_cost: Option<String>,
    pub dependency_edges: Vec<DependencyEdge>,
    /// Flat `requires` projection used by pack closure and validation.
    pub depends_on: Vec<String>,
    pub responsibility: Option<String>,
    pub surface: Option<String>,
    /// Agent-only model declaration.
    pub model: Option<String>,
    /// Agent-only comma-delimited tool allowlist.
    pub tools: Option<Vec<String>>,
    pub agent_class: Option<&'static str>,
    pub routing: Option<&'static str>,
    pub public: Option<bool>,
    pub owned_artifacts: Option<Vec<String>>,
    pub trigger_owner: Option<bool>,
    pub status_reference: Option<&'static str>,
    pub source: &'static str,
}

#[derive(Clone, Debug, Default)]
pub struct Inventory {
    pub entries: Vec<InventoryEntry>,
    pub issues: Vec<InventoryIssue>,
}

pub const REQUIRED_FIELDS: [&str; 4] = ["owner", "criticality", "status", "runtime"];

/// The canonical A1 status-protocol reference an agent body must use verbatim.
pub const STATUS_REFERENCE: &str =
    "End with the A1 status block exactly as defined in `.claude/rules/agent-conduct.md` (A1).";

pub(super) fn string_field(meta: &Map<String, Value>, key: &str) -> String {
    meta.get(key)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string()
}

/// `[...new Set(values)]` — first occurrence wins, order preserved.
pub(super) fn dedup_in_order(values: Vec<String>) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for value in values {
        if !out.contains(&value) {
            out.push(value);
        }
    }
    out
}

#[cfg(test)]
#[path = "inventory_tests.rs"]
mod inventory_tests;
