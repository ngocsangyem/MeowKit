//! `validate --agents`: do the agents' DECLARED contracts hold together?
//!
//! It verifies declarations only, and says so in its passing row: the host
//! exposes neither a tool-call boundary nor a path-scoped write boundary, so
//! runtime enforcement is not something this can claim. Port of
//! `core/check-agent-conformance.ts`.
use std::collections::BTreeSet;
use std::path::Path;
use std::sync::LazyLock;

use regex::Regex;

use super::agent_registry_rows::{registry_rows, registry_view_row};
use super::agent_sources::{AgentSource, agent_sources};
use super::agent_views::artifact_patterns_overlap;
use super::inventory::STATUS_REFERENCE;
use super::inventory_build::build_inventory;
use super::result::{CheckResult, Section, Status};
use super::stale_index::check_stale_index;

/// Host tools an agent body may name. Augmented at runtime with every tool any
/// agent declares, so a kit-specific tool is known without a second list.
const HOST_TOOLS: [&str; 16] = [
    "Read",
    "Grep",
    "Glob",
    "Bash",
    "Write",
    "Edit",
    "Task",
    "AskUserQuestion",
    "WebFetch",
    "WebSearch",
    "TaskCreate",
    "TaskGet",
    "TaskUpdate",
    "TaskList",
    "SendMessage",
    "Task(Explore)",
];

/// A line that FORBIDS a tool is not a line that instructs it.
static TOOL_DENIAL: LazyLock<Regex> = LazyLock::new(|| {
    crate::js_regex::compile_ci(r"disallow|never use|do not use|without .*tool")
        .expect("a static tool-denial pattern")
});

/// A backticked token, which is how an agent body names a tool it uses.
static BACKTICKED_TOOL: LazyLock<Regex> = LazyLock::new(|| {
    crate::js_regex::compile(r"`([A-Za-z][A-Za-z0-9]*(?:\([^`]+\))?)`")
        .expect("a static tool-token pattern")
});

/// Prose that tells the agent to END with a status block — which has to use the
/// canonical reference, or the protocol it claims to follow is a paraphrase.
static STATUS_BLOCK_CLAIM: LazyLock<Regex> = LazyLock::new(|| {
    crate::js_regex::compile_ci(r"\bend\b[^\n]*\bstatus block\b")
        .expect("a static status-block pattern")
});

fn fail(name: String, detail: impl Into<String>) -> CheckResult {
    CheckResult::new(name, Status::Fail, detail, Section::Agents)
}

pub fn check_agent_conformance(repo_root: &Path) -> Vec<CheckResult> {
    let claude_dir = repo_root.join(".claude");
    let inventory = build_inventory(&claude_dir);
    let agents = agent_sources(&claude_dir, &inventory);

    let mut results = Vec::new();
    let mut known_tools: BTreeSet<String> =
        HOST_TOOLS.iter().map(|tool| (*tool).to_string()).collect();
    for entry in &inventory.entries {
        if let Some(tools) = &entry.tools {
            known_tools.extend(tools.iter().cloned());
        }
    }

    for agent in &agents {
        for line in agent.body.split('\n') {
            // A line that FORBIDS a tool is not a line that instructs it.
            if TOOL_DENIAL.is_match(line) {
                continue;
            }
            for capture in BACKTICKED_TOOL.captures_iter(line) {
                let tool = capture.get(1).map(|m| m.as_str()).unwrap_or_default();
                if known_tools.contains(tool) && !agent.tools.contains(tool) {
                    results.push(fail(
                        format!("Agent tools: {}", agent.path),
                        format!("body instructs `{tool}` but frontmatter does not grant it"),
                    ));
                }
            }
        }
        if (agent.tools.contains("Write") || agent.tools.contains("Edit"))
            && agent.artifacts.is_empty()
        {
            results.push(fail(
                format!("Agent ownership: {}", agent.path),
                "Write/Edit granted with no declared owned artifact",
            ));
        }
        if STATUS_BLOCK_CLAIM.is_match(&agent.body) && !agent.body.contains(STATUS_REFERENCE) {
            results.push(fail(
                format!("Agent status reference: {}", agent.path),
                "status-block instruction does not use the canonical A1 reference",
            ));
        }
    }

    // Two writers whose glob patterns intersect would both own the same path.
    let writers: Vec<&AgentSource> = agents
        .iter()
        .filter(|agent| agent.tools.contains("Write") || agent.tools.contains("Edit"))
        .collect();
    for (index, left_agent) in writers.iter().enumerate() {
        for right_agent in writers.iter().skip(index + 1) {
            for left in left_agent.artifacts.iter().filter(|p| p.contains('*')) {
                for right in right_agent.artifacts.iter().filter(|p| p.contains('*')) {
                    if artifact_patterns_overlap(left, right) {
                        results.push(fail(
                            "Agent ownership overlap".to_string(),
                            format!(
                                "{} {left} overlaps {} {right}",
                                left_agent.path, right_agent.path
                            ),
                        ));
                    }
                }
            }
        }
    }

    for entry in inventory
        .entries
        .iter()
        .filter(|e| e.artifact_type == "agent" && e.agent_class == Some("core-support"))
    {
        if entry.trigger_owner != Some(true) {
            results.push(fail(
                format!("Agent trigger boundary: {}", entry.path),
                "core/support agent needs trigger owner and negative boundary in description",
            ));
        }
    }

    results.extend(registry_rows(&claude_dir, &inventory));

    if results.is_empty() {
        results.push(CheckResult::new(
            "Agent conformance",
            Status::Pass,
            "Declared contracts are consistent; this is not runtime tool or path enforcement",
            Section::Agents,
        ));
    }

    results.extend(registry_view_row(&claude_dir));
    results.extend(check_stale_index(repo_root));
    results
}
