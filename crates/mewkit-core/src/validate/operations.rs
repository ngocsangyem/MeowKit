//! The four logical workflow operations, and whether each provider honours one.
//!
//! These names are keyed off a table frontmatter NEVER indexes: `run_shell` and
//! `delegate_agent` are precisely the strings the invocation enum exists to
//! keep out of author-controlled input, so admitting them there would dissolve
//! the enum's only value — what it excludes. Prose naming an operation is
//! resolved by adapter code, never executed from the name. Port of
//! `core/provider-operations.ts` and `core/check-operation-conformance.ts`.
use std::path::Path;

use serde_json::Value;

use super::capabilities::KNOWN_INVOCATION_IDS;
use super::inventory_enumerate::{ArtifactType, enumerate_artifacts};
use super::inventory_read::read_frontmatter;

/// The four portable workflow operations a skill's prose may refer to.
pub const LOGICAL_OPERATIONS: [&str; 4] =
    ["ask_user", "manage_plan", "run_shell", "delegate_agent"];

/// Providers with an adapted projection, in the order the npm CLI iterates.
pub const ADAPTED_PROVIDERS: [&str; 3] = ["claude-code", "claude-plugin", "codex"];

/// Per-operation conformance state, in the TypeScript's spelling.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum OperationSupport {
    Supported,
    Unsupported,
    PermissionBlocked,
    LocalFallback,
    Unknown,
}

impl OperationSupport {
    pub fn as_str(self) -> &'static str {
        match self {
            OperationSupport::Supported => "supported",
            OperationSupport::Unsupported => "unsupported",
            OperationSupport::PermissionBlocked => "permission-blocked",
            OperationSupport::LocalFallback => "local-fallback",
            OperationSupport::Unknown => "unknown",
        }
    }
}

/// Claude Code exposes each operation as a typed tool in the current runtime,
/// and the plugin shape inherits that. Codex reaches skills and agents through
/// instruction projection rather than typed invoke tools: prompt projection is
/// not a primitive — the model may comply or not — so anything that depends on
/// a typed tool is NOT `supported` there.
fn support_of(provider: &str, operation: &str) -> OperationSupport {
    match provider {
        "claude-code" | "claude-plugin" => OperationSupport::Supported,
        "codex" => match operation {
            "ask_user" | "manage_plan" => OperationSupport::LocalFallback,
            "run_shell" => OperationSupport::Unknown,
            "delegate_agent" => OperationSupport::Unsupported,
            _ => OperationSupport::Unknown,
        },
        // A provider with no tested projection claims nothing.
        _ => OperationSupport::Unknown,
    }
}

/// Claude Code host tool → the logical operation it realizes. Keys are BASE
/// tool names; a scoped form like `Bash(git:*)` is normalized before lookup.
fn operation_of_tool(tool: &str) -> Option<&'static str> {
    match tool {
        "AskUserQuestion" => Some("ask_user"),
        "Bash" => Some("run_shell"),
        "Agent" | "Task" => Some("delegate_agent"),
        "TaskCreate" | "TaskUpdate" | "TaskList" | "TaskGet" => Some("manage_plan"),
        _ => None,
    }
}

/// `Bash(git:*)` → `Bash`, ` Read ` → `Read`.
fn base_tool_name(raw: &str) -> String {
    let trimmed = raw.trim();
    match trimmed.find('(') {
        Some(index) => trimmed[..index].trim().to_string(),
        None => trimmed.to_string(),
    }
}

/// A skill's declared host tools from `allowed-tools` (array or comma scalar).
fn declared_tools(meta: &serde_json::Map<String, Value>) -> Vec<String> {
    match meta.get("allowed-tools") {
        Some(Value::Array(items)) => items
            .iter()
            .filter_map(Value::as_str)
            .map(str::to_string)
            .collect(),
        Some(Value::String(scalar)) => scalar
            .split(',')
            .map(|tool| tool.trim().to_string())
            .filter(|tool| !tool.is_empty())
            .collect(),
        _ => Vec::new(),
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct OperationConformanceFinding {
    pub skill: String,
    pub operation: &'static str,
    pub provider: &'static str,
    pub support: OperationSupport,
}

/// For every installed skill, the operations it references (through its
/// declared tools) whose support is not `supported` on an advertised provider.
///
/// Disclosed degradation (`local-fallback`) and hard gaps
/// (`unsupported`/`unknown`) are both surfaced, so a cross-harness projection
/// never advertises an operation the host cannot honour.
pub fn find_operation_conformance(claude_dir: &Path) -> Vec<OperationConformanceFinding> {
    let (refs, _) = enumerate_artifacts(claude_dir);
    let mut findings = Vec::new();
    for artifact in refs
        .iter()
        .filter(|r| r.artifact_type == ArtifactType::Skill)
    {
        let tools = declared_tools(&read_frontmatter(&artifact.abs));
        let mut operations: Vec<&'static str> = Vec::new();
        for tool in &tools {
            if let Some(operation) = operation_of_tool(&base_tool_name(tool))
                && !operations.contains(&operation)
            {
                operations.push(operation);
            }
        }
        for operation in operations {
            for provider in ADAPTED_PROVIDERS {
                let support = support_of(provider, operation);
                if support != OperationSupport::Supported {
                    findings.push(OperationConformanceFinding {
                        skill: artifact.id.clone(),
                        operation,
                        provider,
                        support,
                    });
                }
            }
        }
    }
    findings
}

/// `unsupported`/`unknown` means the operation genuinely fails or is untested
/// there; `local-fallback` is disclosed graceful degradation. Only the former
/// is blocking-worthy.
pub fn is_blocking_gap(finding: &OperationConformanceFinding) -> bool {
    matches!(
        finding.support,
        OperationSupport::Unsupported | OperationSupport::Unknown
    )
}

/// A compact per-provider summary, deterministically ordered.
pub fn summarize_operation_conformance(findings: &[OperationConformanceFinding]) -> String {
    let mut counts: Vec<(&str, usize)> = Vec::new();
    for finding in findings {
        match counts
            .iter_mut()
            .find(|(name, _)| *name == finding.provider)
        {
            Some((_, count)) => *count += 1,
            None => counts.push((finding.provider, 1)),
        }
    }
    counts.sort_by(|a, b| a.0.cmp(b.0));
    counts
        .iter()
        .map(|(provider, count)| format!("{provider}={count}"))
        .collect::<Vec<_>>()
        .join(", ")
}

/// The anti-smuggling invariant, enforced rather than documented: no logical
/// operation may appear in the frontmatter-reachable invocation enum.
pub fn assert_operations_not_invocable() -> Vec<String> {
    LOGICAL_OPERATIONS
        .iter()
        .filter(|operation| KNOWN_INVOCATION_IDS.contains(operation))
        .map(|operation| {
            format!(
                "\"{operation}\" appears in KNOWN_INVOCATION_IDS — frontmatter could then name it. \
                 Logical operations are adapter-internal by design; remove it from the enum."
            )
        })
        .collect()
}

#[cfg(test)]
#[path = "operations_tests.rs"]
mod operations_tests;
