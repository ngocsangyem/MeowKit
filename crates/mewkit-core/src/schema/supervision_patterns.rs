//! The three supervision scan pattern tables.
//!
//! Split from [`super::supervision_scan`] so the tables and the scan logic can
//! each be read on one screen; the ORDER of each table is the order of its
//! TypeScript counterpart in `core/athena-supervision-packet.ts`, because a
//! report lists findings in it.
//!
//! Every source is the `RegExp.source` from that file, compiled through
//! [`crate::js_regex`] so `\b`, `\d` and `\s` mean what they mean in a
//! `RegExp` without the `u` flag. Compiled as plain Rust patterns the
//! credential scan detected strictly LESS than the JavaScript it replaces:
//! Unicode `\b` is not a boundary next to `é`, so `éAKIAIOSFODNN7EXAMPLE` and
//! `ghp_…й` passed.

use std::sync::LazyLock;

use regex::Regex;

use crate::js_regex;

/// How many transcript markers before it counts as a dump, not a quote.
pub(super) const TRANSCRIPT_TOLERANCE: usize = 2;

pub(super) struct Pattern {
    pub(super) name: &'static str,
    pub(super) re: Regex,
    /// Global patterns are COUNTED against the tolerance; single-shot patterns
    /// fail on the first hit.
    pub(super) global: bool,
}

fn pattern(name: &'static str, re: &str, global: bool) -> Pattern {
    Pattern {
        name,
        re: js_regex::compile(re).expect("static scan pattern"),
        global,
    }
}

/// Case-insensitive pattern — the `/…/i` literal on the TypeScript side.
fn pattern_ci(name: &'static str, re: &str, global: bool) -> Pattern {
    Pattern {
        name,
        re: js_regex::compile_ci(re).expect("static scan pattern"),
        global,
    }
}

/// Credential shapes. Deliberately narrow: a false positive here blocks a real
/// supervision call, so this matches assignment-like secrets and known key
/// headers rather than anything that merely looks high-entropy.
pub(super) static SECRET_PATTERNS: LazyLock<Vec<Pattern>> = LazyLock::new(|| {
    vec![
        pattern(
            "private key block",
            r"-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----",
            false,
        ),
        pattern("AWS access key id", r"\bAKIA[0-9A-Z]{16}\b", false),
        pattern("bearer token", r"\bBearer\s+[A-Za-z0-9\-._~+/]{20,}", false),
        pattern("GitHub token", r"\bgh[pousr]_[A-Za-z0-9]{20,}\b", false),
        pattern_ci(
            "secret assignment",
            r#"\b(?:api[_-]?key|secret|password|passwd|token|client[_-]?secret)\b\s*[:=]\s*["']?[A-Za-z0-9\-._~+/]{12,}"#,
            false,
        ),
    ]
});

/// Patterns that mean "a payload was pasted where a pointer belongs".
pub(super) static BULK_CONTENT_PATTERNS: LazyLock<Vec<Pattern>> = LazyLock::new(|| {
    vec![
        pattern(
            "unified diff",
            r"(?m)^(?:diff --git |@@ -\d|\+\+\+ b\/)",
            false,
        ),
        pattern(
            "conversation transcript",
            r"(?m)^\s*(?:User|Human|Assistant)\s*:",
            true,
        ),
        pattern("curated-memory dump", r"##(?:decision|pattern|note):", true),
        pattern(
            "raw log dump",
            r"(?m)^\s*at\s+\S+\s+\(.*:\d+:\d+\)\s*$",
            true,
        ),
    ]
});

/// Approval language, in any wording.
pub(super) static AUTHORITY_PATTERNS: LazyLock<Vec<Pattern>> = LazyLock::new(|| {
    vec![
        pattern_ci(
            "approval claim",
            r"\b(?:approved|i approve|approving)\b",
            false,
        ),
        pattern_ci(
            "clearance claim",
            r"\b(?:cleared|clear to proceed|cleared to proceed|greenlit|sign(?:ed)?[- ]off)\b",
            false,
        ),
        pattern_ci(
            "gate advancement",
            r"\b(?:advance|unblock|pass|clear)\w*\s+gate\s*[12]\b",
            false,
        ),
        pattern_ci(
            "merge or deploy authority",
            r"\b(?:merge|deploy|ship)\s+(?:is\s+)?(?:approved|authorized|cleared)\b",
            false,
        ),
        pattern_ci(
            "verification claim",
            r"\bthis (?:counts as|is) verification\b",
            false,
        ),
    ]
});
