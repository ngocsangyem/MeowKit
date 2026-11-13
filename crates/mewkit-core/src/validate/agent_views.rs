//! The generated agent-registry view, and when two ownership globs collide.
//!
//! Split from the conformance check because both are pure functions over the
//! inventory: one renders the line the index must carry, the other answers
//! whether two patterns can match the same path.
use std::path::Path;
use std::sync::LazyLock;

use regex::Regex;

use super::inventory_build::build_inventory;

pub const VIEW_START: &str = "<!-- GENERATED:agent-views START -->";
pub const VIEW_END: &str = "<!-- GENERATED:agent-views END -->";

/// A verdict pattern's identity is its whole suffix segment, so two verdict
/// patterns collide only when identical. Any other one-star pattern intersects
/// when its fixed prefix and suffix are compatible.
static VERDICT_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    crate::js_regex::compile(r"^tasks/reviews/\*-(?:evalverdict|security-verdict|verdict)\.md$")
        .expect("a static verdict pattern")
});

pub fn artifact_patterns_overlap(left: &str, right: &str) -> bool {
    if VERDICT_PATTERN.is_match(left) && VERDICT_PATTERN.is_match(right) {
        return left == right;
    }
    let split = |pattern: &str| -> Option<(String, String)> {
        let star = pattern.find('*')?;
        Some((pattern[..star].to_string(), pattern[star + 1..].to_string()))
    };
    let (Some(a), Some(b)) = (split(left), split(right)) else {
        return left == right;
    };
    (a.0.starts_with(&b.0) || b.0.starts_with(&a.0)) && (a.1.ends_with(&b.1) || b.1.ends_with(&a.1))
}

/// The one generated line the agents index must carry, markers included.
pub fn render_agent_view_counts(claude_dir: &Path) -> String {
    let entries = build_inventory(claude_dir).entries;
    let count = |agent_class: &str, routing: &str| {
        entries
            .iter()
            .filter(|entry| {
                entry.agent_class == Some(agent_class) && entry.routing == Some(routing)
            })
            .count()
    };
    format!(
        "{VIEW_START}\n**Agent registry views (generated):** {} core/support direct-only; \
         {} domain hub-only; {} intelligence direct-only; {} intelligence direct-and-harness; \
         {} internal harness.\n{VIEW_END}",
        count("core-support", "direct-only"),
        count("domain", "hub-only"),
        count("intelligence", "direct-only"),
        count("intelligence", "direct-and-harness"),
        count("internal", "harness"),
    )
}

#[cfg(test)]
#[path = "agent_views_tests.rs"]
mod agent_views_tests;
