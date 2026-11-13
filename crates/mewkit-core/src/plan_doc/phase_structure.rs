//! Structural checks for one `phase-XX-*.md` file, ported from
//! `core/plan-phase-structure.ts`.
//!
//! The document half: which template sections are present, whether the todo
//! list has checkboxes, and how long the file is. The declared-state half — the
//! frontmatter, where the severity split lives — is [`super::phase_frontmatter`].
use std::sync::LazyLock;

use regex::Regex;
use serde_json::{Map, Value};

use super::phase_frontmatter::check_frontmatter;
use crate::yaml_doc::{parse_value, split_frontmatter};

/// The full phase template. A phase file must be executable from a cold read.
pub const REQUIRED_PHASE_SECTIONS: [&str; 12] = [
    "## Context Links",
    "## Overview",
    "## Key Insights",
    "## Requirements",
    "## Architecture",
    "## Related Code Files",
    "## Implementation Steps",
    "## Todo List",
    "## Success Criteria",
    "## Risk Assessment",
    "## Security Considerations",
    "## Next Steps",
];

const MAX_PHASE_LINES: usize = 200;

static TODO: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?m)^[ \t]*-[ \t]*\[( |x|X)\][ \t]+").expect("static todo pattern")
});
static NEXT_SECTION: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\n##[^#]").expect("static next-section pattern"));

/// Frontmatter as a map, or `None` when absent or malformed — the two cases the
/// TypeScript collapses into one `null`, because both mean "nothing to check".
///
/// The one divergence: the TypeScript's closing fence is `\r?\n---`, which also
/// accepts a line BEGINNING with `---`; [`split_frontmatter`] wants the whole
/// line. A plan whose frontmatter ends `---some-text` therefore reads as
/// malformed here and as parsed there. Keeping one YAML reader in this crate is
/// worth that: a second one would answer differently far more often than a
/// closing fence with a suffix occurs.
pub fn parse_frontmatter(content: &str) -> Option<Map<String, Value>> {
    let (block, _) = split_frontmatter(content)?;
    match parse_value(block) {
        Ok(Value::Object(map)) => Some(map),
        _ => None,
    }
}

/// A named `## ` section's body, up to the next `## ` heading.
pub fn section_body<'a>(content: &'a str, heading: &str) -> Option<&'a str> {
    let index = content.find(&format!("{heading}\n"))?;
    let rest = &content[index + heading.len() + 1..];
    match NEXT_SECTION.find(rest) {
        Some(m) => Some(&rest[..m.start()]),
        None => Some(rest),
    }
}

/// Total and checked todos in the `## Todo List` section.
pub fn count_checkboxes(content: &str) -> (usize, usize) {
    let Some(body) = section_body(content, "## Todo List") else {
        return (0, 0);
    };
    let mut total = 0;
    let mut checked = 0;
    for caps in TODO.captures_iter(body) {
        total += 1;
        if matches!(caps.get(1).map(|m| m.as_str()), Some("x") | Some("X")) {
            checked += 1;
        }
    }
    (total, checked)
}

/// Every issue in one phase file, in print order (`WARN `/`ERROR ` prefixes
/// applied).
pub fn check_phase_file(content: &str, basename: &str) -> Vec<String> {
    let mut issues: Vec<String> = REQUIRED_PHASE_SECTIONS
        .iter()
        .filter(|section| !content.contains(**section))
        .map(|section| format!("{basename}: Missing section: {section}"))
        .collect();

    if let Some(todo) = section_body(content, "## Todo List") {
        let trimmed = todo.trim();
        if trimmed.is_empty() || (!trimmed.contains("- [ ]") && !trimmed.contains("- [x]")) {
            issues.push(format!("{basename}: Todo List has no checkboxes"));
        }
    }

    let lines = content.trim().split('\n').count();
    if lines > MAX_PHASE_LINES {
        issues.push(format!("{basename}: {lines} lines (max 150 recommended)"));
    }

    let frontmatter = check_frontmatter(content, basename);
    issues.extend(
        frontmatter
            .warnings
            .into_iter()
            .map(|w| format!("WARN {w}")),
    );
    issues.extend(frontmatter.errors.into_iter().map(|e| format!("ERROR {e}")));
    issues
}

#[cfg(test)]
#[path = "phase_structure_tests.rs"]
mod tests;
