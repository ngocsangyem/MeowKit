//! Reading one artifact's governance record: frontmatter, or the registry.
//!
//! Both are tolerant on purpose — a malformed block reads as ABSENT, and the
//! caller reports "no governance metadata" against the artifact rather than
//! stopping the whole inventory on one bad file.
use std::path::Path;

use serde_json::{Map, Value};

/// The YAML frontmatter block of a markdown file as a JSON object, or empty.
///
/// Empty on ANY failure (unreadable, no block, not a mapping) — the same
/// tolerance the TypeScript has, because a malformed block is reported as
/// missing GOVERNANCE by the caller rather than as a crash here.
pub fn read_frontmatter(abs: &Path) -> Map<String, Value> {
    let Ok(bytes) = std::fs::read(abs) else {
        return Map::new();
    };
    let body = String::from_utf8_lossy(&bytes);
    match crate::yaml_doc::parse_frontmatter(&body) {
        Ok(frontmatter) => frontmatter.map().cloned().unwrap_or_default(),
        Err(_) => Map::new(),
    }
}

/// The central registry's `artifacts` map, for rules and hooks.
pub fn read_registry(claude_dir: &Path) -> Map<String, Value> {
    let root = claude_dir.parent().unwrap_or(claude_dir);
    let path = super::routing_breadth::resolve_inventory_path(root);
    let Ok(text) = std::fs::read_to_string(path) else {
        return Map::new();
    };
    let Ok(parsed) = serde_json::from_str::<Value>(&text) else {
        return Map::new();
    };
    parsed
        .get("artifacts")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default()
}
