//! The machine record of every runtime fact the reference docs restate.
//!
//! The point is drift detection, not a second inventory. Each entry carries the
//! source path and a hash of the file it came from, so editing a `SKILL.md`
//! changes the manifest, and a manifest that no longer matches its committed
//! copy means the docs were not regenerated.
//!
//! `visibility` has no default: `internal` when the artifact declares it,
//! `public` when a reference page documents it, `unclassified` otherwise — and
//! the docs coverage gate rejects an artifact with no page, which is what makes
//! classification fail closed.
use std::path::Path;

use regex::Regex;
use serde::Serialize;
use serde_json::{Map, Value};

use super::locale_order::locale_compare;
use crate::validate::{InventoryEntry, build_inventory, read_frontmatter};

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocsReferenceEntry {
    pub id: String,
    pub kind: String,
    pub title: String,
    pub description: String,
    pub source_path: String,
    pub source_hash: String,
    pub aliases: Vec<String>,
    pub owner: String,
    /// Only when the artifact declares one: `None` means undeclared, not
    /// "not phase-anchored" — most agent pages document a phase no frontmatter
    /// carries, so defaulting would assert the opposite of the truth.
    pub phase: Option<String>,
    pub runtime: String,
    pub visibility: String,
    /// `criticality` in the inventory; named for what it measures.
    pub risk: String,
    pub dependencies: Vec<String>,
    /// Paths the artifact declares it writes.
    pub output: Vec<String>,
    /// Only ever a declared value: a generated timestamp would assert a check
    /// nobody ran.
    pub last_verified: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocsReferenceManifest {
    pub schema_version: &'static str,
    pub entries: Vec<DocsReferenceEntry>,
}

/// Turn `plan-creator` into `Plan Creator` when nothing declares a title.
fn humanize(id: &str) -> String {
    id.split('-')
        .map(|word| {
            let mut chars = word.chars();
            chars.next().map_or_else(String::new, |first| {
                first.to_uppercase().chain(chars).collect::<String>()
            })
        })
        .collect::<Vec<_>>()
        .join(" ")
}

/// The reference page's filename stem for an artifact. Derived from the source
/// path, not the id, because the id carries a namespace (`mk:cook`) that the
/// page filename (`cook.mdx`) does not — and the coverage gate maps it the
/// same way, so manifest and gate cannot disagree on whether it is documented.
pub fn page_slug(source_path: &str, kind: &str) -> String {
    let parts: Vec<&str> = source_path.split(['/', '\\']).collect();
    if kind == "skill" {
        parts
            .len()
            .checked_sub(2)
            .and_then(|i| parts.get(i))
            .copied()
            .unwrap_or("")
            .to_string()
    } else {
        let last = parts.last().copied().unwrap_or("");
        last.strip_suffix(".md").unwrap_or(last).to_string()
    }
}

fn string_field(meta: &Map<String, Value>, key: &str) -> Option<String> {
    let value = meta.get(key)?.as_str()?.trim();
    (!value.is_empty()).then(|| value.to_string())
}

/// A scalar that may legitimately be unquoted YAML: `phase: 3` parses as a
/// number, and a string-only reader would record "undeclared" for it.
fn scalar_field(meta: &Map<String, Value>, key: &str) -> Option<String> {
    match meta.get(key) {
        Some(Value::Number(n)) => Some(n.to_string()),
        Some(Value::Bool(b)) => Some(b.to_string()),
        _ => string_field(meta, key),
    }
}

fn string_list(meta: &Map<String, Value>, key: &str) -> Vec<String> {
    meta.get(key)
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default()
}

/// Keep only inventory ownership values that are actually paths. That parser
/// reads an agent's prose declaration and on several agents captures whole
/// fenced blocks and example commands; recording those would publish a parse
/// failure as a fact (and one broke the MDX build over `<args>`). Anything with
/// whitespace, backticks or angle brackets is dropped, never "cleaned".
fn owned_paths(values: &[String]) -> Vec<String> {
    let shape = Regex::new(r"^[^\s`<>\n]+$").expect("a static pattern");
    let mut kept: Vec<String> = values
        .iter()
        .filter(|v| v.encode_utf16().count() <= 120 && shape.is_match(v) && v.contains(['/', '.']))
        .cloned()
        .collect();
    kept.sort();
    kept.dedup();
    kept
}

/// An explicit `visibility:` wins; otherwise a reference page is the evidence.
/// `user-invocable: false` is NOT read as internal — not directly invocable
/// means auto-invoked, not secret.
fn resolve_visibility(meta: &Map<String, Value>, has_page: bool) -> &'static str {
    match string_field(meta, "visibility").as_deref() {
        Some("internal") => "internal",
        Some("public") => "public",
        _ if has_page => "public",
        _ => "unclassified",
    }
}

fn entry_for(
    inv: &InventoryEntry,
    kind: &str,
    claude_dir: &Path,
    reference_dir: Option<&Path>,
) -> DocsReferenceEntry {
    let abs = claude_dir.join(&inv.path);
    let meta = read_frontmatter(&abs);
    let has_page = reference_dir.is_some_and(|dir| {
        dir.join(format!("{kind}s"))
            .join(format!("{}.mdx", page_slug(&inv.path, kind)))
            .exists()
    });
    let mut dependencies = inv.depends_on.clone();
    dependencies.sort();
    DocsReferenceEntry {
        id: inv.id.clone(),
        kind: kind.to_string(),
        title: string_field(&meta, "title")
            .or_else(|| string_field(&meta, "name"))
            .unwrap_or_else(|| humanize(&inv.id)),
        description: string_field(&meta, "description").unwrap_or_default(),
        source_path: inv.path.clone(),
        source_hash: std::fs::read(&abs)
            .map(|bytes| super::line_endings::source_hash(&bytes))
            .unwrap_or_default(),
        aliases: string_list(&meta, "aliases"),
        owner: inv.owner.clone(),
        phase: scalar_field(&meta, "phase"),
        runtime: inv.runtime.clone(),
        visibility: resolve_visibility(&meta, has_page).to_string(),
        risk: inv.criticality.clone(),
        dependencies,
        output: owned_paths(inv.owned_artifacts.as_deref().unwrap_or_default()),
        last_verified: string_field(&meta, "last_verified"),
    }
}

/// Build the manifest for an installed `.claude/`. `reference_dir` is
/// `content/docs/reference` when the docs package is present; `None` in a
/// consumer checkout, where every artifact resolves `unclassified` rather than
/// silently claiming to be public.
pub fn build_docs_reference_manifest(
    claude_dir: &Path,
    reference_dir: Option<&Path>,
) -> DocsReferenceManifest {
    let mut entries: Vec<DocsReferenceEntry> = build_inventory(claude_dir)
        .entries
        .iter()
        .filter(|inv| inv.artifact_type == "skill" || inv.artifact_type == "agent")
        .map(|inv| entry_for(inv, &inv.artifact_type, claude_dir, reference_dir))
        .collect();
    entries.sort_by(|a, b| {
        a.kind
            .cmp(&b.kind)
            .then_with(|| locale_compare(&a.id, &b.id))
    });
    DocsReferenceManifest {
        schema_version: "1.0",
        entries,
    }
}

/// Stable serialization: the committed copy is diffed byte-for-byte, so the
/// formatting (two-space indent, trailing newline) is part of the contract.
pub fn serialize_docs_reference_manifest(manifest: &DocsReferenceManifest) -> String {
    let mut text = serde_json::to_string_pretty(manifest).expect("a plain data structure");
    text.push('\n');
    text
}
