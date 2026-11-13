//! Read `RegExp` and string literals out of a TypeScript source file.
//!
//! A drift test that hard-codes the TypeScript it mirrors is a second copy of
//! the table and drifts with it. These helpers read the ACTUAL `.ts` at test
//! time, so the only way to change one side without the other is to break the
//! build.
//!
//! The scanner follows the ECMAScript rule for where a regex literal ends: an
//! unescaped `/` that is not inside a character class. `[a/b]` therefore does
//! not terminate the literal, which a naive `rfind('/')` gets wrong.
//!
//! Shared by several drift tests, each of which needs a different subset: a
//! test that only reads an `export const` does not touch the regex scanner.
//! Hence the allow — the alternative is a second `read_source` per test, which
//! is the duplication this module exists to remove.
#![allow(dead_code)]

use std::fs;
use std::path::{Path, PathBuf};

pub fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("..").join("..")
}

/// Read a file under the repository root.
pub fn read_source(rel: &str) -> String {
    let path = repo_root().join(rel);
    fs::read_to_string(&path)
        .unwrap_or_else(|e| panic!("{} could not be read: {e}", path.display()))
}

/// The lines of the array literal that `marker` opens, up to the closing `];`.
pub fn array_lines<'a>(source: &'a str, marker: &str) -> Vec<&'a str> {
    let start = source
        .find(marker)
        .unwrap_or_else(|| panic!("{marker:?} is no longer in the TypeScript source"));
    let body = &source[start + marker.len()..];
    let end = body
        .find("\n];")
        .unwrap_or_else(|| panic!("{marker:?} has no closing `];`"));
    body[..end]
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty() && !line.starts_with("//") && !line.starts_with('*'))
        .collect()
}

/// One `/source/flags` literal: `(source, flags, bytes consumed)`.
/// `text` must start at the opening `/`.
pub fn regex_literal(text: &str) -> (String, String, usize) {
    let bytes: Vec<char> = text.chars().collect();
    assert_eq!(bytes.first(), Some(&'/'), "not a regex literal: {text:?}");
    let mut source = String::new();
    let mut index = 1;
    let mut in_class = false;
    let mut escaped = false;
    loop {
        let ch = *bytes
            .get(index)
            .unwrap_or_else(|| panic!("unterminated regex literal: {text:?}"));
        index += 1;
        if escaped {
            source.push(ch);
            escaped = false;
            continue;
        }
        match ch {
            '\\' => {
                source.push(ch);
                escaped = true;
            }
            '[' => {
                in_class = true;
                source.push(ch);
            }
            ']' => {
                in_class = false;
                source.push(ch);
            }
            '/' if !in_class => break,
            other => source.push(other),
        }
    }
    let mut flags = String::new();
    while let Some(ch) = bytes.get(index).filter(|c| c.is_ascii_alphabetic()) {
        flags.push(*ch);
        index += 1;
    }
    let consumed = bytes[..index].iter().map(|c| c.len_utf8()).sum();
    (source, flags, consumed)
}

/// One double-quoted JS string literal, starting at the opening quote.
pub fn string_literal(text: &str) -> String {
    let mut chars = text.chars();
    assert_eq!(chars.next(), Some('"'), "not a string literal: {text:?}");
    let mut out = String::new();
    let mut escaped = false;
    for ch in chars {
        if escaped {
            out.push(ch);
            escaped = false;
            continue;
        }
        match ch {
            '\\' => escaped = true,
            '"' => return out,
            other => out.push(other),
        }
    }
    panic!("unterminated string literal: {text:?}")
}
