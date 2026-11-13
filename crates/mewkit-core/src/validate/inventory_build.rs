//! Building one entry per enumerated artifact, and the issues that come with
//! a record that is missing or self-contradicting.
use std::collections::BTreeSet;
use std::path::Path;

use serde_json::Value;

use super::inventory::{Inventory, InventoryEntry, STATUS_REFERENCE, dedup_in_order, string_field};
use super::inventory_agent::{agent_contract_fields, agent_declared_artifacts, trigger_owner};
use super::inventory_edges::{dependency_edges, string_list};
use super::inventory_enumerate::{ArtifactType, InventoryIssue, MetaSource, enumerate_artifacts};
use super::inventory_read::{read_frontmatter, read_registry};

/// Build the unified inventory for one `.claude/` directory.
pub fn build_inventory(claude_dir: &Path) -> Inventory {
    let (refs, mut issues) = enumerate_artifacts(claude_dir);
    let registry = read_registry(claude_dir);
    let mut entries = Vec::new();

    for artifact in &refs {
        let meta = match artifact.meta_source {
            MetaSource::Frontmatter => read_frontmatter(&artifact.abs),
            MetaSource::Registry => registry
                .get(&artifact.rel)
                .and_then(Value::as_object)
                .cloned()
                .unwrap_or_default(),
        };
        let has_record = match artifact.meta_source {
            MetaSource::Frontmatter => !meta.is_empty(),
            MetaSource::Registry => registry.contains_key(&artifact.rel),
        };
        if !has_record {
            issues.push(InventoryIssue {
                path: artifact.rel.clone(),
                artifact_type: artifact.artifact_type.as_str().to_string(),
                problem: format!("no governance metadata ({})", artifact.meta_source.as_str()),
            });
        }

        let mut entry = InventoryEntry {
            artifact_type: artifact.artifact_type.as_str().to_string(),
            path: artifact.rel.clone(),
            id: artifact.id.clone(),
            owner: string_field(&meta, "owner"),
            criticality: string_field(&meta, "criticality"),
            status: string_field(&meta, "status"),
            runtime: string_field(&meta, "runtime"),
            source: artifact.meta_source.as_str(),
            ..InventoryEntry::default()
        };
        if let Some(cost) = meta.get("context_cost").and_then(Value::as_str) {
            entry.context_cost = Some(cost.to_string());
        }
        let edges = dependency_edges(&meta, &mut issues, &artifact.rel);
        let legacy = string_list(&meta, "depends_on");
        let typed_requires: Vec<String> = edges
            .iter()
            .filter(|edge| edge.edge_type == "requires")
            .map(|edge| edge.id.clone())
            .collect();
        if !edges.is_empty() && !legacy.is_empty() {
            let legacy_ids: BTreeSet<&String> = legacy.iter().collect();
            let typed_ids: BTreeSet<&String> = typed_requires.iter().collect();
            if legacy_ids != typed_ids {
                issues.push(InventoryIssue {
                    path: artifact.rel.clone(),
                    artifact_type: artifact.artifact_type.as_str().to_string(),
                    problem: "depends_on must match dependency_edges of type requires".to_string(),
                });
            }
        }
        let flattened = if edges.is_empty() {
            dedup_in_order(legacy)
        } else {
            dedup_in_order(typed_requires)
        };
        entry.dependency_edges = edges;
        entry.depends_on = flattened;
        entry.responsibility = meta
            .get("responsibility")
            .and_then(Value::as_str)
            .map(str::to_string);
        entry.surface = meta
            .get("surface")
            .and_then(Value::as_str)
            .map(str::to_string);

        if artifact.artifact_type == ArtifactType::Agent {
            let body = std::fs::read(&artifact.abs)
                .map(|bytes| String::from_utf8_lossy(&bytes).into_owned())
                .unwrap_or_default();
            entry.model = Some(string_field(&meta, "model"));
            let tools: Vec<String> = string_field(&meta, "tools")
                .split(',')
                .map(|tool| tool.trim().to_string())
                .filter(|tool| !tool.is_empty())
                .collect();
            // Owned artifacts are WRITE targets, so an agent with no write tool
            // owns none: without this gate an agent that merely CITES a rule
            // path is published as writing it, because the body scan cannot
            // tell a citation from an ownership claim.
            let can_write = tools.iter().any(|t| t == "Write" || t == "Edit");
            entry.owned_artifacts = Some(if can_write {
                agent_declared_artifacts(&body)
            } else {
                Vec::new()
            });
            entry.tools = Some(tools);
            let (agent_class, routing, public) = agent_contract_fields(&artifact.id);
            entry.agent_class = Some(agent_class);
            entry.routing = Some(routing);
            entry.public = Some(public);
            entry.trigger_owner = Some(trigger_owner(&string_field(&meta, "description")));
            entry.status_reference = Some(if body.contains(STATUS_REFERENCE) {
                "a1"
            } else {
                "none"
            });
        }
        entries.push(entry);
    }

    // A registry key pointing at nothing on disk is a stale registry entry.
    let enumerated: BTreeSet<&str> = refs.iter().map(|r| r.rel.as_str()).collect();
    for key in registry.keys() {
        if !enumerated.contains(key.as_str()) {
            issues.push(InventoryIssue {
                path: key.clone(),
                artifact_type: "unknown".to_string(),
                problem: "registry entry has no matching artifact on disk".to_string(),
            });
        }
    }

    Inventory { entries, issues }
}
