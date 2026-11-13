//! The Codex target's skill, rules and legacy-surface rows.
//!
//! The denied-token split is the load-bearing part: a path-class token can be a
//! genuinely out-of-set reference the migration PRESERVES verbatim rather than
//! fabricate a Codex path, so those WARN. A tool/invocation token has no Codex
//! primitive and no preserve case, so it FAILS.
use std::path::Path;

use serde_json::Value;

use super::denied_tokens::{PATH_CLASS, scan_denied_tokens};
use super::result::{CheckResult, Status};
use super::target_helpers::row;

/// Installed skills: frontmatter parses, the runtime is provider-supported, and
/// the body carries no denied tokens.
pub fn check_skills(dir: &Path) -> Vec<CheckResult> {
    let skills_dir = dir.join(".agents").join("skills");
    if !skills_dir.exists() {
        return Vec::new();
    }
    let skill_dirs: Vec<String> = super::dir_order::sorted_entries(&skills_dir)
        .iter()
        .filter(|entry| entry.path().is_dir())
        .map(|entry| entry.file_name().to_string_lossy().into_owned())
        .collect();

    let mut bad_frontmatter = Vec::new();
    let mut bad_runtime = Vec::new();
    let mut tool_leaks = Vec::new();
    let mut path_leaks = Vec::new();

    for name in &skill_dirs {
        let skill_md = skills_dir.join(name).join("SKILL.md");
        if !skill_md.exists() {
            bad_frontmatter.push(format!("{name} (no SKILL.md)"));
            continue;
        }
        let content = std::fs::read(&skill_md)
            .map(|bytes| String::from_utf8_lossy(&bytes).into_owned())
            .unwrap_or_default();
        // An unparseable or absent block yields no frontmatter; a valid
        // SKILL.md always declares `name`, so its absence signals a break.
        let meta = crate::yaml_doc::parse_frontmatter(&content)
            .ok()
            .and_then(|parsed| parsed.map().cloned());
        let Some(meta) = meta.filter(|map| map.contains_key("name")) else {
            bad_frontmatter.push(name.clone());
            continue;
        };
        // Codex installs only portable/adapted skills — a claude-code runtime
        // should never reach here.
        if meta.get("runtime").and_then(Value::as_str) == Some("claude-code") {
            bad_runtime.push(name.clone());
        }
        let hits = scan_denied_tokens(&content);
        let tools: Vec<&str> = hits
            .iter()
            .copied()
            .filter(|label| !PATH_CLASS.contains(label))
            .collect();
        let paths: Vec<&str> = hits
            .iter()
            .copied()
            .filter(|label| PATH_CLASS.contains(label))
            .collect();
        if !tools.is_empty() {
            tool_leaks.push(format!("{name} [{}]", tools.join(", ")));
        }
        if !paths.is_empty() {
            path_leaks.push(format!("{name} [{}]", paths.join(", ")));
        }
    }

    let mut out = vec![if bad_frontmatter.is_empty() {
        row(
            "Codex installed skills parse",
            Status::Pass,
            format!("{} skill(s), frontmatter parses", skill_dirs.len()),
        )
    } else {
        row(
            "Codex installed skills parse",
            Status::Fail,
            format!("invalid/absent frontmatter: {}", bad_frontmatter.join(", ")),
        )
    }];
    out.push(if bad_runtime.is_empty() {
        row(
            "Codex installed skills runtime-supported",
            Status::Pass,
            "no runtime: claude-code among installed skills".to_string(),
        )
    } else {
        row(
            "Codex installed skills runtime-supported",
            Status::Fail,
            format!(
                "runtime: claude-code installed (default-deny breach): {}",
                bad_runtime.join(", ")
            ),
        )
    });
    out.push(if tool_leaks.is_empty() {
        row(
            "Codex installed skills tool-token clean",
            Status::Pass,
            "no Claude tool/invocation tokens in installed skill bodies".to_string(),
        )
    } else {
        row(
            "Codex installed skills tool-token clean",
            Status::Fail,
            format!("host-bound tool tokens present: {}", truncated(&tool_leaks)),
        )
    });
    if !path_leaks.is_empty() {
        out.push(row(
            "Codex installed skills path refs",
            Status::Warn,
            format!(
                "preserved out-of-set path ref(s) — verify they resolve on Codex: {}",
                truncated(&path_leaks)
            ),
        ));
    }
    out
}

/// `a; b; c` capped at five, with the overflow counted — the npm rendering.
fn truncated(items: &[String]) -> String {
    let listed = items.iter().take(5).cloned().collect::<Vec<_>>().join("; ");
    if items.len() > 5 {
        format!("{listed} (+{} more)", items.len() - 5)
    } else {
        listed
    }
}
