//! `Number(string)`, as JavaScript computes it.
//!
//! Ported records are read the way the TypeScript reads them: a frontmatter
//! scalar goes through `Number(...)` and then through the schema, so the SCHEMA
//! decides whether the value is acceptable. A Rust `parse::<u64>().unwrap_or(0)`
//! collapses three different failures — garbled, negative, fractional — into a
//! silent `0`, and a counter that resets is exactly the failure a fail-closed
//! reader exists to prevent.
//!
//! The grammar is `StringNumericLiteral`: surrounding whitespace is stripped,
//! an empty string is `0`, `0x`/`0o`/`0b` are unsigned radix literals, and
//! anything else is a decimal literal with an optional sign and exponent.

use serde_json::Number;

use crate::js_regex::is_js_whitespace;

/// `Number(raw)` as a JSON number.
///
/// `None` is JavaScript's `NaN` or `±Infinity`: neither is a JSON number, and a
/// schema expecting a count refuses all three the same way. An integral result
/// is returned as an INTEGER so a `u64` field still deserializes — matching
/// `z.number().int()`, which accepts `5` and refuses `5.5`.
pub fn js_number(raw: &str) -> Option<Number> {
    let text = raw.trim_matches(is_js_whitespace);
    if text.is_empty() {
        return Some(Number::from(0u64));
    }
    let value = radix_literal(text).or_else(|| decimal_literal(text))?;
    if !value.is_finite() {
        return None;
    }
    if value.fract() == 0.0 && value.abs() < 9_007_199_254_740_992.0 {
        // Below 2^53 every integral double is exact, so an integer-typed number
        // is a lossless view of it and reads back into a `u64`/`i64` field.
        return Some(Number::from(value as i64));
    }
    Number::from_f64(value)
}

/// `0x…`, `0o…`, `0b…` — unsigned only, and a sign makes the whole literal NaN.
fn radix_literal(text: &str) -> Option<f64> {
    let radix = match text.get(..2)? {
        "0x" | "0X" => 16,
        "0o" | "0O" => 8,
        "0b" | "0B" => 2,
        _ => return None,
    };
    let digits = &text[2..];
    if digits.is_empty() || !digits.chars().all(|c| c.is_digit(radix)) {
        // A malformed radix literal is NaN, not a decimal fallback.
        return Some(f64::NAN);
    }
    // Wider than any count this reader accepts; an overflow is +Infinity in JS.
    Some(u128::from_str_radix(digits, radix).map_or(f64::INFINITY, |n| n as f64))
}

/// The decimal grammar. Rust's `f64` parser is a superset — it also accepts
/// `inf`, `infinity` and `nan` — so those spellings are refused first.
fn decimal_literal(text: &str) -> Option<f64> {
    let unsigned = text.strip_prefix(['+', '-']).unwrap_or(text);
    if unsigned.is_empty() {
        return Some(f64::NAN);
    }
    let lowered = unsigned.to_ascii_lowercase();
    if lowered == "infinity" {
        return Some(if text.starts_with('-') {
            f64::NEG_INFINITY
        } else {
            f64::INFINITY
        });
    }
    if lowered.starts_with("inf") || lowered.starts_with("nan") || lowered.starts_with('_') {
        return Some(f64::NAN);
    }
    if unsigned.contains('_') {
        return Some(f64::NAN);
    }
    Some(text.parse::<f64>().unwrap_or(f64::NAN))
}

#[cfg(test)]
#[path = "js_number_tests.rs"]
mod tests;
