//! Compile a JavaScript regex SOURCE so it matches what JavaScript matches.
//!
//! Every pattern this crate ports from a `.ts`/`.cjs` scanner is a `RegExp`
//! literal written WITHOUT the `u` flag, and in that mode the shorthand classes
//! are defined by ECMAScript rather than by Unicode:
//!
//! | source | JavaScript (no `u`) | Rust `regex` default | what this module emits |
//! | --- | --- | --- | --- |
//! | `\d` | `[0-9]` | `\p{Nd}` — Arabic-Indic digits too | `[0-9]` |
//! | `\w` | `[0-9A-Za-z_]` | `\p{Alphabetic}`+ | `[0-9A-Za-z_]` |
//! | `\b` | ASCII word boundary | Unicode word boundary | `(?-u:\b)` |
//! | `\s` | see below | `\p{White_Space}` | the ECMAScript set, verbatim |
//!
//! `\s` is the one that is NOT simply "ASCII": ECMAScript `WhiteSpace`
//! ∪ `LineTerminator` is `\t\v\f\x20`, U+00A0, U+FEFF, every `Zs`, and
//! `\n\r\u2028\u2029`. So `(?-u:\s)` would be WRONG in the other direction —
//! it would stop matching the NBSP that JavaScript matches. Against
//! `\p{White_Space}` the set differs at exactly two code points: JavaScript
//! includes U+FEFF and Rust does not; Rust includes U+0085 and JavaScript does
//! not. Both were verified in Node (`ignore\ufeffprevious\ufeffinstructions`
//! matches there, `ignore\u0085previous\u0085instructions` does not).
//!
//! Why translate instead of editing the pattern tables: a finding reports the
//! pattern SOURCE, those strings are asserted byte-for-byte against the
//! TypeScript they mirror, and a hand-edited table drifts. One translation step
//! keeps the stored source identical to the `RegExp.source` it came from.
//!
//! Known remaining superset: `(?i)` folds case per Unicode here and per ASCII in
//! a non-`u` `RegExp`, so `(?i)[A-Za-z]` additionally matches U+212A (Kelvin)
//! and U+017F (long s). That direction flags MORE, never less.

use regex::{Regex, RegexBuilder};

/// ECMAScript `\s`, as a character-class BODY (no brackets), so it can be
/// spliced into a positive class, a negated class or a standalone one.
///
/// Order follows the spec: `WhiteSpace` (TAB, VT, FF, SP, NBSP, ZWNBSP, `Zs`)
/// then `LineTerminator` (LF, CR, LS, PS).
const JS_SPACE: &str = r"\t\x0B\x0C\x20\u{a0}\u{feff}\u{1680}\u{2000}-\u{200a}\u{202f}\u{205f}\u{3000}\n\r\u{2028}\u{2029}";

/// The same set as a predicate, for code that splits or trims on JavaScript
/// whitespace without going through a regex — `text.trim().split(/\s+/)` on the
/// TypeScript side. `char::is_whitespace` is `\p{White_Space}`, which differs
/// at U+FEFF and U+0085, so using it there made the two CLIs count a different
/// number of words for the same prose and disagree about a word CAP.
pub fn is_js_whitespace(ch: char) -> bool {
    matches!(
        ch,
        '\t' | '\u{b}' | '\u{c}' | ' ' | '\u{a0}' | '\u{feff}' | '\n' | '\r'
    ) || matches!(
        ch,
        '\u{1680}' | '\u{2000}'
            ..='\u{200a}' | '\u{2028}' | '\u{2029}' | '\u{202f}' | '\u{205f}' | '\u{3000}'
    )
}

/// ECMAScript `\w`, as a character-class body.
const JS_WORD: &str = "0-9A-Za-z_";

/// ECMAScript `\d`, as a character-class body.
const JS_DIGIT: &str = "0-9";

