//! Injection patterns and the one-hit content check.
//!
//! Port of the `INJECTION_PATTERNS` + `validateContent` half of
//! `state/injection-scanner.ts`. The first 8 patterns are verbatim from
//! `hooks/lib/validate-content.cjs`; the rest are the web-to-markdown Layer 5
//! local additions (tool-call hijack, memory poisoning, role-play) and the
//! security-audit additions.
//!
//! MIRROR `hooks/lib/validate-content.cjs` when these change — the hook and the
//! CLI must reject the same content, or a write the lint rejects could still land.
//!
//! The stored `&str` IS the pattern source, byte for byte identical to the JS
//! `RegExp.source`, because an obfuscated finding reports the pattern (never the
//! decoded, attacker-controlled payload) and that text is read in CI logs.
//! `tests/injection_parity.rs` asserts that identity against the TypeScript file
//! at test time, so the table cannot drift away from the source it mirrors.
//!
//! Each source is compiled through [`crate::js_regex`], which gives `\b`, `\w`,
//! `\d` and `\s` the ECMAScript meanings a `RegExp` without the `u` flag has.
//! Compiled as plain Rust patterns they are NOT equivalent: Unicode `\b` is not
//! a boundary next to `é`, so `éjailbreak` matched in JavaScript and not here.
use std::sync::LazyLock;

use regex::Regex;

use crate::js_regex;

/// Pattern sources, in scan order. Order is load-bearing: the first hit is the
/// one reported.
pub const INJECTION_PATTERN_SOURCES: &[&str] = &[
    r"ignore\s+(?:previous|all)\s+instructions",
    r"disregard\s+(?:rules|instructions|safety)",
    r"you\s+are\s+now",
    r"forget\s+your",
    r"new\s+system\s+prompt",
    r"<\/?memory-data[^>]*>",
    r"pretend\s+you\s+are",
    r"act\s+as\s+if",
    // web-to-markdown Layer 5 local additions:
    r"your\s+(?:previous\s+)?instructions\s+(?:have\s+been\s+)?updated",
    r"call\s+the\s+\w+\s+tool",
    r"use\s+the\s+(?:bash|write|edit|read)\s+tool",
    r"add\s+this\s+to\s+your\s+memory",
    r"\bDAN\s+mode\b",
    r"you'?re\s+an?\s+uncensored",
    // Security-audit additions (instruction-override / exfil / jailbreak / role-play):
    r"\bjailbreak\b",
    r"(?:reveal|print|repeat|show)\s+(?:your|the)\s+(?:system\s+)?(?:prompt|instructions)",
    r"(?:override|bypass|ignore)\s+(?:the\s+)?(?:safety|security|content)\s+(?:filter|policy|guidelines)",
    r"without\s+(?:any\s+)?restrictions?",
    r"exfiltrat",
    r"(?:send|post|upload|leak)\s+(?:the\s+)?(?:secret|token|password|api[_-]?key|env|credentials?)",
    r"do\s+not\s+(?:tell|inform|alert|warn)\s+(?:the\s+)?(?:user|human)",
    r"system\s*:\s*you\s+(?:are|must)",
    r"developer\s+mode\s+(?:enabled|on)",
    // Expansion toward web-to-markdown Layer-5 parity. Scoped to ASSISTANT-DIRECTED
    // phrasings only — generic shell/code terms (curl, rm -rf, execute) are
    // intentionally NOT here, since committed project knowledge carries legitimate
    // shell examples (avoid false-positive rejection of real content).
    r"from\s+now\s+on[, ]+you\s+(?:are|will|must|should)",
    r"stay\s+in\s+character",
    r"roleplay\s+as",
    r"act\s+as\s+(?:an?\s+)?(?:dan|jailbroken|unfiltered|uncensored)",
    r"this\s+is\s+(?:just\s+)?a\s+test\s+of\s+your",
    r"decode\s+the\s+following\s+(?:base64|rot13|text|string)",
    r"\bsudo\s+mode\b",
    r"disable\s+(?:your\s+)?(?:safety|guardrails?|filters?)",
    r"turn\s+off\s+(?:your\s+)?safety",
    r"send\s+(?:it|this|them|the\s+\w+)\s+to\s+https?:\/\/",
    r"(?:post|upload)\s+(?:the\s+)?(?:secret|token|key|data|env|file)\s+to\b",
    r"what\s+(?:is|are)\s+your\s+(?:initial\s+|original\s+)?instructions",
    r"repeat\s+the\s+(?:words|text|content)\s+above",
    r"ignore\s+(?:the\s+)?(?:above|preceding|prior)\b",
    r"override\s+(?:your\s+)?(?:prior|previous)\s+(?:directives|rules|instructions)",
    r"new\s+persona\b",
];

static INJECTION_PATTERNS: LazyLock<Vec<Regex>> = LazyLock::new(|| {
    INJECTION_PATTERN_SOURCES
        .iter()
        .map(|source| {
            js_regex::compile_ci(source)
                .unwrap_or_else(|e| panic!("injection pattern {source:?} is not usable: {e}"))
        })
        .collect()
});

/// The first pattern that matched. `pattern` is the pattern SOURCE, `matched` the
/// text it matched — the TS `{valid: false, pattern, match}` shape.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct InjectionHit {
    pub pattern: &'static str,
    pub matched: String,
}

/// Mirror of `validateContent`: `None` on pass, the first hit otherwise. Empty
/// text always passes.
pub fn validate_content(text: &str) -> Option<InjectionHit> {
    if text.is_empty() {
        return None;
    }
    for (index, pattern) in INJECTION_PATTERNS.iter().enumerate() {
        if let Some(m) = pattern.find(text) {
            return Some(InjectionHit {
                pattern: INJECTION_PATTERN_SOURCES[index],
                matched: m.as_str().to_string(),
            });
        }
    }
    None
}

/// Every pattern compiles. Called by the test suite; also a cheap startup guard
/// for a caller that wants to fail fast rather than on first scan.
pub fn pattern_count() -> usize {
    INJECTION_PATTERNS.len()
}
