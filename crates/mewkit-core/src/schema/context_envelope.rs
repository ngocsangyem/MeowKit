//! The task-scoped repository-context envelope: what source was read, which
//! repo owned it, and at which revision.
//!
//! The boundary root is the task's container (it may hold many repos) and is
//! deliberately NOT a repository itself — every evidence ref names its OWN
//! owning repo and revision, so multi-repo context is never collapsed into one
//! identity, and a missing revision stays missing rather than being borrowed
//! from a sibling.

use std::path::{Component, Path};

use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::{Validation, parse_with, quote};

/// Where an evidence ref came from. `host-read` is a direct read; `host-search`
/// is a match the host's search surface returned.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum EvidenceProvenance {
    #[default]
    HostRead,
    HostSearch,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvidenceRef {
    pub path: String,
    /// SHA-256 of the content at record time, or `null` when the file was missing.
    pub content_hash: Option<String>,
    pub owning_repo_identity: String,
    pub revision: Option<String>,
    #[serde(default)]
    pub provenance: EvidenceProvenance,
    /// True when the path is secret-shaped and its content must not be
    /// persisted verbatim.
    #[serde(default)]
    pub redacted: bool,
}

pub const CONTEXT_ENVELOPE_SCHEMA_VERSION: &str = "1.0";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContextEnvelope {
    pub schema_version: String,
    pub boundary_root: String,
    #[serde(default)]
    pub evidence: Vec<EvidenceRef>,
    #[serde(default)]
    pub query_descriptor: String,
    #[serde(default)]
    pub tool_descriptor: String,
    pub timestamp: String,
    #[serde(default)]
    pub omissions: Vec<String>,
}

impl ContextEnvelope {
    pub fn validate(&self) -> Validation {
        let mut errors = Vec::new();
        if self.schema_version != CONTEXT_ENVELOPE_SCHEMA_VERSION {
            errors.push(format!(
                "schemaVersion: must be {}",
                quote(CONTEXT_ENVELOPE_SCHEMA_VERSION)
            ));
        }
        Validation::new(errors)
    }

    pub fn parse(value: &Value) -> Result<Self, Vec<String>> {
        parse_with(value, |e: &Self| e.validate())
    }

    /// The DISTINCT owning repos of this envelope's evidence, sorted by
    /// identity.
    ///
    /// The FIRST ref's revision wins for a repo already seen, matching
    /// `distinctRepos` in `core/repo-context.ts`
    /// (`if (!byIdentity.has(...)) byIdentity.set(...)`). A task record's
    /// `repos[].revision` is read by both CLIs, so taking the last ref's
    /// revision here would make the same envelope describe two different
    /// revisions depending on which binary read it.
    pub fn distinct_repos(&self) -> Vec<(String, Option<String>)> {
        let mut out: Vec<(String, Option<String>)> = Vec::new();
        for e in &self.evidence {
            if !out.iter().any(|(id, _)| *id == e.owning_repo_identity) {
                out.push((e.owning_repo_identity.clone(), e.revision.clone()));
            }
        }
        out.sort_by(|a, b| a.0.cmp(&b.0));
        out
    }
}

/// Whether `target` stays inside `boundary_root`.
///
/// Lexical, like the TS predicate it ports: the caller resolves symlinks first
/// when the answer must survive one (a symlink at an in-project path pointing
/// out of the tree is a real escape, and only a realpath catches it).
pub fn is_within_boundary(boundary_root: &Path, target: &Path) -> bool {
    let (Ok(root), Ok(abs)) = (absolutize(boundary_root), absolutize(target)) else {
        return false;
    };
    abs.starts_with(&root)
}

/// `path::resolve` for a possibly-relative path, with `.` and `..` folded away
/// so `starts_with` answers about the real location rather than the spelling.
fn absolutize(path: &Path) -> std::io::Result<std::path::PathBuf> {
    let base = if path.is_absolute() {
        path.to_path_buf()
    } else {
        std::env::current_dir()?.join(path)
    };
    let mut out = std::path::PathBuf::new();
    for component in base.components() {
        match component {
            Component::CurDir => {}
            Component::ParentDir => {
                out.pop();
            }
            other => out.push(other),
        }
    }
    Ok(out)
}

#[cfg(test)]
#[path = "context_envelope_tests.rs"]
mod tests;
