//! Pass 1 of the injection scan: fold away zero-width and homoglyph obfuscation.
//!
//! Port of `normalizeForScan` in `state/injection-scanner.ts`
//! (`text.replace(/[​‌‍﻿]/g, "").normalize("NFKC")`).
//!
//! UTF-16 vs UTF-8: the JS original iterates UTF-16 code units, this iterates
//! `char` (scalar values). The two agree here because every character the pass
//! removes is in the BMP and NFKC is defined over scalar values, not code units.
use unicode_normalization::UnicodeNormalization;

/// Zero-width space, non-joiner, joiner and BOM — invisible in a diff, so the
/// cheapest way to split a payload across a pattern.
const ZERO_WIDTH: [char; 4] = ['\u{200B}', '\u{200C}', '\u{200D}', '\u{FEFF}'];

/// Strip zero-width characters and apply NFKC (catches homoglyph / zero-width
/// obfuscation), per web-to-markdown Layer 5 pass 1.
pub fn normalize_for_scan(text: &str) -> String {
    text.chars()
        .filter(|c| !ZERO_WIDTH.contains(c))
        .nfkc()
        .collect()
}

/// Length in UTF-16 code units — what JS `String.prototype.length` returns.
///
/// Every size threshold ported from the TS scan is expressed in that unit, so the
/// Rust port measures the same way instead of silently switching to bytes (which
/// would move the flood floor for any non-ASCII store).
pub fn utf16_len(text: &str) -> usize {
    text.chars().map(char::len_utf16).sum()
}
