//! Credential patterns, the scrubber and the boolean the memory lint uses.
//!
//! Port of the `SECRET_PATTERNS` + `scrubSecrets` half of
//! `state/injection-scanner.ts`, itself ported verbatim from
//! `hooks/lib/secret-scrub.cjs`. Conservative by design: false positives are
//! accepted, missed credentials are not.
//!
//! MIRROR `hooks/lib/secret-scrub.cjs` when these change.
//!
//! Compiled through [`crate::js_regex`] for the same reason the injection table
//! is: `[^\s"']+` stops at U+FEFF in JavaScript (ECMAScript whitespace) and runs
//! straight through it under `\p{White_Space}`, so a scrubbed database URL came
//! out differently on the two sides.
use std::sync::LazyLock;

use regex::Regex;

use crate::js_regex;

/// One entry: the JS `RegExp.source`, the replacement, and whether the JS
/// literal carried the `i` flag. In application order — the order is
/// load-bearing: the Anthropic key pattern must run before the broader OpenAI
/// `sk-` one.
///
/// The source is stored verbatim (the `i` flag travels in the third field
/// rather than as an inline `(?i)`) so `tests/injection_parity.rs` can compare
/// it byte for byte against `injection-scanner.ts`.
///
/// Replacements use Rust's `${n}` group syntax where the JS source used `$n`;
/// the produced text is identical.
pub const SCRUB_PATTERN_SOURCES: &[(&str, &str, bool)] = &[
    (
        r"sk-ant-[A-Za-z0-9_-]{20,}",
        "[REDACTED-ANTHROPIC-KEY]",
        false,
    ),
    (r"sk-[A-Za-z0-9_-]{20,}", "[REDACTED-OPENAI-KEY]", false),
    (
        r"sk_(live|test)_[A-Za-z0-9]{16,}",
        "[REDACTED-STRIPE-KEY]",
        false,
    ),
    (
        r"rk_(live|test)_[A-Za-z0-9]{16,}",
        "[REDACTED-STRIPE-RESTRICTED-KEY]",
        false,
    ),
    (
        r"pk_(live|test)_[A-Za-z0-9]{16,}",
        "[REDACTED-STRIPE-PUB-KEY]",
        false,
    ),
    (r"AKIA[0-9A-Z]{16}", "[REDACTED-AWS-KEY]", false),
    (r"ghp_[A-Za-z0-9]{30,}", "[REDACTED-GH-TOKEN]", false),
    (r"gho_[A-Za-z0-9]{30,}", "[REDACTED-GH-OAUTH]", false),
    (r"glpat-[A-Za-z0-9_-]{20,}", "[REDACTED-GITLAB-PAT]", false),
    (
        r"xox[bpars]-[0-9]+-[0-9]+-[0-9]+-[A-Za-z0-9]{24,}",
        "[REDACTED-SLACK-TOKEN]",
        false,
    ),
    (
        r"https:\/\/hooks\.slack\.com\/services\/[A-Z0-9/]+",
        "[REDACTED-SLACK-WEBHOOK]",
        false,
    ),
    (
        r"eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}",
        "[REDACTED-JWT]",
        false,
    ),
    (
        r"-----BEGIN [A-Z ]*PRIVATE KEY-----[^-]*-----END [A-Z ]*PRIVATE KEY-----",
        "[REDACTED-PRIVATE-KEY]",
        false,
    ),
    (
        r#"(api[_-]?key|apikey|password|passwd|secret|token)(\s*[:=]\s*)["']?[A-Za-z0-9_/+=.-]{16,}["']?"#,
        "${1}${2}[REDACTED]",
        true,
    ),
    (r"Bearer [A-Za-z0-9_/+=.-]{20,}", "Bearer [REDACTED]", false),
    (
        r#"(mysql|postgres|postgresql|mongodb|redis):\/\/[^\s"']+"#,
        "${1}://[REDACTED-DB-URL]",
        true,
    ),
    // Bounded on every quantifier. The unbounded form (`{3,}@[A-Za-z0-9.-]{3,}\.`)
    // backtracks quadratically in a backtracking engine, which is reachable from any
    // pasted log line. RFC-5321 limits a local part to 64 octets and a label to 63,
    // so bounding costs no real-world match. (Rust's `regex` is linear-time anyway;
    // the bounds are kept so the pattern stays identical to the hook's.)
    (
        r"[A-Za-z0-9._%+-]{3,64}@[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63}){0,8}\.[A-Za-z]{2,24}",
        "[REDACTED-EMAIL]",
        false,
    ),
    (
        r"(MEOWKIT_[A-Z_]*(?:KEY|SECRET|TOKEN|PASSWORD))(\s*=\s*)\S{8,}",
        "${1}${2}[REDACTED]",
        false,
    ),
];

static SCRUB_PATTERNS: LazyLock<Vec<(Regex, &'static str)>> = LazyLock::new(|| {
    SCRUB_PATTERN_SOURCES
        .iter()
        .map(|(source, replacement, case_insensitive)| {
            let compiled = if *case_insensitive {
                js_regex::compile_ci(source)
            } else {
                js_regex::compile(source)
            };
            let re =
                compiled.unwrap_or_else(|e| panic!("scrub pattern {source:?} is not usable: {e}"));
            (re, *replacement)
        })
        .collect()
});

/// Mirror of `scrubSecrets`.
pub fn scrub_secrets(input: &str) -> String {
    if input.is_empty() {
        return String::new();
    }
    let mut out = input.to_string();
    for (re, replacement) in SCRUB_PATTERNS.iter() {
        out = re.replace_all(&out, *replacement).into_owned();
    }
    out
}

/// True when any credential pattern matches. The match itself is deliberately
/// discarded: a finding NEVER carries the credential, because the lint output is
/// read in CI logs and in a terminal.
pub fn has_secret(text: &str) -> bool {
    SCRUB_PATTERNS.iter().any(|(re, _)| re.is_match(text))
}

/// How many patterns are active. Lets a caller fail fast on a broken table.
pub fn pattern_count() -> usize {
    SCRUB_PATTERNS.len()
}
