//! The count claims this kit makes about itself, and where each is written.
//!
//! The docs SITE is deliberately absent: its pages state capabilities without
//! counting them, because a count in evergreen prose is a fact with an expiry
//! date. A drift check against a claim that was withdrawn on purpose would
//! report the withdrawal as drift, forever.
use std::path::Path;

use super::stale_index::{CountSpec, actual_counts};

/// The count claims, anchored to each doc's real format.
pub(super) fn count_specs(repo_root: &Path) -> Vec<CountSpec> {
    let counts = actual_counts(&repo_root.join(".claude"));
    vec![
        CountSpec {
            source: "README.md",
            label: "skills",
            pattern: r"(\d+)\s+skills",
            actual: counts.skills.len(),
        },
        CountSpec {
            source: "README.md",
            label: "agents",
            pattern: r"(\d+)\s+(?:specialist\s+)?agents",
            actual: counts.agents.len(),
        },
        CountSpec {
            source: "README.md",
            label: "rules",
            pattern: r"(\d+)\s+(?:enforcement\s+)?rules",
            actual: counts.rules.len(),
        },
        CountSpec {
            source: "README.md",
            label: "hook scripts",
            pattern: r"(\d+)\s+hook scripts",
            actual: counts.hooks.len(),
        },
        CountSpec {
            source: ".claude/agents/SKILLS_INDEX.md",
            label: "skills total",
            pattern: r"\*\*Total\*\*\|\*\*(\d+)\*\*",
            actual: counts.skills.len(),
        },
        CountSpec {
            source: ".claude/agents/AGENTS_INDEX.md",
            label: "agents index header",
            pattern: r"\[(\d+)\]\{agent_file",
            actual: counts.agents.len(),
        },
        CountSpec {
            source: ".claude/hooks/HOOKS_INDEX.md",
            // "shell hooks" until the runtime became node, at which point the
            // token stopped existing and the check reported "token not found"
            // forever. The label has to describe the hooks actually shipped.
            label: "node hooks",
            pattern: r"(\d+)\s+node hook",
            actual: counts.hooks.len(),
        },
        // The UNDATED overview prose only. The dated "Component Inventory"
        // table below it is a historical snapshot and is intentionally not
        // count-generated — bumping it would falsify the audit record.
        CountSpec {
            source: "docs/core/meowkit-architecture.md",
            label: "arch overview skills",
            pattern: r"(\d+)\s+domain skills",
            actual: counts.skills.len(),
        },
        CountSpec {
            source: "docs/core/meowkit-architecture.md",
            label: "arch overview rules",
            pattern: r"(\d+)\s+rule files",
            actual: counts.rules.len(),
        },
    ]
}
