//! Reading one artifact's declared dependency edges.
//!
//! Split from the builder because this is the only part of a record that can be
//! WRONG rather than missing: an unknown edge type, two types for one id, or a
//! legacy list that disagrees with the typed edges. Each becomes an issue
//! naming the artifact.
use serde_json::{Map, Value};

use super::inventory::{DEPENDENCY_EDGE_TYPES, DependencyEdge};
use super::inventory_enumerate::InventoryIssue;

/// Typed dependency edges, with an invalid or self-contradicting entry reported.
pub(super) fn dependency_edges(
    meta: &Map<String, Value>,
    issues: &mut Vec<InventoryIssue>,
    artifact_path: &str,
) -> Vec<DependencyEdge> {
    let Some(raw) = meta.get("dependency_edges").and_then(Value::as_array) else {
        return Vec::new();
    };
    let mut edges: Vec<DependencyEdge> = Vec::new();
    let mut types_by_id: Vec<(String, String)> = Vec::new();
    for (index, entry) in raw.iter().enumerate() {
        let id = entry.get("id").and_then(Value::as_str).unwrap_or_default();
        let edge_type = entry
            .get("type")
            .and_then(Value::as_str)
            .unwrap_or_default();
        if id.trim().is_empty() || !DEPENDENCY_EDGE_TYPES.contains(&edge_type) {
            issues.push(InventoryIssue {
                path: artifact_path.to_string(),
                artifact_type: "unknown".to_string(),
                problem: format!("invalid dependency_edges[{index}]"),
            });
            continue;
        }
        match types_by_id.iter().find(|(known, _)| known == id) {
            Some((_, prior)) if prior != edge_type => {
                issues.push(InventoryIssue {
                    path: artifact_path.to_string(),
                    artifact_type: "unknown".to_string(),
                    problem: format!("conflicting dependency_edges types for \"{id}\""),
                });
            }
            Some(_) => {}
            None => {
                types_by_id.push((id.to_string(), edge_type.to_string()));
                edges.push(DependencyEdge {
                    id: id.to_string(),
                    edge_type: edge_type.to_string(),
                });
            }
        }
    }
    edges
}

pub(super) fn string_list(meta: &Map<String, Value>, key: &str) -> Vec<String> {
    meta.get(key)
        .and_then(Value::as_array)
        .map(|values| {
            values
                .iter()
                .filter_map(Value::as_str)
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default()
}
