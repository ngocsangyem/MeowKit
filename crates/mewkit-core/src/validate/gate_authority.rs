//! Does any prose GRANT automated gate-approval authority?
//!
//! The contract (`.claude/rules/gate-rules.md`) says automation executes
//! BETWEEN gates and never supplies the authority OF a gate: a verdict, a score
//! or an exit code is evidence presented at a gate, never the approval.
//!
//! This is a FLOOR, not the contract. It matches a fixed pattern set over single
//! lines, and paraphrase defeats any fixed pattern set — the standing reviewer
//! checklist item is the real enforcement; this only makes the KNOWN regressions
//! mechanical. Port of `core/check-gate-authority.ts`.
use std::fs;
use std::path::Path;

use super::gate_authority_patterns::{
    ALLOW_MARKER, CLAUSE_SPLIT, COMPILED, NEGATION, NEGATION_LOOKBEHIND, PATTERNS,
    STANDALONE_MARKER,
};

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct GateAuthorityViolation {
    /// Path relative to the scanned root.
    pub file: String,
    /// 1-based line number.
    pub line: usize,
    /// The offending line, trimmed.
    pub found: String,
    /// What the contract requires instead.
    pub expected: &'static str,
}

/// Split a line into independent clauses before matching.
///
/// A negation governs its OWN clause. Without the split, one wide match can
/// span a contrastive boundary — "supervision is not verification, but it
/// counts as verification for Gate 2" — and the negation check then finds the
/// first clause's "not" inside the match and disarms a violation that lives
/// entirely in the second.
fn split_clauses(line: &str) -> Vec<&str> {
    CLAUSE_SPLIT
        .split(line)
        .filter(|clause| !clause.trim().is_empty())
        .collect()
}

/// True when the matched claim is negated rather than asserted.
///
/// Scope matters enormously: testing the WHOLE line lets any incidental
/// negation elsewhere disarm a real violation, and a safety lint that reports
/// green over its own threat model is worse than no lint.
fn is_negated(clause: &str, match_start: usize, matched: &str) -> bool {
    NEGATION.is_match(lookbehind(clause, match_start)) || NEGATION.is_match(matched)
}

/// The window the negation is looked for in: the last [`NEGATION_LOOKBEHIND`]
/// CHARACTERS before the match, not bytes.
///
/// `String.prototype.slice` counts UTF-16 units, so a byte window would be
/// shorter than the JavaScript one by two for every em dash — and this prose is
/// full of them, which would make a negation that disarms a claim in the npm
/// CLI fall outside the window here. (An astral character counts as two units
/// there and one char here; no kit prose puts one inside a gate clause.)
fn lookbehind(clause: &str, match_start: usize) -> &str {
    let before = &clause[..match_start];
    match before.char_indices().nth_back(NEGATION_LOOKBEHIND - 1) {
        Some((offset, _)) => &before[offset..],
        None => before,
    }
}

/// Scan one file's prose. At most one finding per line: it is enough to locate
/// and fix the line, and a line can trip several patterns at once.
pub fn scan_for_gate_authority(root: &Path, rel_path: &str) -> Vec<GateAuthorityViolation> {
    let abs = rel_path
        .split('/')
        .fold(root.to_path_buf(), |acc, part| acc.join(part));
    let Ok(bytes) = fs::read(&abs) else {
        return Vec::new();
    };
    let content = String::from_utf8_lossy(&bytes).into_owned();
    let lines: Vec<&str> = content.split('\n').collect();

    let mut violations = Vec::new();
    for (index, text) in lines.iter().enumerate() {
        // A marker on the offending line suppresses that line; a marker on its
        // OWN line above suppresses the line below — the form used where a
        // trailing comment would render into prose. The standalone requirement
        // keeps an inline marker from leaking onto its neighbour.
        if text.contains(ALLOW_MARKER) {
            continue;
        }
        if index > 0 && STANDALONE_MARKER.is_match(lines[index - 1]) {
            continue;
        }
        if let Some(expected) = first_violation(text) {
            violations.push(GateAuthorityViolation {
                file: rel_path.to_string(),
                line: index + 1,
                found: text.trim().to_string(),
                expected,
            });
        }
    }
    violations
}

/// The expectation of the first asserted match on a line, in pattern order.
fn first_violation(text: &str) -> Option<&'static str> {
    for (pattern, compiled) in PATTERNS.iter().zip(COMPILED.iter()) {
        for clause in split_clauses(text) {
            for found in compiled.find_iter(clause) {
                if is_negated(clause, found.start(), found.as_str()) {
                    continue;
                }
                return Some(pattern.expected);
            }
        }
    }
    None
}

#[cfg(test)]
#[path = "gate_authority_tests.rs"]
mod gate_authority_tests;
