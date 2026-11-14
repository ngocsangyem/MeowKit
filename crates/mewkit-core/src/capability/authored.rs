//! The hand-authored half of a capability entry: what the validation view's
//! reduced entries do not carry — descriptions, requirements and the
//! repo-context reasons.
//!
//! Intents, aliases and the entry list itself come from
//! `validate::build_capabilities`, so there is one table of those.

/// Fields of an authored (no disk artifact) entry.
pub struct AuthoredDetail {
    pub id: &'static str,
    pub description: &'static str,
    pub when_to_use: Option<&'static str>,
    /// `(requirement type, id)`; provenance is always `authored`.
    pub requirements: &'static [(&'static str, &'static str)],
}

pub const AUTHORED_DETAILS: [AuthoredDetail; 6] = [
    AuthoredDetail {
        id: "jira",
        description: "Jira issue tracking integration (surfaced via the mk:jira hub skills).",
        when_to_use: None,
        requirements: &[("mcp_or_app", "jira")],
    },
    AuthoredDetail {
        id: "browser",
        description: "Browser automation (surfaced via mk:agent-browser / mk:playwright-cli).",
        when_to_use: None,
        requirements: &[("external_binary", "chromium")],
    },
    AuthoredDetail {
        id: "project-context",
        description: "Loads project conventions and context at session start.",
        when_to_use: None,
        requirements: &[("file_or_config", "docs/project-context.md")],
    },
    AuthoredDetail {
        id: "task-record",
        description: "Durable task/plan records under tasks/.",
        when_to_use: None,
        requirements: &[("file_or_config", "tasks")],
    },
    AuthoredDetail {
        id: "trace-log",
        description: "Append-only trace/friction log for cross-session recall.",
        when_to_use: None,
        requirements: &[("external_binary", "mewkit")],
    },
    AuthoredDetail {
        id: "advice-supervision",
        description: "Athena provides bounded strategic supervision at declared --advice checkpoints and a stateless direct strategy consult where a provider exposes it. Recommendations are evidence, never gate approval or verification.",
        when_to_use: Some(
            "Use --advice for a bounded delivery run, or explicitly consult Athena for a stateless strategy brief when the situation needs trade-off analysis, judgement, or a recommended next decision.",
        ),
        requirements: &[("file_or_config", ".claude/agents/athena.md")],
    },
];

/// Why a source-grounded flagship flow must acquire repo context first.
pub const CONTEXT_REASONS: [(&str, &str); 7] = [
    (
        "mk:scout",
        "orients in the code by reading task-relevant files",
    ),
    (
        "mk:research",
        "grounds findings in the repository's actual code and config",
    ),
    (
        "mk:plan-creator",
        "plans against the real affected files and their revisions",
    ),
    (
        "mk:cook",
        "edits source and must verify against fresh, correctly-scoped evidence",
    ),
    (
        "mk:review",
        "reviews a change against the repository state it targets",
    ),
    (
        "mk:fix",
        "proves a bug's cause in the actual source before changing behavior",
    ),
    (
        "mk:testing",
        "writes/runs tests against the real code under test",
    ),
];
