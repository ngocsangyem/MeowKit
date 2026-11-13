//! The shared denied-token set: Claude-Code-bound constructs that must not
//! appear in content installed for another provider.
//!
//! Pure and provider-neutral — the set describes the COUPLING; an adapter
//! decides how to remove or map each token. This module only detects, which is
//! what lets the portability classifier and the target checker share one
//! definition of "not portable".
use std::sync::LazyLock;

use regex::Regex;

/// Claude-Code-bound constructs that must not appear in content installed for
/// another provider. "subagent" is deliberately NOT denied: it is native Codex
/// vocabulary, and flagging it was a false positive.
static DENIED_TOKENS: LazyLock<Vec<(&'static str, Regex)>> = LazyLock::new(|| {
    [
        ("mk/meow slash command", r"/(?:mk|meow):[a-z]", true),
        ("AskUserQuestion tool", r"\bAskUserQuestion\b", false),
        (".claude path", r"\.claude/", false),
        ("CLAUDE.md reference", r"\bCLAUDE\.md\b", false),
        ("Task( tool call", r"\bTask\(", false),
        ("Claude env var", r"\$\{?CLAUDE_[A-Z0-9_]+", false),
        ("Anthropic env var", r"\$\{?ANTHROPIC_[A-Z0-9_]+", false),
    ]
    .iter()
    .map(|(label, source, case_insensitive)| {
        let compiled = if *case_insensitive {
            crate::js_regex::compile_ci(source)
        } else {
            crate::js_regex::compile(source)
        };
        (*label, compiled.expect("a static denied-token pattern"))
    })
    .collect()
});

/// Labels whose findings are a WARN rather than a FAIL.
pub(super) const PATH_CLASS: [&str; 2] = [".claude path", "CLAUDE.md reference"];

/// Every distinct denied-token CLASS present — one entry per class, not per hit.
pub(super) fn scan_denied_tokens(content: &str) -> Vec<&'static str> {
    DENIED_TOKENS
        .iter()
        .filter(|(_, pattern)| pattern.is_match(content))
        .map(|(label, _)| *label)
        .collect()
}
