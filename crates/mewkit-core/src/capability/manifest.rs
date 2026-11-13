//! Where the manifest comes from: a live `.claude/` install, or the portable
//! Codex snapshot when that source is absent.
use std::path::{Path, PathBuf};

use serde_json::{Map, Value};

use super::authored::{AUTHORED_DETAILS, CONTEXT_REASONS};
use super::entry::{Entry, Requirement};
use super::invocation::INVOCATION_IDS;
use crate::validate::{CapabilityEntry, build_capabilities, read_frontmatter};

pub const SNAPSHOT_FILENAME: &str = "capabilities.json";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SourceKind {
    ClaudeDirectory,
    CodexSnapshot,
}

pub struct Source {
    pub kind: SourceKind,
    pub path: PathBuf,
    pub entries: Vec<Entry>,
}

fn prov(pairs: &[(&str, &str)]) -> Map<String, Value> {
    pairs
        .iter()
        .map(|(k, v)| ((*k).to_string(), (*v).into()))
        .collect()
}

fn base(reduced: &CapabilityEntry) -> Entry {
    Entry {
        id: reduced.id.clone(),
        kind: reduced.kind.to_string(),
        description: String::new(),
        aliases: reduced.aliases.clone(),
        source_path: reduced.source_path.clone(),
        inventory_id: reduced.inventory_id.clone(),
        owner: reduced.owner.clone(),
        installed_state: "unknown".into(),
        intents: reduced.intents.clone(),
        when_to_use: None,
        invocation_kind: reduced.invocation_kind.to_string(),
        invocation_id: reduced.invocation_id.to_string(),
        requirements: Vec::new(),
        context_requirement: None,
        support: Map::new(),
        verification_kind: "unknown".into(),
        verification_id: None,
        upstream: reduced.upstream.clone(),
        downstream: Vec::new(),
        provenance: Map::new(),
        authored_layout: false,
    }
}

/// A disk-backed entry: description and `when_to_use` come from frontmatter.
fn disk_entry(claude_dir: &Path, reduced: &CapabilityEntry, source_path: &str) -> Entry {
    let mut entry = base(reduced);
    let meta = if matches!(reduced.kind, "skill" | "agent" | "command") {
        read_frontmatter(&claude_dir.join(source_path))
    } else {
        Map::new()
    };
    entry.description = meta
        .get("description")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    entry.when_to_use = meta
        .get("when_to_use")
        .and_then(Value::as_str)
        .map(String::from);
    // A disk-enumerated artifact is installed.
    entry.installed_state = "installed".into();

    let mut p = prov(&[
        ("kind", "inferred"),
        ("owner", "inferred"),
        ("installedState", "inferred"),
        ("invocation", "inferred"),
    ]);
    let mut put = |k: &str, v: &str| p.insert(k.to_string(), v.into());
    if !entry.description.is_empty() {
        put("description", "inferred");
    }
    if entry.when_to_use.is_some() {
        put("whenToUse", "inferred");
    }
    if !entry.upstream.is_empty() {
        put("dependencies", "inferred");
    }
    if reduced.intents_authored {
        put("intents", "authored");
        if !entry.aliases.is_empty() {
            put("aliases", "authored");
        }
    } else if !entry.intents.is_empty() {
        put("intents", "inferred");
    }
    if let Some((_, reason)) = CONTEXT_REASONS.iter().find(|(id, _)| *id == entry.id) {
        entry.context_requirement = Some((*reason).to_string());
        put("contextRequirement", "authored");
    }
    entry.provenance = p;
    entry
}

/// An authored entry: no disk artifact, every field hand-written.
fn authored_entry(reduced: &CapabilityEntry) -> Entry {
    let mut entry = base(reduced);
    entry.authored_layout = true;
    if let Some(detail) = AUTHORED_DETAILS.iter().find(|d| d.id == reduced.id) {
        entry.description = detail.description.to_string();
        entry.when_to_use = detail.when_to_use.map(String::from);
        entry.requirements = detail
            .requirements
            .iter()
            .map(|(kind, id)| Requirement {
                kind: (*kind).to_string(),
                id: (*id).to_string(),
                provenance: "authored".into(),
            })
            .collect();
    }
    let fields = [
        "kind",
        "description",
        "intents",
        "whenToUse",
        "invocation",
        "requirements",
        "owner",
    ];
    entry.provenance = fields
        .iter()
        .map(|f| ((*f).to_string(), "authored".into()))
        .collect();
    entry
}

/// The manifest for an installed `.claude/`, sorted by id.
pub fn build_entries(claude_dir: &Path) -> Vec<Entry> {
    build_capabilities(claude_dir)
        .iter()
        .map(|reduced| match &reduced.source_path {
            Some(path) => disk_entry(claude_dir, reduced, path),
            None => authored_entry(reduced),
        })
        .collect()
}

/// Read and validate a portable snapshot. The messages name the regenerate command.
pub fn read_snapshot(path: &Path) -> Result<Vec<Entry>, String> {
    let regenerate = "Regenerate it with `npx mewkit init --target codex`.";
    let display = path.display();
    let raw: Value = std::fs::read(path)
        .map_err(|e| e.to_string())
        .and_then(|bytes| serde_json::from_slice(&bytes).map_err(|e| e.to_string()))
        .map_err(|detail| {
            format!("Could not read capability snapshot at {display}: {detail}. {regenerate}")
        })?;
    let invalid = |detail: String| {
        format!("Capability snapshot at {display} is invalid: {detail}. {regenerate}")
    };
    if raw.get("schemaVersion").and_then(Value::as_str) != Some("1.0") {
        return Err(invalid("Invalid literal value, expected \"1.0\"".into()));
    }
    let list = raw
        .get("entries")
        .and_then(Value::as_array)
        .ok_or_else(|| invalid("Required".into()))?;
    let mut entries = Vec::new();
    for value in list {
        entries.push(Entry::from_snapshot(value).map_err(invalid)?);
    }
    for entry in &entries {
        if !INVOCATION_IDS.contains(&entry.invocation_id.as_str()) {
            return Err(format!(
                "Capability snapshot at {display} contains unknown invocation id for {}. {regenerate}",
                entry.id
            ));
        }
    }
    Ok(entries)
}

/// A live `.claude/` is canonical; a Codex snapshot is only the portable
/// projection when that source surface is absent.
pub fn find_source(cwd: &Path, home: Option<&Path>) -> Result<Option<Source>, String> {
    let claude = cwd.join(".claude");
    if claude.is_dir() {
        let entries = build_entries(&claude);
        return Ok(Some(Source {
            kind: SourceKind::ClaudeDirectory,
            path: claude,
            entries,
        }));
    }
    let candidates = [Some(cwd.join(".codex")), home.map(|h| h.join(".codex"))];
    for dir in candidates.into_iter().flatten() {
        let path = dir.join(SNAPSHOT_FILENAME);
        if path.exists() {
            let entries = read_snapshot(&path)?;
            return Ok(Some(Source {
                kind: SourceKind::CodexSnapshot,
                path,
                entries,
            }));
        }
    }
    Ok(None)
}
