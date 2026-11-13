//! The provider-native operation each LOGICAL invocation id maps to, and the
//! logical workflow operations a skill's prose may name.
//!
//! This is the security seam: provider-native operation strings live only
//! here, never in the capability manifest, whose `invocation.id` stays a
//! logical id from a closed set. Hostile frontmatter can name an id at most;
//! only this table turns it into a (descriptive, not runnable) operation.
use serde_json::{Map, Value, json};

/// The closed set of logical ids frontmatter may name.
pub const INVOCATION_IDS: [&str; 6] = [
    "invoke-skill",
    "invoke-agent",
    "invoke-command",
    "invoke-workflow",
    "lifecycle-hook",
    "none",
];

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct InvocationShape {
    pub operation: &'static str,
    pub support: &'static str,
    pub note: &'static str,
}

pub type InvocationMap = Vec<(&'static str, InvocationShape)>;

fn shape(operation: &'static str, support: &'static str, note: &'static str) -> InvocationShape {
    InvocationShape {
        operation,
        support,
        note,
    }
}

fn claude_code() -> InvocationMap {
    vec![
        (
            "invoke-skill",
            shape(
                "Skill tool (by skill name)",
                "supported",
                "host invokes the skill directly",
            ),
        ),
        (
            "invoke-agent",
            shape(
                "Agent/Task tool (by agent type)",
                "supported",
                "host spawns the subagent",
            ),
        ),
        (
            "invoke-command",
            shape(
                "slash command",
                "supported",
                "user- or model-invoked command",
            ),
        ),
        (
            "invoke-workflow",
            shape(
                "entry skill/command composition",
                "advisory",
                "no distinct workflow primitive — runs as its entry skill",
            ),
        ),
        (
            "lifecycle-hook",
            shape(
                "hook registered in settings.json",
                "supported",
                "host fires the hook on the mapped event",
            ),
        ),
        (
            "none",
            shape(
                "(not directly invocable)",
                "unsupported",
                "e.g. a describe-only tool or a hook capability",
            ),
        ),
    ]
}

fn claude_plugin() -> InvocationMap {
    let mut map = claude_code();
    map[2].1 = shape(
        "plugin slash command",
        "supported",
        "command shipped in the plugin payload",
    );
    map[4].1 = shape(
        "hook in the plugin payload (propagated at plugin generation)",
        "supported",
        "propagated hook fires on the mapped event",
    );
    map
}

fn codex() -> InvocationMap {
    vec![
        (
            "invoke-skill",
            shape(
                "skill projected into the AGENTS instruction surface",
                "advisory",
                "prompt-projected, not a typed invoke tool",
            ),
        ),
        (
            "invoke-agent",
            shape(
                "codex subagent surface",
                "advisory",
                "subagent exists (SubagentStart) but is not a typed invoke",
            ),
        ),
        (
            "invoke-command",
            shape(
                "command projected into the instruction surface",
                "advisory",
                "prompt-projected",
            ),
        ),
        (
            "invoke-workflow",
            shape(
                "instruction-surface composition",
                "advisory",
                "no workflow primitive",
            ),
        ),
        (
            "lifecycle-hook",
            shape(
                "codex hook (config.toml)",
                "advisory",
                "version-gated (CODEX_MIN_SUPPORTED_VERSION 0.142)",
            ),
        ),
        (
            "none",
            shape(
                "(not directly invocable)",
                "unsupported",
                "describe-only / hook capability",
            ),
        ),
    ]
}

fn cursor() -> InvocationMap {
    vec![
        (
            "invoke-skill",
            shape(
                "Agent Skill (from .agents/skills/)",
                "supported",
                "native skill invocation; `disable-model-invocation` makes a skill explicit-invoke only",
            ),
        ),
        (
            "invoke-agent",
            shape(
                "custom agent (/agent-name or description-routed)",
                "supported",
                "native .cursor/agents/*.md; `is_background` for non-blocking roles; a child agent cannot re-spawn",
            ),
        ),
        (
            "invoke-command",
            shape(
                "skill with `disable-model-invocation` (legacy .cursor/commands not targeted)",
                "advisory",
                "no separate command primitive installed — commands project onto explicit-invoke skills",
            ),
        ),
        (
            "invoke-workflow",
            shape(
                "entry skill/agent composition",
                "advisory",
                "no distinct workflow primitive — runs as its entry skill/agent",
            ),
        ),
        (
            "lifecycle-hook",
            shape(
                "hook registered in .cursor/hooks.json (version 1)",
                "supported",
                "host fires the hook on the mapped event; `failClosed` for security gates",
            ),
        ),
        (
            "none",
            shape(
                "(not directly invocable)",
                "unsupported",
                "describe-only / hook capability",
            ),
        ),
    ]
}

/// The invocation shapes for a provider, or an all-`unknown` map.
pub fn invocation_shapes(provider: &str) -> InvocationMap {
    match provider {
        "claude-code" => claude_code(),
        "claude-plugin" => claude_plugin(),
        "codex" => codex(),
        "cursor" => cursor(),
        _ => INVOCATION_IDS
            .iter()
            .map(|id| {
                (
                    *id,
                    shape(
                        "(unknown)",
                        "unknown",
                        "no tested invocation projection for this provider",
                    ),
                )
            })
            .collect(),
    }
}

pub fn invocation_json(map: &InvocationMap) -> Value {
    let mut out = Map::new();
    for (id, s) in map {
        out.insert(
            (*id).to_string(),
            json!({"operation": s.operation, "support": s.support, "note": s.note}),
        );
    }
    Value::Object(out)
}

/// The four portable workflow operations a skill's prose may refer to.
pub const LOGICAL_OPERATIONS: [&str; 4] =
    ["ask_user", "manage_plan", "run_shell", "delegate_agent"];

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct OperationShape {
    pub operation: &'static str,
    pub support: &'static str,
    pub evidence: &'static str,
    /// Set only for `local-fallback`: what happens instead.
    pub fallback: Option<&'static str>,
}

pub type OperationMap = Vec<(&'static str, OperationShape)>;

fn op(
    operation: &'static str,
    support: &'static str,
    evidence: &'static str,
    fallback: Option<&'static str>,
) -> OperationShape {
    OperationShape {
        operation,
        support,
        evidence,
        fallback,
    }
}

fn claude_code_operations() -> OperationMap {
    vec![
        (
            "ask_user",
            op(
                "AskUserQuestion tool",
                "supported",
                "typed AskUserQuestion tool in the Claude Code runtime",
                None,
            ),
        ),
        (
            "manage_plan",
            op(
                "TaskCreate / TaskUpdate / TaskList tools, plus plan files under tasks/plans/",
                "supported",
                "typed Task tools in the Claude Code runtime; plan files on disk",
                None,
            ),
        ),
        (
            "run_shell",
            op(
                "Bash tool",
                "supported",
                "typed Bash tool in the Claude Code runtime",
                None,
            ),
        ),
        (
            "delegate_agent",
            op(
                "Agent/Task tool (by agent type)",
                "supported",
                "typed Agent/Task tool; mirrors invoke-agent in provider-invocation.ts",
                None,
            ),
        ),
    ]
}

fn codex_operations() -> OperationMap {
    vec![
        (
            "ask_user",
            op(
                "question asked inline in the assistant's prose",
                "local-fallback",
                "no typed prompt primitive; codex surfaces are prompt-projected (provider-projection.ts)",
                Some(
                    "The agent asks in prose and waits. There is no structured option list and no host guarantee that the turn actually blocks.",
                ),
            ),
        ),
        (
            "manage_plan",
            op(
                "plan files under tasks/plans/ (no typed task tool)",
                "local-fallback",
                "no typed Task tool on codex; plan files are plain files the kit already writes",
                Some(
                    "Plan state lives only in files. Nothing enforces that the agent updates them.",
                ),
            ),
        ),
        (
            "run_shell",
            op(
                "codex shell execution",
                "unknown",
                "no in-repo proof of the shell surface's contract for this kit; not asserted",
                None,
            ),
        ),
        (
            "delegate_agent",
            op(
                "codex subagent surface",
                "unsupported",
                "subagent surface exists (SubagentStart) but is not a typed invoke — invoke-agent is advisory on codex (provider-invocation.ts)",
                None,
            ),
        ),
    ]
}

/// The operation shapes for a provider, or an all-`unknown` map.
pub fn operation_shapes(provider: &str) -> OperationMap {
    match provider {
        "claude-code" | "claude-plugin" => claude_code_operations(),
        "codex" => codex_operations(),
        _ => LOGICAL_OPERATIONS
            .iter()
            .map(|o| {
                (
                    *o,
                    op(
                        "(unknown)",
                        "unknown",
                        "no tested operation projection for this provider",
                        None,
                    ),
                )
            })
            .collect(),
    }
}

pub fn operations_json(map: &OperationMap) -> Value {
    let mut out = Map::new();
    for (name, s) in map {
        out.insert(
            (*name).to_string(),
            json!({
                "operation": s.operation,
                "support": s.support,
                "evidence": s.evidence,
                "fallback": s.fallback,
            }),
        );
    }
    Value::Object(out)
}
