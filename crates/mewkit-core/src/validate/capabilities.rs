//! The capability manifest, built from an installed `.claude/` and validated.
//!
//! Every disk-enumerated invocable-kind artifact yields exactly one capability
//! keyed by its path; authored tool/service entries are appended. Rules are
//! deliberately NOT capabilities: they are always-on context, not something a
//! host invokes. Port of `core/build-capabilities.ts` and
//! `core/validate-capabilities.ts`.
use std::collections::BTreeMap;
use std::path::Path;

pub use super::capability_build::build_capabilities;
use super::inventory_build::build_inventory;

/// The logical invocation ids frontmatter may name. A closed set is the whole
/// point: hostile frontmatter can name an id at most, never smuggle a command.
pub const KNOWN_INVOCATION_IDS: [&str; 6] = [
    "invoke-skill",
    "invoke-agent",
    "invoke-command",
    "invoke-workflow",
    "lifecycle-hook",
    "none",
];

/// One built capability — the fields validation and the generated view read.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CapabilityEntry {
    pub id: String,
    pub kind: &'static str,
    pub aliases: Vec<String>,
    /// `None` for an authored entry with no disk artifact.
    pub source_path: Option<String>,
    pub inventory_id: Option<String>,
    pub owner: String,
    pub intents: Vec<String>,
    pub invocation_kind: &'static str,
    pub invocation_id: &'static str,
    pub upstream: Vec<String>,
    /// True when the intents came from the authored overlay.
    pub intents_authored: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum IssueLevel {
    Error,
    Warn,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CapabilityIssue {
    pub level: IssueLevel,
    pub capability_id: Option<String>,
    pub message: String,
}

/// True when `rel` is a `.claude/`-relative path with no escape.
fn is_contained(rel: &str) -> bool {
    if rel.starts_with('/') {
        return false;
    }
    let windows_absolute = {
        let bytes = rel.as_bytes();
        bytes.len() >= 3
            && bytes[0].is_ascii_alphabetic()
            && bytes[1] == b':'
            && (bytes[2] == b'\\' || bytes[2] == b'/')
    };
    if windows_absolute {
        return false;
    }
    !rel.split(['\\', '/']).any(|part| part == "..")
}

/// A cycle in the upstream-dependency graph, as the path that closes it.
fn find_cycle(entries: &[CapabilityEntry]) -> Option<Vec<String>> {
    #[derive(Clone, Copy, PartialEq)]
    enum State {
        Visiting,
        Done,
    }
    let upstream: BTreeMap<&str, &Vec<String>> = entries
        .iter()
        .map(|entry| (entry.id.as_str(), &entry.upstream))
        .collect();
    let mut state: BTreeMap<&str, State> = BTreeMap::new();
    let mut stack: Vec<String> = Vec::new();

    fn visit<'a>(
        id: &'a str,
        upstream: &BTreeMap<&'a str, &'a Vec<String>>,
        state: &mut BTreeMap<&'a str, State>,
        stack: &mut Vec<String>,
    ) -> Option<Vec<String>> {
        match state.get(id) {
            Some(State::Done) => return None,
            Some(State::Visiting) => {
                let start = stack.iter().position(|seen| seen == id).unwrap_or(0);
                let mut cycle: Vec<String> = stack[start..].to_vec();
                cycle.push(id.to_string());
                return Some(cycle);
            }
            None => {}
        }
        state.insert(id, State::Visiting);
        stack.push(id.to_string());
        for dependency in upstream.get(id).copied().into_iter().flatten() {
            // A dangling dependency is reported by the coverage pass instead.
            let Some((key, _)) = upstream.get_key_value(dependency.as_str()) else {
                continue;
            };
            if let Some(cycle) = visit(key, upstream, state, stack) {
                return Some(cycle);
            }
        }
        stack.pop();
        state.insert(id, State::Done);
        None
    }

    for entry in entries {
        let key = upstream.get_key_value(entry.id.as_str())?.0;
        if let Some(cycle) = visit(key, &upstream, &mut state, &mut stack) {
            return Some(cycle);
        }
    }
    None
}

/// Validate the manifest built from `claude_dir`.
pub fn validate_capabilities(claude_dir: &Path) -> Vec<CapabilityIssue> {
    let entries = build_capabilities(claude_dir);
    let inventory = build_inventory(claude_dir).entries;
    super::capabilities_validate::validate_capability_entries(
        &entries,
        &inventory,
        find_cycle,
        is_contained,
    )
}
#[cfg(test)]
#[path = "capabilities_tests.rs"]
mod capabilities_tests;