/// Rewrite one JavaScript pattern source into an equivalent Rust one.
///
/// `Err` names the construct that has no equivalent, rather than emitting a
/// pattern that quietly means something else. Only the negated shorthands
/// inside a character class are refused: `[\S]` cannot be expanded without
/// rewriting the whole class, and no ported pattern contains one.
pub fn translate(source: &str) -> Result<String, String> {
    let mut out = String::with_capacity(source.len() + 64);
    let mut chars = source.chars();
    let mut in_class = false;
    while let Some(ch) = chars.next() {
        match ch {
            '\\' => {
                let Some(escaped) = chars.next() else {
                    return Err(r"a trailing backslash".to_string());
                };
                push_escape(&mut out, escaped, in_class)?;
            }
            '[' if !in_class => {
                in_class = true;
                out.push('[');
            }
            ']' if in_class => {
                in_class = false;
                out.push(']');
            }
            other => out.push(other),
        }
    }
    Ok(out)
}

fn push_escape(out: &mut String, escaped: char, in_class: bool) -> Result<(), String> {
    match (escaped, in_class) {
        ('d', false) => out.push_str(&bracket(JS_DIGIT, false)),
        ('d', true) => out.push_str(JS_DIGIT),
        ('D', false) => out.push_str(&bracket(JS_DIGIT, true)),
        ('w', false) => out.push_str(&bracket(JS_WORD, false)),
        ('w', true) => out.push_str(JS_WORD),
        ('W', false) => out.push_str(&bracket(JS_WORD, true)),
        ('s', false) => out.push_str(&bracket(JS_SPACE, false)),
        ('s', true) => out.push_str(JS_SPACE),
        ('S', false) => out.push_str(&bracket(JS_SPACE, true)),
        // ASCII word boundary. Legal inside a Unicode-aware pattern over `&str`
        // because the assertion itself consumes nothing.
        ('b', false) => out.push_str(r"(?-u:\b)"),
        ('B', false) => out.push_str(r"(?-u:\B)"),
        // `[\b]` is the BACKSPACE character in JavaScript, not a boundary.
        ('b', true) => out.push_str(r"\x08"),
        ('D' | 'W' | 'S' | 'B', true) => {
            return Err(format!(
                r"\{escaped} inside a character class has no direct equivalent — rewrite the class"
            ));
        }
        (other, _) => {
            out.push('\\');
            out.push(other);
        }
    }
    Ok(())
}

fn bracket(body: &str, negated: bool) -> String {
    if negated {
        format!("[^{body}]")
    } else {
        format!("[{body}]")
    }
}

/// [`translate`], then compile. Case-SENSITIVE, like a `RegExp` with no `i`.
pub fn compile(source: &str) -> Result<Regex, String> {
    build(source, false)
}

/// [`translate`], then compile case-insensitively — the `/…/i` literal.
pub fn compile_ci(source: &str) -> Result<Regex, String> {
    build(source, true)
}

fn build(source: &str, case_insensitive: bool) -> Result<Regex, String> {
    let translated = translate(source)?;
    RegexBuilder::new(&translated)
        .case_insensitive(case_insensitive)
        .build()
        .map_err(|e| {
            format!("{source:?} translated to {translated:?}, which does not compile: {e}")
        })
}

/// Replace every ECMAScript line terminator with `\n`.
///
/// `(?m)` in Rust anchors `^`/`$` around `\n` only, and `.` excludes `\n` only.
/// A JavaScript `RegExp` treats a lone `\r`, U+2028 and U+2029 as line
/// terminators too, so a multiline pattern anchors there and `.` stops there.
/// Folding them to `\n` before the match reproduces both halves at once.
///
/// Safe only for a scan that reports WHETHER and HOW OFTEN a pattern hit: the
/// replacement is length-preserving per code point but byte offsets into the
/// original are not meaningful for a multi-byte terminator.
pub fn fold_line_terminators(text: &str) -> std::borrow::Cow<'_, str> {
    if !text.contains(['\r', '\u{2028}', '\u{2029}']) {
        return std::borrow::Cow::Borrowed(text);
    }
    std::borrow::Cow::Owned(
        text.chars()
            .map(|c| match c {
                '\r' | '\u{2028}' | '\u{2029}' => '\n',
                other => other,
            })
            .collect(),
    )
}

#[cfg(test)]
#[path = "js_regex_tests.rs"]
mod tests;
