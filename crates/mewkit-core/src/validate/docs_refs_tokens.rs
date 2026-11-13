//! The allowlist the scan judges against, and the tokens it judges.
//!
//! Split from the walk so each file answers one question: this one is "what
//! does the contract allow, and what does a line claim", the other is "which
//! files are read". Every pattern is compiled through [`crate::js_regex`],
//! because `\s` and `\d` do not mean in Rust what they mean in a JavaScript
//! `RegExp` without the `u` flag.
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::LazyLock;

use regex::Regex;

use super::docs_refs::CONTRACT_REL_PATH;

/// The contract, resolved from the parent of `.claude/`.
pub fn resolve_contract_path(claude_dir: &Path) -> PathBuf {
    let root = claude_dir.parent().unwrap_or(claude_dir);
    CONTRACT_REL_PATH
        .split('/')
        .fold(root.to_path_buf(), |acc, part| acc.join(part))
}

fn extract_fenced(content: &str, marker: &str) -> Vec<String> {
    let start_tag = format!("<!-- {marker}-START -->");
    let end_tag = format!("<!-- {marker}-END -->");
    let Some(start) = content.find(&start_tag) else {
        return Vec::new();
    };
    let Some(end) = content.find(&end_tag) else {
        return Vec::new();
    };
    if end < start {
        return Vec::new();
    }
    content[start + start_tag.len()..end]
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty() && !line.starts_with('#') && !line.starts_with("<!--"))
        .map(str::to_string)
        .collect()
}

/// The two lists the contract carries: allowed paths, and reserved future ones.
pub fn parse_allowlist(contract_path: &Path) -> (Vec<String>, Vec<String>) {
    let content = fs::read_to_string(contract_path).unwrap_or_default();
    (
        extract_fenced(&content, "ALLOWLIST"),
        extract_fenced(&content, "RESERVED"),
    )
}

/// A trailing `/` makes an entry a prefix; anything else is an exact path.
pub(super) fn is_allowed(token: &str, allowed: &[String]) -> bool {
    allowed.iter().any(|entry| {
        if let Some(prefix) = entry.strip_suffix('/') {
            token.starts_with(&format!("{prefix}/"))
        } else {
            token == entry
        }
    })
}

static URL: LazyLock<Regex> = LazyLock::new(|| {
    crate::js_regex::compile(r#"https?://[^\s)\]\"'`,]+"#).expect("a static URL pattern")
});
static ANGLED: LazyLock<Regex> =
    LazyLock::new(|| crate::js_regex::compile("<[^>]*>").expect("a static tag pattern"));
static TOKEN: LazyLock<Regex> = LazyLock::new(|| {
    crate::js_regex::compile(r"docs/[A-Za-z0-9_./\-]+").expect("a static docs-token pattern")
});
static TRAILING_PUNCTUATION: LazyLock<Regex> = LazyLock::new(|| {
    crate::js_regex::compile(r"[.,)\]]+$").expect("a static trailing-punctuation pattern")
});

/// Every `docs/<path>` token on one line, with URLs and angle-bracketed content
/// removed first so a documentation URL or an HTML tag cannot look like a path.
pub fn extract_tokens(line: &str) -> Vec<String> {
    let cleaned = ANGLED
        .replace_all(&URL.replace_all(line, ""), "")
        .into_owned();
    TOKEN
        .find_iter(&cleaned)
        .map(|m| TRAILING_PUNCTUATION.replace(m.as_str(), "").into_owned())
        .collect()
}
