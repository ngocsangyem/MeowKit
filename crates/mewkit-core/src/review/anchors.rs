//! Pin an inline comment to a line by matching its quoted SNIPPET against the
//! captured diff — never by trusting a line number a reviewer reported.
//!
//! A reported line number is a guess about a file the reviewer may have read in
//! a different revision; posting an inline comment on the wrong line is worse
//! than posting it in the body, because it looks precise. So an ambiguous or
//! absent snippet is REFUSED and the caller keeps the finding in the body.
use std::sync::LazyLock;

use regex::Regex;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResolvedAnchor {
    pub file: String,
    /// 1-based line in the pull request's NEW file.
    pub line: u64,
    pub snippet: String,
}

/// Why a snippet could not be pinned. Both reasons are reported verbatim in
/// the proof bundle, so a reviewer can see which one happened.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AnchorMiss {
    NotFound,
    Ambiguous,
}

impl AnchorMiss {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::NotFound => "not-found",
            Self::Ambiguous => "ambiguous",
        }
    }
}

static HEADER_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^diff --git a/.+? b/(.+)$").expect("static header pattern"));
static HUNK_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^@@ -[0-9]+(?:,[0-9]+)? \+([0-9]+)(?:,[0-9]+)? @@").expect("static hunk pattern")
});

/// Collapse runs of whitespace, so a snippet that survived a reformat still
/// matches — but only when no exact match exists. JavaScript's whitespace set,
/// not Rust's: they differ at U+FEFF and U+0085, and a snippet lifted from a
/// diff can carry either.
fn norm(text: &str) -> String {
    text.split(crate::js_regex::is_js_whitespace)
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
}

/// `String.prototype.trim`, which uses the same set as `\s`.
fn js_trim(text: &str) -> &str {
    text.trim_matches(crate::js_regex::is_js_whitespace)
}

pub fn resolve_anchor(
    diff_text: &str,
    file: &str,
    snippet: &str,
) -> Result<ResolvedAnchor, AnchorMiss> {
    let want = js_trim(snippet);
    let want_norm = norm(snippet);
    if want.is_empty() {
        return Err(AnchorMiss::NotFound);
    }

    let mut in_target = false;
    let mut new_line: u64 = 0;
    let (mut exact, mut fuzzy): (Vec<u64>, Vec<u64>) = (Vec::new(), Vec::new());

    for raw in diff_text.split('\n') {
        if let Some(header) = HEADER_RE.captures(raw) {
            in_target = &header[1] == file;
            new_line = 0;
            continue;
        }
        if !in_target {
            continue;
        }
        if let Some(hunk) = HUNK_RE.captures(raw) {
            new_line = hunk[1].parse().unwrap_or(0);
            continue;
        }
        if raw.starts_with("+++") || raw.starts_with("---") {
            continue;
        }
        if let Some(content) = raw.strip_prefix('+') {
            if js_trim(content) == want {
                exact.push(new_line);
            } else if norm(content) == want_norm {
                fuzzy.push(new_line);
            }
            new_line += 1;
        } else if raw.starts_with('-') {
            // A removed line does not exist in the new file, so it does not
            // advance the counter.
        } else if raw.starts_with(' ') || raw.is_empty() {
            new_line += 1;
        }
    }

    let hits = if exact.is_empty() { fuzzy } else { exact };
    match hits.len() {
        0 => Err(AnchorMiss::NotFound),
        1 => Ok(ResolvedAnchor {
            file: file.to_string(),
            line: hits[0],
            snippet: want.to_string(),
        }),
        _ => Err(AnchorMiss::Ambiguous),
    }
}

#[cfg(test)]
#[path = "anchors_tests.rs"]
mod tests;
