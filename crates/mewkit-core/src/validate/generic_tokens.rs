//! Provider-specific prose in canonical skill BODIES — an advisory baseline.
//!
//! The rule keeps skill bodies free of vendor and product names, so a body
//! reads the same on every host. It is a WARN everywhere it is used: the
//! migration to semantic capability prose is gradual, and a blocking check
//! would stop every unrelated change. Port of
//! `core/check-generic-core-tokens.ts`.
use std::path::Path;
use std::sync::LazyLock;

use super::generic_tokens_body::{body_lines, is_cli_brand_mention, is_state_tree_path};
use regex::Regex;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TokenCategory {
    ProviderTool,
    ModelOrTier,
    ContextWindow,
    Brand,
}

impl TokenCategory {
    fn as_str(self) -> &'static str {
        match self {
            TokenCategory::ProviderTool => "provider-tool",
            TokenCategory::ModelOrTier => "model-or-tier",
            TokenCategory::ContextWindow => "context-window",
            TokenCategory::Brand => "brand",
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct GenericCoreTokenFinding {
    pub file: String,
    pub line: usize,
    pub token: String,
    pub category: TokenCategory,
}

/// The rule table, in report order. Case-insensitive except the provider-tool
/// row, which names tools by their exact spelling.
static TOKEN_RULES: LazyLock<Vec<(TokenCategory, Regex)>> = LazyLock::new(|| {
    vec![
        (
            TokenCategory::ProviderTool,
            crate::js_regex::compile(r"\bAskUserQuestion\b|\bAgent\s*\(|\bTask\s*\(")
                .expect("a static provider-tool pattern"),
        ),
        (
            TokenCategory::ModelOrTier,
            crate::js_regex::compile_ci(r"\b(?:haiku|sonnet|opus|claude-[a-z0-9.-]+)\b")
                .expect("a static model pattern"),
        ),
        (
            TokenCategory::ContextWindow,
            crate::js_regex::compile_ci(
                r"\b\d{2,3}K\b|\b(?:[5-9]\d|100)%\s+(?:of\s+)?(?:the\s+)?(?:context|token)\b",
            )
            .expect("a static context-window pattern"),
        ),
        (
            TokenCategory::Brand,
            crate::js_regex::compile_ci(r"\bmeowkit\b").expect("a static brand pattern"),
        ),
    ]
});

/// Every `.md` under `<root>/<scan_dir>`, EXCLUDING the scan dir's own top
/// level: a `skills/*.md` beside the skill folders is not a skill body.
fn markdown_files(root: &Path, dir: &str, scan_dir: &str, files: &mut Vec<String>) {
    let absolute = dir
        .split('/')
        .fold(root.to_path_buf(), |acc, part| acc.join(part));
    if !absolute.exists() {
        return;
    }
    for entry in super::dir_order::sorted_entries(&absolute) {
        let name = entry.file_name().to_string_lossy().into_owned();
        let relative = format!("{dir}/{name}");
        if entry.path().is_dir() {
            markdown_files(root, &relative, scan_dir, files);
        } else if dir != scan_dir && entry.path().is_file() && name.ends_with(".md") {
            files.push(relative);
        }
    }
}

/// Provider-specific prose in canonical skill bodies. Callers report, not block.
pub fn find_generic_core_tokens(root: &Path) -> Vec<GenericCoreTokenFinding> {
    let scan_dir = "skills";
    let mut files = Vec::new();
    markdown_files(root, scan_dir, scan_dir, &mut files);
    files.sort();
    let mut findings = Vec::new();
    for file in files {
        let absolute = file
            .split('/')
            .fold(root.to_path_buf(), |acc, part| acc.join(part));
        let content = std::fs::read(&absolute)
            .map(|bytes| String::from_utf8_lossy(&bytes).into_owned())
            .unwrap_or_default();
        for line in body_lines(&content) {
            for (category, pattern) in TOKEN_RULES.iter() {
                for found in pattern.find_iter(&line.text) {
                    if *category == TokenCategory::Brand
                        && (is_cli_brand_mention(
                            &line.text,
                            found.start(),
                            found.as_str(),
                            line.code_fence,
                        ) || is_state_tree_path(&line.text, found.start(), found.as_str()))
                    {
                        continue;
                    }
                    findings.push(GenericCoreTokenFinding {
                        file: file.clone(),
                        line: line.line,
                        token: found.as_str().to_string(),
                        category: *category,
                    });
                }
            }
        }
    }
    findings
}

/// A compact, deterministic baseline for the validate output.
pub fn summarize_generic_core_tokens(findings: &[GenericCoreTokenFinding]) -> String {
    [
        TokenCategory::ProviderTool,
        TokenCategory::ModelOrTier,
        TokenCategory::ContextWindow,
        TokenCategory::Brand,
    ]
    .iter()
    .map(|category| {
        format!(
            "{}={}",
            category.as_str(),
            findings.iter().filter(|f| f.category == *category).count()
        )
    })
    .collect::<Vec<_>>()
    .join(", ")
}
