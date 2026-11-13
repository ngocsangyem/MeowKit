//! Do the counts the docs DECLARE match the inventory?
//!
//! A count drift or a missing index row turns the build red with a precise
//! diff. Discovery rules are not re-derived here — they come from the
//! inventory, so declared docs reconcile with reality by construction. Port of
//! `core/check-stale-index.ts`.
//!
//! The docs site is deliberately absent from the spec list: its pages state
//! capabilities without counting them, because a count in evergreen prose is a
//! fact with an expiry date. A drift check against a claim that was withdrawn
//! on purpose would report the withdrawal as drift, forever.
use std::path::Path;

use regex::Regex;

use super::inventory::InventoryEntry;
use super::inventory_build::build_inventory;
use super::result::{CheckResult, Section, Status};
use super::stale_index_specs::count_specs;

pub(super) struct Counts {
    pub(super) skills: Vec<InventoryEntry>,
    pub(super) agents: Vec<InventoryEntry>,
    pub(super) rules: Vec<InventoryEntry>,
    pub(super) hooks: Vec<InventoryEntry>,
}

pub(super) fn actual_counts(claude_dir: &Path) -> Counts {
    let entries = build_inventory(claude_dir).entries;
    let of_type = |wanted: &str| -> Vec<InventoryEntry> {
        entries
            .iter()
            .filter(|entry| entry.artifact_type == wanted)
            .cloned()
            .collect()
    };
    Counts {
        skills: of_type("skill"),
        agents: of_type("agent"),
        rules: of_type("rule")
            .into_iter()
            .filter(|entry| entry.path.starts_with("rules/"))
            .collect(),
        hooks: of_type("hook"),
    }
}

/// One declared-vs-actual count claim.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CountDiff {
    pub source: String,
    pub label: String,
    /// `None` when the count token could not be found at all.
    pub declared: Option<i64>,
    pub actual: usize,
}

pub(super) struct CountSpec {
    pub(super) source: &'static str,
    pub(super) label: &'static str,
    /// One capture group: the declared number. Scanned globally.
    pub(super) pattern: &'static str,
    pub(super) actual: usize,
}

fn read(repo_root: &Path, rel: &str) -> String {
    let path = rel
        .split('/')
        .fold(repo_root.to_path_buf(), |acc, part| acc.join(part));
    std::fs::read(path)
        .map(|bytes| String::from_utf8_lossy(&bytes).into_owned())
        .unwrap_or_default()
}

/// Parse declared counts and diff them against the inventory.
pub fn compare_counts(repo_root: &Path) -> Vec<CountDiff> {
    let mut diffs = Vec::new();
    for spec in count_specs(repo_root) {
        let body = read(repo_root, spec.source);
        let pattern: Regex =
            crate::js_regex::compile(spec.pattern).expect("a static count pattern");
        let mut matched = false;
        for capture in pattern.captures_iter(&body) {
            matched = true;
            let declared = capture
                .get(1)
                .and_then(|m| m.as_str().parse::<i64>().ok())
                .unwrap_or(-1);
            if declared != spec.actual as i64 {
                diffs.push(CountDiff {
                    source: spec.source.to_string(),
                    label: spec.label.to_string(),
                    declared: Some(declared),
                    actual: spec.actual,
                });
            }
        }
        if !matched {
            // A count token that cannot be found is itself a failure — never
            // pass-on-no-match, which is how a deleted claim went unnoticed.
            diffs.push(CountDiff {
                source: spec.source.to_string(),
                label: format!("{} (token not found)", spec.label),
                declared: None,
                actual: spec.actual,
            });
        }
    }
    diffs
}

/// Completeness: every artifact id must appear in its index file.
pub fn missing_rows(repo_root: &Path) -> Vec<(String, &'static str, Vec<String>)> {
    let counts = actual_counts(&repo_root.join(".claude"));
    let mut out = Vec::new();
    for (source, kind, entries) in [
        (".claude/agents/SKILLS_INDEX.md", "skill", &counts.skills),
        (".claude/agents/AGENTS_INDEX.md", "agent", &counts.agents),
        (".claude/hooks/HOOKS_INDEX.md", "hook", &counts.hooks),
    ] {
        let index = read(repo_root, source);
        let missing: Vec<String> = entries
            .iter()
            .filter(|entry| !index.contains(&entry.id))
            .map(|entry| entry.id.clone())
            .collect();
        if !missing.is_empty() {
            out.push((source.to_string(), kind, missing));
        }
    }
    out
}

pub fn check_stale_index(repo_root: &Path) -> Vec<CheckResult> {
    let mut results = Vec::new();
    let diffs = compare_counts(repo_root);
    for diff in &diffs {
        let declared = match diff.declared {
            Some(value) => value.to_string(),
            None => "not found".to_string(),
        };
        results.push(CheckResult::new(
            format!("Count drift: {} ({})", diff.source, diff.label),
            Status::Fail,
            format!("declared {declared}, found {}", diff.actual),
            Section::Inventory,
        ));
    }
    let missing = missing_rows(repo_root);
    for (source, kind, ids) in &missing {
        results.push(CheckResult::new(
            format!("Index incomplete: {source}"),
            Status::Fail,
            format!("{} {kind}(s) missing: {}", ids.len(), ids.join(", ")),
            Section::Inventory,
        ));
    }
    if diffs.is_empty() && missing.is_empty() {
        results.push(CheckResult::new(
            "Index counts & completeness",
            Status::Pass,
            "README + index files match the inventory",
            Section::Inventory,
        ));
    }
    results
}

#[cfg(test)]
#[path = "stale_index_tests.rs"]
mod stale_index_tests;
