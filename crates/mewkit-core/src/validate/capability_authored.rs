//! The authored half of the capability manifest: entries with no disk artifact,
//! and the curated overlays for the flagship flows.
//!
//! Every field here is hand-authored, which is what the `authored` provenance
//! records. An authored entry claims NO invocability (`none`, empty support)
//! until adapter evidence supplies it — an entry must never assert a capability
//! it cannot back. Port of `core/capability-authored.ts`.

/// One authored capability: the fields the validation and the generated view
/// read. `kind` doubles as the view's second column.
pub struct AuthoredCapability {
    pub id: &'static str,
    pub kind: &'static str,
    pub intents: &'static [&'static str],
}

/// Tool entries are DESCRIBE-ONLY (no user-facing intents): they model the
/// external integration and stay discoverable, but a user intent must resolve
/// to the invocable skill, not to a tool entry whose invocation is `none`.
pub const AUTHORED_CAPABILITIES: [AuthoredCapability; 6] = [
    AuthoredCapability {
        id: "jira",
        kind: "tool",
        intents: &[],
    },
    AuthoredCapability {
        id: "browser",
        kind: "tool",
        intents: &[],
    },
    AuthoredCapability {
        id: "project-context",
        kind: "context-service",
        intents: &["load project context", "read project conventions"],
    },
    AuthoredCapability {
        id: "task-record",
        kind: "state-service",
        intents: &["record task state", "resume a plan"],
    },
    AuthoredCapability {
        id: "trace-log",
        kind: "state-service",
        intents: &["record friction", "audit trace"],
    },
    AuthoredCapability {
        id: "advice-supervision",
        kind: "agent",
        intents: &[
            "strategic judgement",
            "decision recommendation",
            "delivery supervision",
        ],
    },
];

/// The flagship intent overlay for disk-backed capabilities. When a built
/// capability's id is here, its inferred keyword intents are REPLACED by this
/// curated set and its intents provenance becomes `authored` — deterministic
/// resolution for the highest-traffic flows.
pub const AUTHORED_INTENTS: [(&str, &[&str], &[&str]); 9] = [
    (
        "mk:scout",
        &[
            "scout the codebase",
            "find related files",
            "orient in the code",
            "locate code",
        ],
        &["scout"],
    ),
    (
        "mk:research",
        &[
            "research a library",
            "evaluate a technology",
            "gather best practices",
        ],
        &["research"],
    ),
    (
        "mk:plan-creator",
        &[
            "plan this feature",
            "create a plan",
            "draft a spec",
            "design the approach",
        ],
        &["plan"],
    ),
    (
        "mk:cook",
        &[
            "implement this feature",
            "build this",
            "write the code",
            "make this change",
        ],
        &["cook", "implement"],
    ),
    (
        "mk:review",
        &[
            "review this code",
            "code review",
            "check before shipping",
            "audit the change",
        ],
        &["review"],
    ),
    (
        "mk:fix",
        &["fix this bug", "fix the failing test", "debug this error"],
        &["fix"],
    ),
    (
        "mk:testing",
        &[
            "run the tests",
            "write tests for this",
            "check test coverage",
        ],
        &["test"],
    ),
    (
        "mk:ship",
        &["ship this change", "open a pull request", "create the PR"],
        &["ship"],
    ),
    (
        "mk:memory",
        &[
            "remember this decision",
            "recall a past fix",
            "prune old memory",
        ],
        &["memory"],
    ),
];

/// Capabilities that must acquire a task-scoped repo-context envelope before
/// source-grounded work. Ship (a VCS operation), memory and the external-tool
/// entries need no repo grounding, so they are deliberately absent.
pub const AUTHORED_CONTEXT_REQUIREMENTS: [&str; 7] = [
    "mk:scout",
    "mk:research",
    "mk:plan-creator",
    "mk:cook",
    "mk:review",
    "mk:fix",
    "mk:testing",
];

/// The curated overlay for one capability id, if it has one.
pub fn authored_overlay(id: &str) -> Option<(&'static [&'static str], &'static [&'static str])> {
    AUTHORED_INTENTS
        .iter()
        .find(|(key, _, _)| *key == id)
        .map(|(_, intents, aliases)| (*intents, *aliases))
}

#[cfg(test)]
#[path = "capability_authored_tests.rs"]
mod capability_authored_tests;
