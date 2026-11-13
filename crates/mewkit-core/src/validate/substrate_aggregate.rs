//! Aggregating the inventory by responsibility.
//!
//! Generated on every call from the registry and frontmatter: a hand-maintained
//! map would lie about state, which is the whole reason this is computed rather
//! than committed (the committed VIEW is a rendering of it).
use std::collections::BTreeMap;

use std::path::Path;

use super::inventory::InventoryEntry;
use super::inventory_build::build_inventory;
use super::substrate::{
    Coverage, ResponsibilityRow, SubstrateAggregate, TAXONOMY, responsibility_enum,
};

fn coverage_of(count: usize, active: usize) -> Coverage {
    match (count, active) {
        (0, _) => Coverage::Missing,
        // Served only by deprecated or experimental artifacts.
        (_, 0) => Coverage::Partial,
        _ => Coverage::Covered,
    }
}

pub fn aggregate_substrate(claude_dir: &Path) -> SubstrateAggregate {
    let entries = build_inventory(claude_dir).entries;
    let allowed = responsibility_enum();

    let mut by_responsibility: BTreeMap<String, Vec<&InventoryEntry>> = BTreeMap::new();
    let mut invalid = Vec::new();
    let mut untagged_registry = Vec::new();
    let mut untagged_frontmatter = Vec::new();

    for entry in &entries {
        match entry.responsibility.as_deref() {
            None => {
                if entry.source == "registry" {
                    untagged_registry.push(entry.path.clone());
                } else {
                    untagged_frontmatter.push(entry.path.clone());
                }
            }
            Some(value) if !allowed.iter().any(|a| a == value) => {
                invalid.push((entry.path.clone(), value.to_string()));
            }
            Some(value) => by_responsibility
                .entry(value.to_string())
                .or_default()
                .push(entry),
        }
    }

    let rows = TAXONOMY
        .iter()
        .map(|(value, label, core)| {
            let empty = Vec::new();
            let list = by_responsibility.get(*value).unwrap_or(&empty);
            let active = list.iter().filter(|e| e.status == "active").count();
            ResponsibilityRow {
                value,
                label,
                core: *core,
                coverage: coverage_of(list.len(), active),
                count: list.len(),
                active,
                examples: list.iter().take(3).map(|e| e.id.clone()).collect(),
            }
        })
        .collect();

    SubstrateAggregate {
        rows,
        invalid,
        untagged_registry,
        untagged_frontmatter,
        total_artifacts: entries.len(),
    }
}
