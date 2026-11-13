//! Reading the names and the references the namespace rows judge.
//!
//! Split from the rows so the row builder reads as three verdicts rather than
//! as three scans. The `name:` patterns are the TypeScript ones verbatim,
//! including the deliberate difference between them: the agent form is
//! anchored at both ends, the skill form only at the start.
use std::collections::BTreeSet;
use std::fs;
use std::path::Path;
use std::sync::LazyLock;

use regex::Regex;

/// Prefix that scopes a skill name (`mk:cook`).
pub(super) const PLUGIN_NAME: &str = "mk";

/// Agent types the host runtime provides. References to these are always bare.
pub(super) const BUILTIN_AGENT_TYPES: [&str; 4] = ["Explore", "Bash", "general-purpose", "Plan"];

const REFERENCED_EXTENSIONS: [&str; 7] = ["md", "sh", "cjs", "mjs", "js", "ts", "py"];

/// `/^name:\s*["']?([^"'\r\n]+)["']?\s*$/m` — the frontmatter `name:` line.
///
/// `(?m)` stands in for the `m` flag. The pattern's own class already stops at
/// a `\r`, and `\s*` then consumes it, so a CRLF file anchors identically in
/// both engines without folding the line terminators first.
static AGENT_NAME: LazyLock<Regex> = LazyLock::new(|| {
    crate::js_regex::compile(r#"(?m)^name:\s*["']?([^"'\r\n]+)["']?\s*$"#)
        .expect("a static agent-name pattern")
});

/// The skill form is deliberately LOOSER than the agent form: it has no `$`
/// anchor, so a trailing comment on the line does not stop it matching.
static SKILL_NAME: LazyLock<Regex> = LazyLock::new(|| {
    crate::js_regex::compile(r#"(?m)^name:\s*["']?([^"'\r\n]+)"#)
        .expect("a static skill-name pattern")
});

static SUBAGENT_REF: LazyLock<Regex> = LazyLock::new(|| {
    crate::js_regex::compile(r#"subagent_type\s*[:=]\s*["']?([A-Za-z][A-Za-z0-9-]*)"#)
        .expect("a static subagent-ref pattern")
});

fn read_lossy(path: &Path) -> Option<String> {
    fs::read(path)
        .ok()
        .map(|bytes| String::from_utf8_lossy(&bytes).into_owned())
}

/// The bare `name:` value from each `*.md` in an agents directory.
///
/// Insertion-ordered and deduplicated, which is what a JavaScript `Set` is: the
/// detail line that lists offending names prints them in the order the
/// directory was read, so a sorted collection here would reorder that line.
pub fn collect_agent_names(agents_dir: &Path) -> Vec<String> {
    let mut names: Vec<String> = Vec::new();
    for entry in super::dir_order::sorted_entries(agents_dir) {
        let name = entry.file_name().to_string_lossy().into_owned();
        if !name.ends_with(".md") {
            continue;
        }
        let Some(text) = read_lossy(&entry.path()) else {
            continue;
        };
        if let Some(captured) = AGENT_NAME.captures(&text).and_then(|c| c.get(1)) {
            let value = captured.as_str().trim().to_string();
            if !names.contains(&value) {
                names.push(value);
            }
        }
    }
    names
}

fn walk(dir: &Path, out: &mut Vec<std::path::PathBuf>) {
    for entry in super::dir_order::sorted_entries(dir) {
        let path = entry.path();
        if path.is_dir() {
            walk(&path, out);
        } else if path.is_file() {
            out.push(path);
        }
    }
}

pub(super) fn skill_name_leaks(skills_dir: &Path) -> Vec<String> {
    let mut leaked = Vec::new();
    for entry in super::dir_order::sorted_entries(skills_dir) {
        if !entry.path().is_dir() {
            continue;
        }
        let skill_file = entry.path().join("SKILL.md");
        if !skill_file.exists() {
            continue;
        }
        let Some(text) = read_lossy(&skill_file) else {
            continue;
        };
        if let Some(found) = SKILL_NAME.captures(&text).and_then(|c| c.get(1)) {
            let value = found.as_str().trim();
            if !value.starts_with(&format!("{PLUGIN_NAME}:")) {
                leaked.push(format!("{} → {value}", entry.file_name().to_string_lossy()));
            }
        }
    }
    leaked
}

pub(super) fn stray_subagent_refs(claude_dir: &Path, allowed: &BTreeSet<String>) -> Vec<String> {
    let skills_dir = claude_dir.join("skills");
    let mut files = Vec::new();
    walk(&skills_dir, &mut files);
    let mut stray = Vec::new();
    for file in files {
        let name = file.file_name().unwrap_or_default().to_string_lossy();
        if !REFERENCED_EXTENSIONS
            .iter()
            .any(|ext| name.ends_with(&format!(".{ext}")))
        {
            continue;
        }
        let Some(text) = read_lossy(&file) else {
            continue;
        };
        for capture in SUBAGENT_REF.captures_iter(&text) {
            let reference = capture.get(1).map(|m| m.as_str()).unwrap_or_default();
            if allowed.contains(reference) || reference.starts_with(&format!("{PLUGIN_NAME}:")) {
                continue;
            }
            let rel = file
                .strip_prefix(claude_dir)
                .unwrap_or(&file)
                .display()
                .to_string();
            stray.push(format!("{rel} → {reference}"));
        }
    }
    stray
}
