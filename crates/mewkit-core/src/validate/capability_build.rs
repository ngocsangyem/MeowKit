//! Building the manifest from an installed `.claude/`.
//!
//! Every disk-enumerated invocable-kind artifact yields exactly one capability
//! keyed by its path; the authored tool and service entries are appended. Owner
//! and installed-state are denormalized from the inventory so a resolved entry
//! can be read on its own — and the validation asserts they still agree.
use std::path::Path;

use serde_json::Value;

use super::capabilities::CapabilityEntry;
use super::capability_authored::{AUTHORED_CAPABILITIES, authored_overlay};
use super::inventory_build::build_inventory;
use super::inventory_enumerate::{ArtifactType, MetaSource, enumerate_artifacts};
use super::inventory_read::read_frontmatter;

/// The capability kind for a disk artifact type. `rule` is absent on purpose.
fn kind_of(artifact_type: ArtifactType) -> Option<&'static str> {
    match artifact_type {
        ArtifactType::Skill => Some("skill"),
        ArtifactType::Agent => Some("agent"),
        ArtifactType::Command => Some("command"),
        ArtifactType::Hook => Some("hook"),
        ArtifactType::Rule => None,
    }
}

/// The logical invocation contract per kind. Adapters map these ids to constant
/// provider operations; no command string ever comes from frontmatter.
fn invocation_for(kind: &str) -> (&'static str, &'static str) {
    match kind {
        "skill" => ("skill", "invoke-skill"),
        "agent" => ("agent", "invoke-agent"),
        "command" => ("command", "invoke-command"),
        "workflow" => ("workflow", "invoke-workflow"),
        "hook" => ("hook", "lifecycle-hook"),
        _ => ("none", "none"),
    }
}

/// Bounded intent terms inferred from a skill's `keywords` frontmatter.
fn inferred_intents(meta: &serde_json::Map<String, Value>) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for keyword in meta
        .get("keywords")
        .and_then(Value::as_array)
        .unwrap_or(&Vec::new())
        .iter()
        .filter_map(Value::as_str)
    {
        let lowered = keyword.to_lowercase();
        if !out.contains(&lowered) {
            out.push(lowered);
        }
    }
    out
}

pub fn build_capabilities(claude_dir: &Path) -> Vec<CapabilityEntry> {
    let (refs, _) = enumerate_artifacts(claude_dir);
    let inventory = build_inventory(claude_dir);
    let mut entries: Vec<CapabilityEntry> = Vec::new();

    for artifact in &refs {
        let Some(kind) = kind_of(artifact.artifact_type) else {
            continue;
        };
        let meta = match artifact.meta_source {
            MetaSource::Frontmatter => read_frontmatter(&artifact.abs),
            MetaSource::Registry => serde_json::Map::new(),
        };
        let inventory_entry = inventory
            .entries
            .iter()
            .find(|entry| entry.path == artifact.rel);
        let (intents, aliases, intents_authored) = match authored_overlay(&artifact.id) {
            Some((intents, aliases)) => (
                intents.iter().map(|s| (*s).to_string()).collect(),
                aliases.iter().map(|s| (*s).to_string()).collect(),
                true,
            ),
            None => (inferred_intents(&meta), Vec::new(), false),
        };
        let (invocation_kind, invocation_id) = invocation_for(kind);
        entries.push(CapabilityEntry {
            id: artifact.id.clone(),
            kind,
            aliases,
            source_path: Some(artifact.rel.clone()),
            inventory_id: Some(
                inventory_entry
                    .map(|entry| entry.id.clone())
                    .unwrap_or_else(|| artifact.id.clone()),
            ),
            owner: inventory_entry
                .map(|entry| entry.owner.clone())
                .unwrap_or_default(),
            intents,
            invocation_kind,
            invocation_id,
            upstream: inventory_entry
                .map(|entry| entry.depends_on.clone())
                .unwrap_or_default(),
            intents_authored,
        });
    }

    for authored in AUTHORED_CAPABILITIES {
        entries.push(CapabilityEntry {
            id: authored.id.to_string(),
            kind: authored.kind,
            aliases: Vec::new(),
            source_path: None,
            inventory_id: None,
            owner: "integration".to_string(),
            intents: authored.intents.iter().map(|s| (*s).to_string()).collect(),
            invocation_kind: "none",
            invocation_id: "none",
            upstream: Vec::new(),
            intents_authored: true,
        });
    }

    entries.sort_by(|a, b| a.id.cmp(&b.id));
    entries
}
