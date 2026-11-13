//! The canonical "what counts" enumeration, and the frontmatter reader.
//!
//! Every check that asks "which artifacts does this install have" comes through
//! here — the ownership check, the stale-index counts, the substrate aggregate,
//! the pack coverage and the capability manifest. Re-deriving the rule anywhere
//! else is how a doc count and the thing it counts drift apart, so nothing does.
//! Port of the enumeration half of `core/build-inventory.ts`.
use std::path::{Path, PathBuf};

use serde_json::Value;

use super::dir_order::{sorted_entries, sorted_names};
use super::hooks::is_hook_script;
use super::inventory_read::read_frontmatter;

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum ArtifactType {
    Skill,
    Agent,
    Rule,
    Command,
    Hook,
}

impl ArtifactType {
    pub fn as_str(self) -> &'static str {
        match self {
            ArtifactType::Skill => "skill",
            ArtifactType::Agent => "agent",
            ArtifactType::Rule => "rule",
            ArtifactType::Command => "command",
            ArtifactType::Hook => "hook",
        }
    }
}

/// Where one artifact's governance metadata comes from.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MetaSource {
    Frontmatter,
    Registry,
}

impl MetaSource {
    pub fn as_str(self) -> &'static str {
        match self {
            MetaSource::Frontmatter => "frontmatter",
            MetaSource::Registry => "registry",
        }
    }
}

#[derive(Clone, Debug)]
pub struct ArtifactRef {
    pub artifact_type: ArtifactType,
    /// Path relative to `.claude/`, always `/`-joined.
    pub rel: String,
    pub abs: PathBuf,
    pub id: String,
    pub meta_source: MetaSource,
}

/// A structural or metadata problem, surfaced rather than skipped.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct InventoryIssue {
    pub path: String,
    /// The artifact type, or `unknown` for a structural anomaly.
    pub artifact_type: String,
    pub problem: String,
}

/// Runtime/tooling directories that are never harness artifacts.
const DENYLIST_DIRS: [&str; 3] = [".venv", "__pycache__", "node_modules"];

fn markdown_names(dir: &Path) -> Vec<String> {
    sorted_names(dir)
        .into_iter()
        .filter(|name| name.ends_with(".md"))
        .collect()
}

/// Artifact references plus any structural anomaly. Counting is presence-based.
pub fn enumerate_artifacts(claude_dir: &Path) -> (Vec<ArtifactRef>, Vec<InventoryIssue>) {
    let mut refs = Vec::new();
    let mut issues = Vec::new();

    // Skills — subdirectories carrying a SKILL.md.
    let skills_dir = claude_dir.join("skills");
    for entry in sorted_entries(&skills_dir) {
        let name = entry.file_name().to_string_lossy().into_owned();
        if DENYLIST_DIRS.contains(&name.as_str()) || !entry.path().is_dir() {
            continue;
        }
        let skill_md = entry.path().join("SKILL.md");
        if skill_md.exists() {
            let meta = read_frontmatter(&skill_md);
            let id = meta
                .get("name")
                .and_then(Value::as_str)
                .unwrap_or(&name)
                .to_string();
            refs.push(ArtifactRef {
                artifact_type: ArtifactType::Skill,
                rel: format!("skills/{name}/SKILL.md"),
                abs: skill_md,
                id,
                meta_source: MetaSource::Frontmatter,
            });
        } else {
            issues.push(InventoryIssue {
                path: format!("skills/{name}"),
                artifact_type: "unknown".to_string(),
                problem: "skill directory has no SKILL.md (not a known runtime dir)".to_string(),
            });
        }
    }

    // Agents — `*.md` except the generated indexes.
    let agents_dir = claude_dir.join("agents");
    for file in markdown_names(&agents_dir) {
        if file.ends_with("_INDEX.md") {
            continue;
        }
        refs.push(ArtifactRef {
            artifact_type: ArtifactType::Agent,
            rel: format!("agents/{file}"),
            abs: agents_dir.join(&file),
            id: file.trim_end_matches(".md").to_string(),
            meta_source: MetaSource::Frontmatter,
        });
    }

    // Rules — registry-sourced.
    let rules_dir = claude_dir.join("rules");
    for file in markdown_names(&rules_dir) {
        refs.push(ArtifactRef {
            artifact_type: ArtifactType::Rule,
            rel: format!("rules/{file}"),
            abs: rules_dir.join(&file),
            id: file.trim_end_matches(".md").to_string(),
            meta_source: MetaSource::Registry,
        });
    }

    // Hooks — two tiers, because both are hooks: the entrypoints the host
    // registers live at `hooks/`, and the observers the dispatcher runs live at
    // `hooks/handlers/`. Counting only the top level silently shrank the set the
    // moment the observers moved, and left every doc count claiming a number
    // nothing produced. `is_hook_script` is the single definition of "a hook".
    for rel_dir in ["hooks", "hooks/handlers"] {
        let dir = rel_dir
            .split('/')
            .fold(claude_dir.to_path_buf(), |acc, part| acc.join(part));
        if !dir.exists() {
            continue;
        }
        for file in sorted_names(&dir) {
            let abs = dir.join(&file);
            if !is_hook_script(&abs) {
                continue;
            }
            let id = ["cjs", "mjs", "js", "sh"]
                .iter()
                .find_map(|ext| file.strip_suffix(&format!(".{ext}")))
                .unwrap_or(&file)
                .to_string();
            refs.push(ArtifactRef {
                artifact_type: ArtifactType::Hook,
                rel: format!("{rel_dir}/{file}"),
                abs,
                id,
                meta_source: MetaSource::Registry,
            });
        }
    }

    (refs, issues)
}
