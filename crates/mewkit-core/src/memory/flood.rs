//! The context-flooding heuristic — `injection-rules.md` Rule 9.
//!
//! Port of `measuredLines` + `isFlood` in `state/obfuscation-passes.ts`. Padding
//! text exists to push the safety instructions out of context, so volume alone is
//! not the signal — low entropy AT volume is. Volume is measured over the whole
//! text, repetition over [`measured_lines`] only.
use std::collections::HashSet;

use super::normalize::utf16_len;

/// Entry fields that several entries legitimately share (one Source file, one
/// trigger).
const SHARED_FIELDS: [&str; 2] = ["Source:", "Apply when:"];
const SHARED_FIELD_MAX_CHARS: usize = 200;

/// Volume floor, in UTF-16 code units — below this, repetition is not measured.
const FLOOD_MIN_CHARS: usize = 5000;

/// The lines repetition is measured over.
///
/// The entry format repeats some lines by design, and counting them made a healthy
/// ~40-entry store read as padding and blocked every commit at the pre-ship hook.
/// So blank separators are skipped, and so is ONE short `Source:` and ONE short
/// `Apply when:` line per `## ` heading. Headings and `Why:` lines are meant to be
/// unique and always count, and shared-field lines beyond one per heading count
/// too, so padding built from entry-shaped lines is still measured.
pub fn measured_lines(text: &str) -> Vec<&str> {
    // `split('\n')` and not the CR-aware split: faithful to the TS original.
    let lines: Vec<&str> = text.split('\n').collect();
    let headings = lines.iter().filter(|line| line.starts_with("## ")).count();
    let mut skipped = [0usize; SHARED_FIELDS.len()];
    lines
        .into_iter()
        .filter(|line| {
            if line.trim().is_empty() {
                return false;
            }
            let field = SHARED_FIELDS
                .iter()
                .position(|f| line.trim_start().starts_with(f));
            let Some(field) = field else {
                return true;
            };
            if utf16_len(line) > SHARED_FIELD_MAX_CHARS {
                return true;
            }
            if skipped[field] >= headings {
                return true;
            }
            skipped[field] += 1;
            false
        })
        .collect()
}

/// Large AND highly repetitive content.
pub fn is_flood(text: &str) -> bool {
    if utf16_len(text) <= FLOOD_MIN_CHARS {
        return false;
    }
    let lines = measured_lines(text);
    if lines.len() >= 10 {
        let distinct = lines.iter().collect::<HashSet<_>>().len();
        return 1.0 - distinct as f64 / lines.len() as f64 > 0.3;
    }
    let content = lines.join("\n");
    let length = utf16_len(&content);
    if length == 0 {
        return false;
    }
    let distinct = content.chars().collect::<HashSet<_>>().len();
    distinct as f64 / (length as f64) < 0.05
}
