//! `validate --capabilities`: the manifest's coherence, and the generated view.
//!
//! The capabilities table in `docs/architecture/trigger-registry.md` is
//! GENERATED from the registry, so a spliced region must not become a second
//! editable truth. Honest states: the doc absent or the region not yet spliced
//! → N/A; a region matching a fresh render → PASS; a diverged region → FAIL.
use std::path::Path;

use super::capabilities::{CapabilityEntry, IssueLevel, build_capabilities, validate_capabilities};
use super::result::{CheckResult, Section, Status};

pub const VIEW_START: &str = "<!-- GENERATED:capabilities START -->";
pub const VIEW_END: &str = "<!-- GENERATED:capabilities END -->";

fn escape_cell(text: &str) -> String {
    text.replace('|', "\\|").replace('\n', " ")
}

/// Capabilities WITH intents as a stable markdown table, sorted by id. A
/// capability with no selection terms has nothing to surface here.
pub fn render_capability_view(entries: &[CapabilityEntry]) -> String {
    let mut rows: Vec<&CapabilityEntry> = entries
        .iter()
        .filter(|entry| !entry.intents.is_empty())
        .collect();
    rows.sort_by(|a, b| a.id.cmp(&b.id));
    let mut lines = vec![
        "| Capability | Kind | Invocation | Intent source | Intents (user phrases) |".to_string(),
        "|---|---|---|---|---|".to_string(),
    ];
    for entry in rows {
        lines.push(format!(
            "| `{}` | {} | {}:{} | {} | {} |",
            escape_cell(&entry.id),
            entry.kind,
            entry.invocation_kind,
            entry.invocation_id,
            if entry.intents_authored {
                "authored"
            } else {
                "inferred"
            },
            escape_cell(&entry.intents.join("; "))
        ));
    }
    lines.join("\n")
}

/// The content strictly between the markers, trimmed; `None` when either marker
/// is absent or the end precedes the start — which the caller treats as "no
/// generated region", NOT as drift.
pub fn extract_generated_region(doc: &str) -> Option<&str> {
    let start = doc.find(VIEW_START)?;
    let end = doc.find(VIEW_END)?;
    if end < start {
        return None;
    }
    Some(doc[start + VIEW_START.len()..end].trim())
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ViewDriftState {
    AbsentMarkers,
    InSync,
    Drift,
}

pub fn capability_view_drift(doc: &str, entries: &[CapabilityEntry]) -> ViewDriftState {
    match extract_generated_region(doc) {
        None => ViewDriftState::AbsentMarkers,
        Some(region) if region == render_capability_view(entries).trim() => ViewDriftState::InSync,
        Some(_) => ViewDriftState::Drift,
    }
}

/// Manifest coherence as rows. A clean manifest reports a single PASS.
pub fn check_capabilities_section(claude_dir: &Path) -> Vec<CheckResult> {
    let issues = validate_capabilities(claude_dir);
    if issues.is_empty() {
        return vec![CheckResult::new(
            "Capability manifest coherent",
            Status::Pass,
            "No cross-ref, containment, uniqueness, or cycle issues.",
            Section::Capabilities,
        )];
    }
    issues
        .iter()
        .map(|issue| {
            let level = match issue.level {
                IssueLevel::Error => "error",
                IssueLevel::Warn => "warn",
            };
            CheckResult::new(
                format!(
                    "Capability {level}: {}",
                    issue.capability_id.as_deref().unwrap_or("-")
                ),
                if issue.level == IssueLevel::Error {
                    Status::Fail
                } else {
                    Status::Warn
                },
                issue.message.clone(),
                Section::Capabilities,
            )
        })
        .collect()
}

/// The generated-view drift row (authoring only).
pub fn check_capability_view_drift(claude_dir: &Path, project_root: &Path) -> Vec<CheckResult> {
    let doc_path = project_root
        .join("docs")
        .join("architecture")
        .join("trigger-registry.md");
    if !doc_path.exists() {
        return vec![CheckResult::new(
            "Capability view drift",
            Status::Na,
            "docs/architecture/trigger-registry.md not present (authoring-only doc).",
            Section::Capabilities,
        )];
    }
    let doc = std::fs::read(&doc_path)
        .map(|bytes| String::from_utf8_lossy(&bytes).into_owned())
        .unwrap_or_default();
    match capability_view_drift(&doc, &build_capabilities(claude_dir)) {
        ViewDriftState::AbsentMarkers => vec![CheckResult::new(
            "Capability view drift",
            Status::Na,
            "Generated region not spliced into the doc yet (GENERATED:capabilities markers absent).",
            Section::Capabilities,
        )],
        ViewDriftState::InSync => vec![CheckResult::new(
            "Capability view drift",
            Status::Pass,
            "Generated capabilities table matches the registry.",
            Section::Capabilities,
        )],
        ViewDriftState::Drift => vec![CheckResult::new(
            "Capability view drift",
            Status::Fail,
            "Generated capabilities region has DRIFTED from the registry — regenerate + re-splice (do not hand-edit the region).",
            Section::Capabilities,
        )],
    }
}

#[cfg(test)]
#[path = "capability_rows_tests.rs"]
mod capability_rows_tests;
