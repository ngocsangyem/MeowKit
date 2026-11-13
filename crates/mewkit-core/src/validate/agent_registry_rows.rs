//! The agent rows that are about the REGISTRY rather than about one agent:
//! the prose routing table, the model taxonomy, and the generated index view.
use std::path::Path;

use super::agent_sources::read_body;
use super::agent_views::{VIEW_END, VIEW_START, render_agent_view_counts};
use super::inventory::Inventory;
use super::result::{CheckResult, Section, Status};

/// Models the taxonomy resolves: the two named profiles and the three tiers.
/// `inherit` and an empty value are resolvable by definition — they ask for the
/// target's own default. Mirrors `migrate/model-taxonomy.ts`, where only an
/// unknown non-empty string produces an "Unknown model" warning.
const RESOLVABLE_MODELS: [&str; 5] = ["fable", "claude-opus-5", "opus", "sonnet", "haiku"];

fn model_is_resolvable(model: &str) -> bool {
    let trimmed = model.trim();
    trimmed.is_empty() || trimmed == "inherit" || RESOLVABLE_MODELS.contains(&trimmed)
}

fn fail(name: String, detail: impl Into<String>) -> CheckResult {
    CheckResult::new(name, Status::Fail, detail, Section::Agents)
}

/// The routing-table, model and generated-view rows for one install.
pub(super) fn registry_rows(claude_dir: &Path, inventory: &Inventory) -> Vec<CheckResult> {
    let mut results = Vec::new();
    // The prose routing table is loaded just in time by the agent-detector
    // skill, so it lives in that skill's references, not in always-on rules.
    let routing_rel = "skills/agent-detector/references/agent-routing.md";
    let routing_path = routing_rel
        .split('/')
        .fold(claude_dir.to_path_buf(), |acc, part| acc.join(part));
    let routing = if routing_path.exists() {
        read_body(&routing_path)
    } else {
        String::new()
    };
    if routing.is_empty() {
        results.push(fail(
            "Agent routing index".to_string(),
            format!("Missing .claude/{}", rel_display(routing_rel)),
        ));
    }
    for entry in inventory
        .entries
        .iter()
        .filter(|e| e.artifact_type == "agent" && e.routing == Some("hub-only"))
    {
        if !routing.contains(&entry.id) {
            results.push(CheckResult::new(
                format!("Agent hub route: {}", entry.path),
                Status::Warn,
                "hub leaf is not listed in the prose routing table",
                Section::Agents,
            ));
        }
    }
    for entry in inventory
        .entries
        .iter()
        .filter(|e| e.artifact_type == "agent")
    {
        let model = entry.model.clone().unwrap_or_default();
        if !model_is_resolvable(&model) {
            results.push(fail(
                format!("Agent model: {}", entry.path),
                format!("model \"{model}\" is not in the taxonomy"),
            ));
        }
    }

    results
}

/// The generated-view row, separated because its absence and its staleness are
/// different findings with the same name.
pub(super) fn registry_view_row(claude_dir: &Path) -> Option<CheckResult> {
    let agents_index_path = claude_dir.join("agents").join("AGENTS_INDEX.md");
    if !agents_index_path.exists() {
        return Some(fail(
            "Agent registry views".to_string(),
            "Missing .claude/agents/AGENTS_INDEX.md",
        ));
    }
    let agents_index = read_body(&agents_index_path);
    let generated = render_agent_view_counts(claude_dir);
    (extract_view_region(&agents_index).as_deref() != Some(generated.as_str())).then(|| {
        fail(
            "Agent registry views".to_string(),
            "AGENTS_INDEX generated view counts are missing or stale",
        )
    })
}

/// The missing-routing detail names the path with the OS separator the npm CLI
/// would print, because it builds the message with `path.join`.
fn rel_display(rel: &str) -> String {
    rel.split('/')
        .collect::<Vec<_>>()
        .join(std::path::MAIN_SEPARATOR_STR)
}

/// The spliced generated region, markers included, or `None` when absent.
fn extract_view_region(text: &str) -> Option<String> {
    let start = text.find(VIEW_START)?;
    let end = text[start..].find(VIEW_END)? + start;
    Some(text[start..end + VIEW_END.len()].to_string())
}
