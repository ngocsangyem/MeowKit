//! The capability invariants, in the order the npm CLI reports them.
//!
//! ERROR = a broken contract (cross-ref, containment, uniqueness, unknown
//! invocation id, dependency cycle). WARN = a coverage or authoring smell
//! (uncovered artifact, duplicate intent, dangling dependency, dead overlay
//! key). No check ever executes a script or trusts a command string.
use std::collections::BTreeMap;

use super::capabilities::{CapabilityEntry, CapabilityIssue, IssueLevel, KNOWN_INVOCATION_IDS};
use super::capability_authored::{AUTHORED_CONTEXT_REQUIREMENTS, AUTHORED_INTENTS};
use super::inventory::InventoryEntry;

fn error(id: Option<&str>, message: String) -> CapabilityIssue {
    CapabilityIssue {
        level: IssueLevel::Error,
        capability_id: id.map(str::to_string),
        message,
    }
}

fn warn(id: Option<&str>, message: String) -> CapabilityIssue {
    CapabilityIssue {
        level: IssueLevel::Warn,
        capability_id: id.map(str::to_string),
        message,
    }
}

/// Pure validation over a built manifest plus the inventory.
pub(super) fn validate_capability_entries(
    entries: &[CapabilityEntry],
    inventory: &[InventoryEntry],
    find_cycle: impl Fn(&[CapabilityEntry]) -> Option<Vec<String>>,
    is_contained: impl Fn(&str) -> bool,
) -> Vec<CapabilityIssue> {
    let mut issues = Vec::new();
    let mut capability_ids: Vec<&str> = Vec::new();
    let mut alias_owners: Vec<(&str, &str)> = Vec::new();
    // Insertion-ordered, because the duplicate-intent WARNs are printed in the
    // order the intents were first seen.
    let mut intent_owners: Vec<(&str, Vec<&str>)> = Vec::new();

    for capability in entries {
        if capability_ids.contains(&capability.id.as_str()) {
            issues.push(error(
                Some(&capability.id),
                "duplicate capability id".to_string(),
            ));
        }
        capability_ids.push(&capability.id);

        if let Some(source_path) = &capability.source_path
            && !is_contained(source_path)
        {
            issues.push(error(
                Some(&capability.id),
                format!("sourcePath escapes .claude/: {source_path}"),
            ));
        }

        if let (Some(inventory_id), Some(_)) = (&capability.inventory_id, &capability.source_path) {
            match inventory.iter().find(|entry| &entry.id == inventory_id) {
                None => issues.push(error(
                    Some(&capability.id),
                    format!("inventoryId has no matching inventory entry: {inventory_id}"),
                )),
                Some(entry)
                    if !entry.owner.is_empty()
                        && !capability.owner.is_empty()
                        && entry.owner != capability.owner =>
                {
                    issues.push(error(
                        Some(&capability.id),
                        format!(
                            "denormalized owner \"{}\" disagrees with inventory \"{}\"",
                            capability.owner, entry.owner
                        ),
                    ));
                }
                Some(_) => {}
            }
        }

        if !KNOWN_INVOCATION_IDS.contains(&capability.invocation_id) {
            issues.push(error(
                Some(&capability.id),
                format!("unknown invocation id: {}", capability.invocation_id),
            ));
        }

        for alias in &capability.aliases {
            if let Some((_, prior)) = alias_owners.iter().find(|(key, _)| key == alias)
                && *prior != capability.id.as_str()
            {
                issues.push(error(
                    Some(&capability.id),
                    format!("alias \"{alias}\" also on {prior}"),
                ));
            }
            alias_owners.push((alias, &capability.id));
        }

        for intent in &capability.intents {
            match intent_owners.iter_mut().find(|(key, _)| key == intent) {
                Some((_, owners)) => owners.push(&capability.id),
                None => intent_owners.push((intent, vec![&capability.id])),
            }
        }
    }

    for (intent, owners) in &intent_owners {
        if owners.len() > 1 {
            issues.push(warn(
                None,
                format!(
                    "intent \"{intent}\" maps to multiple capabilities: {}",
                    owners.join(", ")
                ),
            ));
        }
    }

    for capability in entries {
        for dependency in &capability.upstream {
            if !capability_ids.contains(&dependency.as_str()) {
                issues.push(warn(
                    Some(&capability.id),
                    format!("upstream dependency has no matching capability: {dependency}"),
                ));
            }
        }
    }

    // Coverage: every enumerated invocable-kind artifact should have a
    // capability. Rules are inventory-only context and are skipped.
    let covered: Vec<&str> = entries
        .iter()
        .filter_map(|entry| entry.inventory_id.as_deref())
        .collect();
    for entry in inventory {
        if entry.artifact_type == "rule" {
            continue;
        }
        if !covered.contains(&entry.id.as_str()) {
            issues.push(warn(
                None,
                format!("inventory artifact has no capability: {}", entry.path),
            ));
        }
    }

    if let Some(cycle) = find_cycle(entries) {
        issues.push(error(
            None,
            format!("dependency cycle: {}", cycle.join(" → ")),
        ));
    }

    // A dead overlay key: expected on a partial consumer install that omits a
    // flagship skill, but on a full authoring install it means a rename
    // silently dropped curated intents.
    for (key, _, _) in AUTHORED_INTENTS {
        if !capability_ids.contains(&key) {
            issues.push(warn(
                Some(key),
                format!(
                    "AUTHORED_INTENTS key has no matching capability (partial install or renamed skill): {key}"
                ),
            ));
        }
    }
    for key in AUTHORED_CONTEXT_REQUIREMENTS {
        if !capability_ids.contains(&key) {
            issues.push(warn(
                Some(key),
                format!(
                    "AUTHORED_CONTEXT_REQUIREMENTS key has no matching capability (partial install or renamed skill): {key}"
                ),
            ));
        }
    }

    let _ = BTreeMap::<&str, ()>::new();
    issues
}
