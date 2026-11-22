//! The `rules: always-on` row: is the rule text an agent is meant to carry
//! still on disk, and does the per-session "verified" marker still describe it?
//!
//! Three things are read, all from disk:
//!
//! - The six always-on rule files of a Claude Code tree, where one is installed
//!   at the scope or the project carries the kit's hook registry. A file that is
//!   missing or holds only whitespace is lost rule text: the router refuses to
//!   route without it, and a host loading the directory silently loads less.
//! - Every file another runtime's install recorded under a `rules` directory,
//!   with the same test.
//! - The project's `session-sentinels.jsonl`, the log the Claude Code hooks keep
//!   for the latest session. When its last verification line claims the safety
//!   baseline is verified, the digest it recorded is recomputed from the rule
//!   files; a mismatch means the marker vouches for text that is no longer
//!   there, and a line with no digest was written by a hook that ran no check.
//!
//! Missing or empty rule text fails the row, as `validate` fails a missing rule.
//! A stale marker only warns: the next session starts a fresh log.
use std::path::Path;

use mewkit_adapters::contract::{RelPath, Runtime};
use mewkit_core::fsx::sha256_hex;
use mewkit_core::state_paths::resolve_session_state_file;
use mewkit_core::validate::ALWAYS_ON_RULES;
use serde_json::Value;

use super::coexistence::installed;
use super::coexistence_scan as scan;
use super::{Check, Status};
use crate::place::Place;

const NAME: &str = "rules: always-on";
const SENTINEL_LOG: &str = "session-sentinels.jsonl";
const REGISTRY: &str = ".claude/hooks/handlers.json";

pub fn check(places: &[&Place], targets: &[Runtime]) -> Check {
    let mut read = 0usize;
    let (mut missing, mut empty) = (Vec::new(), Vec::new());
    for place in places {
        for rel in subjects(place, targets) {
            let Ok(path) = RelPath::new(&rel) else {
                continue;
            };
            read += 1;
            let shown = format!("{} {rel}", place.label());
            match std::fs::read(place.scope.resolve(&path)) {
                Ok(bytes) if is_blank(&bytes) => empty.push(shown),
                Ok(_) => {}
                Err(_) => missing.push(shown),
            }
        }
    }
    for list in [&mut missing, &mut empty] {
        list.sort_unstable();
        list.dedup();
    }
    let marker = places
        .iter()
        .find(|p| p.scope.kind == mewkit_adapters::ScopeKind::Project)
        .and_then(|p| marker_problem(&p.scope.root));

    if missing.is_empty() && empty.is_empty() && marker.is_none() {
        let detail = if read == 0 {
            "no install at the scopes read carries always-on rules".to_owned()
        } else {
            format!(
                "{read} always-on rule files are present and non-empty, and no session marker \
                 claims a rule text that differs from them"
            )
        };
        return Check::new(NAME, Status::Ok, detail);
    }
    let mut parts = Vec::new();
    if !missing.is_empty() {
        parts.push(format!(
            "{} missing ({})",
            missing.len(),
            scan::sample(&missing)
        ));
    }
    if !empty.is_empty() {
        parts.push(format!("{} empty ({})", empty.len(), scan::sample(&empty)));
    }
    let lost = !parts.is_empty();
    if lost {
        parts[0] = format!("of {read} always-on rule files, {}", parts[0]);
        parts.push(
            "an agent here runs without that rule text; `mewkit upgrade --force` restores the \
             shipped files"
                .to_owned(),
        );
    }
    parts.extend(marker);
    let status = if lost { Status::Fail } else { Status::Warn };
    Check::new(NAME, status, parts.join("; "))
}

/// Root-relative paths of the rule files to read at `place`.
fn subjects(place: &Place, targets: &[Runtime]) -> Vec<String> {
    let mut out = Vec::new();
    for &runtime in targets {
        let index = installed(place, runtime);
        if runtime == Runtime::ClaudeCode {
            // A project with the kit's registry but no index is a source
            // checkout or a copied tree; at the home directory `.claude/rules`
            // is the user's own folder unless the kit was installed there.
            let kit_tree = place.scope.kind == mewkit_adapters::ScopeKind::Project
                && place.scope.root.join(REGISTRY).is_file();
            if index.is_some() || kit_tree {
                out.extend(ALWAYS_ON_RULES.iter().map(|f| format!(".claude/rules/{f}")));
            }
            continue;
        }
        if let Some(index) = index {
            out.extend(
                index
                    .paths
                    .keys()
                    .filter(|p| p.split('/').any(|s| s == "rules"))
                    .filter(|p| p.ends_with(".md") || p.ends_with(".mdc"))
                    .cloned(),
            );
        }
    }
    out
}

fn is_blank(bytes: &[u8]) -> bool {
    String::from_utf8_lossy(bytes).trim().is_empty()
}

/// What is wrong with the latest safety marker in this project, if anything.
fn marker_problem(root: &Path) -> Option<String> {
    let text = std::fs::read_to_string(resolve_session_state_file(root, SENTINEL_LOG)).ok()?;
    let row = text
        .lines()
        .rev()
        .filter_map(|line| serde_json::from_str::<Value>(line.trim()).ok())
        .find(|row| row.get("safety").is_some() || row.get("phase_zero").is_some())?;
    if row.get("safety").and_then(Value::as_bool) != Some(true) {
        return None;
    }
    let shown = format!(".meowkit/state/{SENTINEL_LOG}");
    let Some(recorded) = row.get("rules_sha256").and_then(Value::as_str) else {
        return Some(format!(
            "{shown} claims the safety baseline is verified with no rule digest — written by a \
             hook that checked nothing; a session started with this kit's hooks writes a \
             checked line"
        ));
    };
    if rules_digest(root).as_deref() == Some(recorded) {
        return None;
    }
    Some(format!(
        "{shown} claims the safety baseline is verified, but the always-on rule files no \
         longer match the digest it recorded; the hooks withhold that marker, and the next \
         session re-reads the rules"
    ))
}

/// The digest the hooks record: SHA-256 over `<path>\0<sha256 of bytes>\n` per
/// rule file in load order. `None` when a file is missing or blank, which no
/// recorded digest can match.
fn rules_digest(root: &Path) -> Option<String> {
    let mut lines = String::new();
    for file in ALWAYS_ON_RULES {
        let rel = format!(".claude/rules/{file}");
        let bytes = std::fs::read(root.join(&rel)).ok()?;
        if is_blank(&bytes) {
            return None;
        }
        lines.push_str(&format!("{rel}\0{}\n", sha256_hex(&bytes)));
    }
    Some(sha256_hex(lines.as_bytes()))
}

#[cfg(test)]
#[path = "rule_text_tests.rs"]
mod tests;
