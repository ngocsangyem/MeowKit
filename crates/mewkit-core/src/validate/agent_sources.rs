//! One agent as the conformance check reads it: body, granted tools, and the
//! artifacts its ownership section claims.
use std::collections::BTreeSet;
use std::path::Path;

use super::inventory::Inventory;
use super::inventory_enumerate::{ArtifactType, enumerate_artifacts};
use super::inventory_read::read_frontmatter;

pub(super) struct AgentSource {
    pub(super) path: String,
    pub(super) body: String,
    pub(super) tools: BTreeSet<String>,
    pub(super) artifacts: Vec<String>,
}

/// Read every agent the kit enumerates, joined to its inventory record.
pub(super) fn agent_sources(claude_dir: &Path, inventory: &Inventory) -> Vec<AgentSource> {
    let (refs, _) = enumerate_artifacts(claude_dir);
    refs.iter()
        .filter(|r| r.artifact_type == ArtifactType::Agent)
        .map(|r| AgentSource {
            path: r.rel.clone(),
            body: read_body(&r.abs),
            tools: read_frontmatter(&r.abs)
                .get("tools")
                .and_then(|value| value.as_str())
                .unwrap_or_default()
                .split(',')
                .map(|tool| tool.trim().to_string())
                .filter(|tool| !tool.is_empty())
                .collect(),
            artifacts: inventory
                .entries
                .iter()
                .find(|entry| entry.path == r.rel)
                .and_then(|entry| entry.owned_artifacts.clone())
                .unwrap_or_default(),
        })
        .collect()
}

/// A file as text, lossily — an unreadable agent reads as an empty body rather
/// than stopping the whole check.
pub(super) fn read_body(path: &Path) -> String {
    std::fs::read(path)
        .map(|bytes| String::from_utf8_lossy(&bytes).into_owned())
        .unwrap_or_default()
}
