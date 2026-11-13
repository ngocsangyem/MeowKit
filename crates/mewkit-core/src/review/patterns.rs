//! The impact map's classifiers, kept together so the whole vocabulary of
//! "what counts as source / a risk / an export" is readable in one place.
//!
//! Each pattern is the npm CLI's `RegExp` SOURCE, compiled through
//! [`crate::js_regex`] where it uses a shorthand class: `\s` and `\b` mean
//! different sets in JavaScript and in Rust's `regex`, and a classifier that
//! quietly matched a different set would move a file between "source" and
//! "other" — which moves the reviewer topology with it.
use std::sync::LazyLock;

use regex::Regex;

use crate::js_regex::{compile, compile_ci};

fn plain(source: &str) -> Regex {
    Regex::new(source).expect("a static classifier pattern")
}

pub static DIFF_HEADER_RE: LazyLock<Regex> =
    LazyLock::new(|| plain(r"^diff --git a/(.+?) b/(.+)$"));
pub static TEST_RE: LazyLock<Regex> =
    LazyLock::new(|| plain(r"(^|/)__tests__/|\.(test|spec)\.[cm]?[jt]sx?$"));
pub static DOCS_RE: LazyLock<Regex> = LazyLock::new(|| plain(r"(^|/)docs/|\.md$"));
pub static LOCKFILE_RE: LazyLock<Regex> =
    LazyLock::new(|| plain(r"(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|.*\.lock)$"));
pub static CONFIG_RE: LazyLock<Regex> =
    LazyLock::new(|| plain(r"\.(json|ya?ml|toml|ini|env)$|(^|/)\.env(\.|$)"));
pub static SOURCE_RE: LazyLock<Regex> =
    LazyLock::new(|| plain(r"\.[cm]?[jt]sx?$|\.py$|\.go$|\.rs$|\.rb$|\.java$|\.kt$|\.swift$"));
pub static IDENTIFIER_RE: LazyLock<Regex> = LazyLock::new(|| plain(r"^[A-Za-z0-9_$]+$"));

pub static ABSTRACTION_PATH_RE: LazyLock<Regex> = LazyLock::new(|| {
    compile_ci(r"(^|\/)(lib|utils?|helpers?|shared|common)(\/|[.-])").expect("abstraction pattern")
});
pub static CONFIG_KEY_RE: LazyLock<Regex> = LazyLock::new(|| {
    compile(r#"^\s*["']?([A-Za-z0-9_.-]+)["']?\s*[:=]"#).expect("config key pattern")
});
static EXPORT_DECL_RE: LazyLock<Regex> = LazyLock::new(|| {
    compile(
        r"export\s+(?:async\s+)?(?:default\s+)?(?:function|const|let|var|class|interface|type|enum)\s+([A-Za-z0-9_$]+)",
    )
    .expect("export declaration pattern")
});
static EXPORT_NAMED_RE: LazyLock<Regex> =
    LazyLock::new(|| compile(r"export\s*\{([^}]+)\}").expect("named export pattern"));
static AS_SPLIT_RE: LazyLock<Regex> =
    LazyLock::new(|| compile_ci(r"\s+as\s+").expect("rename-on-export pattern"));

/// Risk flags, with the pattern that raises each. Matched against BOTH the
/// changed line and the file path: a payment module with a neutral-looking
/// line is still a payment module.
pub static RISK_PATTERNS: LazyLock<Vec<(&'static str, Regex)>> = LazyLock::new(|| {
    [
        (
            "AUTH",
            r"auth|login|logout|session|jwt|oauth|passwd|password|passkey|token",
        ),
        (
            "PAYMENT",
            r"payment|billing|invoice|charge|stripe|payout|refund",
        ),
        (
            "DATA_MODEL",
            r"migration|schema|alter table|\bcascade\b|drop table|createtable",
        ),
        (
            "CONCURRENCY",
            r"mutex|lock|semaphore|worker|thread|race|atomic|concurren",
        ),
    ]
    .into_iter()
    .map(|(flag, source)| (flag, compile_ci(source).expect("a static risk pattern")))
    .collect()
});

/// Exported symbol names on one added or removed line.
pub fn export_symbols(line: &str) -> Vec<String> {
    let mut out = Vec::new();
    if let Some(decl) = EXPORT_DECL_RE.captures(line) {
        out.push(decl[1].to_string());
    }
    if let Some(named) = EXPORT_NAMED_RE.captures(line) {
        for part in named[1].split(',') {
            // `export { a as b }` exports the name on the RIGHT, so the last
            // segment of the split is the one consumers can import.
            let Some(name) = AS_SPLIT_RE.split(part.trim()).last() else {
                continue;
            };
            let name = name.trim();
            if IDENTIFIER_RE.is_match(name) {
                out.push(name.to_string());
            }
        }
    }
    out
}

#[cfg(test)]
#[path = "patterns_tests.rs"]
mod tests;
