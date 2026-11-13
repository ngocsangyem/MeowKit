//! The agent-only inventory fields: class, routing, declared ownership, trigger.
//!
//! Split from the builder because these are CLASSIFICATIONS rather than reads —
//! they are generated from the agent's id and body, never hand-maintained in a
//! roster, which is what keeps a renamed agent from keeping a stale class.
use std::sync::LazyLock;

use regex::Regex;

/// `(agentClass, routing, public)` for one agent id.
///
/// `advisor` is reached only through the advise skill. Athena has both a bounded
/// `--advice` harness route and an explicitly requested stateless consult.
pub fn agent_contract_fields(id: &str) -> (&'static str, &'static str, bool) {
    match id {
        "advisor" => ("internal", "harness", false),
        "athena" => ("intelligence", "direct-and-harness", true),
        "story-sizer" => ("intelligence", "direct-only", true),
        _ if id.starts_with("jira-") || id.starts_with("confluence-") => {
            ("domain", "hub-only", true)
        }
        _ => ("core-support", "direct-only", true),
    }
}

static OWNERSHIP_HEADING: LazyLock<Regex> = LazyLock::new(|| {
    crate::js_regex::compile(r"(?m)^## (?:Exclusive|Artifact) Ownership\s*$")
        .expect("a static ownership-heading pattern")
});

static BACKTICKED: LazyLock<Regex> =
    LazyLock::new(|| crate::js_regex::compile("`([^`]+)`").expect("a static backtick pattern"));

static NEXT_HEADING: LazyLock<Regex> =
    LazyLock::new(|| crate::js_regex::compile(r"(?m)^## ").expect("a static heading pattern"));

/// The paths an agent's ownership section claims.
///
/// Scoped to the section when there is one, and to the whole body when there is
/// not — the TypeScript's `split(/^## /m, 1)[0]` keeps only the text up to the
/// NEXT heading, so an unrelated later section cannot contribute paths.
pub fn agent_declared_artifacts(body: &str) -> Vec<String> {
    let section = match OWNERSHIP_HEADING.find(body) {
        Some(heading) => {
            let after = &body[heading.end()..];
            match NEXT_HEADING.find(after) {
                Some(next) => &after[..next.start()],
                None => after,
            }
        }
        None => body,
    };
    BACKTICKED
        .captures_iter(section)
        .filter_map(|capture| capture.get(1).map(|m| m.as_str().to_string()))
        .filter(|value| value.contains('/') && !value.starts_with("mk:"))
        .collect()
}

static ROUTING_VERB: LazyLock<Regex> = LazyLock::new(|| {
    crate::js_regex::compile_ci(r"\b(?:use|runs?|activated|auto-activates|invoked|routed)\b")
        .expect("a static routing-verb pattern")
});

static NEGATIVE_BOUNDARY: LazyLock<Regex> = LazyLock::new(|| {
    crate::js_regex::compile_ci(r"\b(?:not|never|does not)\b")
        .expect("a static negative-boundary pattern")
});

/// True when a description both claims a trigger and draws its boundary — the
/// two halves a core/support agent's description has to carry.
pub fn trigger_owner(description: &str) -> bool {
    ROUTING_VERB.is_match(description) && NEGATIVE_BOUNDARY.is_match(description)
}

#[cfg(test)]
#[path = "inventory_agent_tests.rs"]
mod inventory_agent_tests;
