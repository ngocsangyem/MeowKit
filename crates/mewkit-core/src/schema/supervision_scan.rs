//! Content scans every supervision payload passes through.
//!
//! Three classes, kept separate because their exemptions differ:
//!
//! - **secrets** — no exemption anywhere. The supervisor is untrusted-input-only
//!   by design; a credential in a payload would make it untrusted-input AND
//!   sensitive-data at once.
//! - **bulk content** — a payload pasted where a pointer belongs. Quoting one
//!   dialogue line as evidence is legitimate, so repeat-count patterns get a
//!   small tolerance while a single diff header fails immediately.
//! - **authority language** — counsel routes work; it never clears a gate. One
//!   detector, shared by every writer: two detectors for one rule drift, and the
//!   weaker one becomes the de-facto contract.
//!
//! The pattern tables live in [`super::supervision_patterns`]; they are
//! compiled with ECMAScript regex semantics, which is what makes the two
//! scanners agree. Line terminators are folded here for the same reason:
//! `(?m)^` anchors after a lone `\r`, U+2028 and U+2029 in JavaScript, so a
//! diff header behind one of those was missed.

use crate::js_regex;

use super::supervision_patterns::{
    AUTHORITY_PATTERNS, BULK_CONTENT_PATTERNS, Pattern, SECRET_PATTERNS, TRANSCRIPT_TOLERANCE,
};

fn hits(text: &str, p: &Pattern) -> usize {
    if p.global {
        p.re.find_iter(text).count()
    } else {
        usize::from(p.re.is_match(text))
    }
}

/// Credentials only. Runs over EVERY field, pointer paths included.
pub fn scan_secrets(text: &str) -> Vec<String> {
    let text = &js_regex::fold_line_terminators(text);
    SECRET_PATTERNS
        .iter()
        .filter(|p| hits(text, p) > 0)
        .map(|p| {
            format!(
                "{} detected — a packet must never carry credentials",
                p.name
            )
        })
        .collect()
}

/// Payloads pasted where a pointer belongs.
pub fn scan_bulk_content(text: &str) -> Vec<String> {
    let text = &js_regex::fold_line_terminators(text);
    BULK_CONTENT_PATTERNS
        .iter()
        .filter(|p| {
            let found = hits(text, p);
            if p.global {
                found > TRANSCRIPT_TOLERANCE
            } else {
                found > 0
            }
        })
        .map(|p| format!("{} detected — pass a pointer, not the payload", p.name))
        .collect()
}

/// Both classes, for prose fields where neither is acceptable.
pub fn scan_forbidden_content(text: &str) -> Vec<String> {
    let mut found = scan_bulk_content(text);
    found.extend(scan_secrets(text));
    found
}

/// Authority-language scan over arbitrary supervision prose.
pub fn scan_authority_language(text: &str) -> Vec<String> {
    let text = &js_regex::fold_line_terminators(text);
    AUTHORITY_PATTERNS
        .iter()
        .filter(|p| p.re.is_match(text))
        .map(|p| {
            format!(
                "{} in counsel — say \"the evidence supports X\", never approve or clear",
                p.name
            )
        })
        .collect()
}

/// Whitespace-separated word count: `prose.trim().split(/\s+/).length`, the
/// form the word caps are expressed in.
///
/// Splits on ECMAScript whitespace, NOT on `char::is_whitespace`. The two
/// differ at U+FEFF and U+0085, and a 1326-case cross-check against Node found
/// 70 inputs where `split_whitespace` counted a different number of words —
/// enough to put a packet on the other side of its cap in one CLI and not the
/// other.
pub fn word_count(text: &str) -> usize {
    let trimmed = text.trim_matches(js_regex::is_js_whitespace);
    if trimmed.is_empty() {
        return 0;
    }
    trimmed
        .split(js_regex::is_js_whitespace)
        .filter(|word| !word.is_empty())
        .count()
}

#[cfg(test)]
#[path = "supervision_scan_tests.rs"]
mod tests;
