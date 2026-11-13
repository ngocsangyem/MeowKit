//! Unresolved pseudo-capability aliases: prose naming an operation in a
//! template form that was never substituted.
//!
//! Why it fails rather than warns: the string READS as if it means something.
//! An agent following "use the `manage_plan` capability" looks for a
//! "manage_plan capability", finds nothing, and improvises — which is the
//! failure the operation table exists to prevent. It is a broken instruction
//! indistinguishable from a working one until an agent acts on it.
//!
//! Scope is deliberately narrow: the four operation names immediately followed
//! by the word "capability". That phrase has no legitimate use, so any
//! occurrence is an unsubstituted placeholder. A broader "looks like a dangling
//! reference" check was evaluated and rejected — every candidate it flagged in
//! this tree was legitimate prose, and a gate that only cries wolf gets
//! switched off. Port of `core/check-pseudo-capabilities.ts`.
use std::path::Path;
use std::sync::LazyLock;

use regex::Regex;

use super::operations::LOGICAL_OPERATIONS;

/// Suppression marker for prose that must quote the anti-pattern.
const ALLOW_MARKER: &str = "lint-allow-pseudo-capability";

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PseudoCapabilityFinding {
    /// Path relative to the scanned root.
    pub file: String,
    /// 1-based.
    pub line: usize,
    pub found: String,
}

/// Built from the operation list so the two cannot drift: a new operation is
/// covered the day it is added.
static PSEUDO_CAPABILITY: LazyLock<Regex> = LazyLock::new(|| {
    crate::js_regex::compile_ci(&format!(
        r"\b({})\s+capability\b",
        LOGICAL_OPERATIONS.join("|")
    ))
    .expect("a pattern built from the operation list")
});

/// Scan one file's prose. At most one finding per line, as the TypeScript's
/// single `exec` gives.
pub fn scan_for_pseudo_capabilities(root: &Path, rel_path: &str) -> Vec<PseudoCapabilityFinding> {
    let abs = rel_path
        .split('/')
        .fold(root.to_path_buf(), |acc, part| acc.join(part));
    let Ok(bytes) = std::fs::read(&abs) else {
        return Vec::new();
    };
    let content = String::from_utf8_lossy(&bytes).into_owned();
    content
        .split('\n')
        .enumerate()
        .filter(|(_, text)| !text.contains(ALLOW_MARKER))
        .filter_map(|(index, text)| {
            PSEUDO_CAPABILITY
                .find(text)
                .map(|found| PseudoCapabilityFinding {
                    file: rel_path.to_string(),
                    line: index + 1,
                    found: found.as_str().to_string(),
                })
        })
        .collect()
}

/// Every `.md` under `dir`, relative to `root`.
fn collect_prose(root: &Path, dir: &str, acc: &mut Vec<String>) {
    let abs = if dir == "." {
        root.to_path_buf()
    } else {
        dir.split('/')
            .fold(root.to_path_buf(), |acc, part| acc.join(part))
    };
    for entry in super::dir_order::sorted_entries(&abs) {
        let name = entry.file_name().to_string_lossy().into_owned();
        let rel = if dir == "." {
            name.clone()
        } else {
            format!("{dir}/{name}")
        };
        if entry.path().is_dir() {
            if name == "node_modules" || name.starts_with(".git") {
                continue;
            }
            collect_prose(root, &rel, acc);
        } else if entry.path().is_file() && name.ends_with(".md") {
            acc.push(rel);
        }
    }
}

/// Scan a projected tree. The caller decides severity: a plugin build throws,
/// `validate` reports.
pub fn find_pseudo_capabilities(root: &Path) -> Vec<PseudoCapabilityFinding> {
    let mut files = Vec::new();
    collect_prose(root, ".", &mut files);
    files
        .iter()
        .flat_map(|rel| scan_for_pseudo_capabilities(root, rel))
        .collect()
}

#[cfg(test)]
#[path = "pseudo_capabilities_tests.rs"]
mod pseudo_capabilities_tests;
