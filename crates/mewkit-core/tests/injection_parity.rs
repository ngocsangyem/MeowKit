//! The Rust pattern tables ARE the TypeScript tables.
//!
//! The old assertion was `injection_pattern_count() == INJECTION_PATTERN_SOURCES.len()`,
//! which compares a Rust constant to itself and proves nothing: the table could
//! have drifted from `state/injection-scanner.ts` entirely and stayed green.
//! This reads the TypeScript at test time and compares source for source, in
//! order — the check that would have made the Unicode `\b` divergence visible,
//! because it is the only thing that establishes the two tables are the same
//! patterns at all.
//!
//! The pattern SOURCE is also what a finding reports, so a drift here changes
//! what a reviewer reads in a CI log, not only what is detected.

use mewkit_core::memory::{
    INJECTION_PATTERN_SOURCES, SCRUB_PATTERN_SOURCES, injection_pattern_count, scrub_pattern_count,
};

#[path = "support/js_literals.rs"]
mod js_literals;
use js_literals::{array_lines, read_source, regex_literal, string_literal};

const SCANNER_TS: &str = "packages/mewkit/src/state/injection-scanner.ts";

/// `(source, flags)` for every literal in the `INJECTION_PATTERNS` array.
fn ts_injection_patterns(source: &str) -> Vec<(String, String)> {
    array_lines(
        source,
        "export const INJECTION_PATTERNS: readonly RegExp[] = [",
    )
    .into_iter()
    .map(|line| {
        let (pattern, flags, _) = regex_literal(line);
        (pattern, flags)
    })
    .collect()
}

/// `(source, flags, replacement)` for every entry in the `SECRET_PATTERNS`
/// array. Each entry is `[/…/flags, "replacement"],` on one line.
fn ts_secret_patterns(source: &str) -> Vec<(String, String, String)> {
    array_lines(
        source,
        "export const SECRET_PATTERNS: readonly (readonly [RegExp, string])[] = [",
    )
    .into_iter()
    .map(|line| {
        let entry = line
            .strip_prefix('[')
            .unwrap_or_else(|| panic!("not a `[regex, replacement]` entry: {line:?}"));
        let (pattern, flags, consumed) = regex_literal(entry);
        let rest = entry[consumed..]
            .trim_start()
            .strip_prefix(',')
            .unwrap_or_else(|| panic!("no replacement in {line:?}"))
            .trim_start();
        (pattern, flags, string_literal(rest))
    })
    .collect()
}

#[test]
fn every_injection_pattern_source_is_the_typescript_one_in_order() {
    let ts = ts_injection_patterns(&read_source(SCANNER_TS));
    assert_eq!(
        ts.len(),
        INJECTION_PATTERN_SOURCES.len(),
        "the TypeScript has {} injection patterns and this crate has {}",
        ts.len(),
        INJECTION_PATTERN_SOURCES.len()
    );
    for (index, ((ts_source, ts_flags), rust_source)) in
        ts.iter().zip(INJECTION_PATTERN_SOURCES.iter()).enumerate()
    {
        assert_eq!(
            ts_source, rust_source,
            "injection pattern {index} differs from {SCANNER_TS}"
        );
        // Every injection pattern is case-insensitive and nothing else; the
        // compiler in `injection_patterns.rs` hard-codes that, so a new flag on
        // the TypeScript side must break this test rather than be ignored.
        assert_eq!(ts_flags, "i", "injection pattern {index} has new flags");
    }
    assert_eq!(injection_pattern_count(), INJECTION_PATTERN_SOURCES.len());
}

#[test]
fn every_scrub_pattern_source_flag_and_replacement_is_the_typescript_one() {
    let ts = ts_secret_patterns(&read_source(SCANNER_TS));
    assert_eq!(
        ts.len(),
        SCRUB_PATTERN_SOURCES.len(),
        "the TypeScript has {} secret patterns and this crate has {}",
        ts.len(),
        SCRUB_PATTERN_SOURCES.len()
    );
    for (index, ((ts_source, ts_flags, ts_replacement), (source, replacement, case_insensitive))) in
        ts.iter().zip(SCRUB_PATTERN_SOURCES.iter()).enumerate()
    {
        assert_eq!(
            ts_source, source,
            "secret pattern {index} differs from {SCANNER_TS}"
        );
        // `g` is implicit in `Regex::replace_all`; only `i` has to be carried.
        assert!(
            ts_flags.contains('g'),
            "secret pattern {index} is not global, but `scrub_secrets` replaces all"
        );
        assert_eq!(
            ts_flags.contains('i'),
            *case_insensitive,
            "secret pattern {index} disagrees about the `i` flag"
        );
        // Rust spells a group reference `${1}` where JS spells it `$1`; the
        // produced text is identical, so compare the normalised form.
        assert_eq!(
            &ts_replacement.replace("$1", "${1}").replace("$2", "${2}"),
            replacement,
            "secret pattern {index} has a different replacement"
        );
    }
    assert_eq!(scrub_pattern_count(), SCRUB_PATTERN_SOURCES.len());
}

#[test]
fn the_literal_scanner_handles_a_slash_inside_a_character_class() {
    // `[A-Z0-9/]` must not terminate the literal — the reason this test file
    // lexes the source instead of searching for the last `/`.
    let (pattern, flags, _) =
        regex_literal(r"/https:\/\/hooks\.slack\.com\/services\/[A-Z0-9/]+/g");
    assert_eq!(
        pattern,
        r"https:\/\/hooks\.slack\.com\/services\/[A-Z0-9/]+"
    );
    assert_eq!(flags, "g");
}
