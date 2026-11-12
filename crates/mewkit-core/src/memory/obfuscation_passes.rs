//! Obfuscation decode passes — the implementation of `injection-rules.md` Rule 8.
//!
//! Port of `state/obfuscation-passes.ts` (the flood heuristic of Rule 9 lives in
//! `flood.rs`). A single-pass plaintext scan is trivially evaded: the same payload
//! survives base64, ROT13, percent-encoding, or an HTML comment that renders
//! invisibly in markdown.
//!
//! Pure string → string(s) transforms: no IO, no pattern list of their own. These
//! only produce additional VIEWS of the same text; the pattern list stays in
//! `injection_patterns.rs`.
use std::sync::LazyLock;

use regex::Regex;

/// Per-file / per-document byte ceiling. Content above this is rejected, never
/// scanned.
pub const MAX_CONTENT_BYTES: usize = 1_000_000;

/// Per-line byte ceiling for the pattern scan. A pasted stack trace or minified
/// blob on one line turns a cheap lint into a CI stall, so a line above this is
/// reported rather than scanned — fail closed, bounded cost.
pub const MAX_SCAN_LINE_BYTES: usize = 4096;

/// ROT13 — a letter-only substitution, so it is its own inverse.
pub fn rot13(text: &str) -> String {
    text.chars()
        .map(|c| match c {
            'a'..='z' => (((c as u8 - b'a' + 13) % 26) + b'a') as char,
            'A'..='Z' => (((c as u8 - b'A' + 13) % 26) + b'A') as char,
            _ => c,
        })
        .collect()
}

/// Percent-decode, mirroring `decodeURIComponent`: a malformed `%`-sequence or a
/// byte run that is not valid UTF-8 falls back to the raw form rather than
/// throwing.
pub fn percent_decode(text: &str) -> String {
    let bytes = text.as_bytes();
    let mut out: Vec<u8> = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' {
            let Some(hex) = text.get(i + 1..i + 3) else {
                return text.to_string();
            };
            let Ok(byte) = u8::from_str_radix(hex, 16) else {
                return text.to_string();
            };
            // `from_str_radix` accepts a leading `+`/`-`; `%+1` must not decode.
            if !hex.bytes().all(|b| b.is_ascii_hexdigit()) {
                return text.to_string();
            }
            out.push(byte);
            i += 3;
        } else {
            out.push(bytes[i]);
            i += 1;
        }
    }
    match String::from_utf8(out) {
        Ok(decoded) => decoded,
        Err(_) => text.to_string(),
    }
}

static HTML_COMMENT: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?s)<!--(.*?)-->").expect("html comment pattern compiles"));

/// Extract HTML-comment bodies so a payload hidden in `<!-- ... -->` is scanned,
/// not skipped. The approved memory entry format puts its own date stamp in an
/// HTML comment, which makes that slot the most attractive hiding place in the
/// store.
pub fn extract_html_comments(text: &str) -> Vec<String> {
    HTML_COMMENT
        .captures_iter(text)
        .map(|c| c[1].to_string())
        .collect()
}

static BASE64_BLOCK: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"[A-Za-z0-9+/]{16,}={0,2}").expect("base64 pattern compiles"));

/// Decode base64 blocks (≥16 chars, so short payloads are caught too) for
/// re-scanning. Only a view with at least one printable ASCII character is worth
/// a scan.
pub fn decode_base64_blocks(text: &str) -> Vec<String> {
    let mut out = Vec::new();
    for m in BASE64_BLOCK.find_iter(text) {
        let decoded = decode_base64_lenient(m.as_str());
        if decoded.is_empty() {
            continue;
        }
        let view = String::from_utf8_lossy(&decoded).into_owned();
        if view.chars().any(|c| (' '..='~').contains(&c)) {
            out.push(view);
        }
    }
    out
}

/// `Buffer.from(s, "base64")` semantics: decode 4-character groups, and keep the
/// whole bytes a short trailing group yields (3 chars → 2 bytes, 2 chars → 1 byte,
/// 1 char → nothing) instead of rejecting the input for its length. The caller's
/// pattern already restricts the alphabet, so no character can be invalid here.
fn decode_base64_lenient(block: &str) -> Vec<u8> {
    let mut out = Vec::with_capacity(block.len() / 4 * 3);
    let mut acc: u32 = 0;
    let mut bits = 0u32;
    for byte in block.bytes() {
        let Some(value) = base64_value(byte) else {
            break; // padding, or anything outside the alphabet: the block ends here
        };
        acc = (acc << 6) | u32::from(value);
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push(((acc >> bits) & 0xFF) as u8);
        }
    }
    out
}

fn base64_value(byte: u8) -> Option<u8> {
    match byte {
        b'A'..=b'Z' => Some(byte - b'A'),
        b'a'..=b'z' => Some(byte - b'a' + 26),
        b'0'..=b'9' => Some(byte - b'0' + 52),
        b'+' => Some(62),
        b'/' => Some(63),
        _ => None,
    }
}

/// Every view of `text` the injection patterns should run against: the text itself
/// plus one decoded form per obfuscation Rule 8 names. The caller normalizes
/// (homoglyph / zero-width) first — that is pass 1, in `normalize.rs`.
pub fn decode_passes(text: &str) -> Vec<String> {
    let mut views = vec![text.to_string(), percent_decode(text), rot13(text)];
    views.extend(decode_base64_blocks(text));
    views.extend(extract_html_comments(text));
    views
}
