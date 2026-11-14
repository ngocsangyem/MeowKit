//! The Rust pattern tables, held against a frozen copy of the tables they were
//! ported from.
//!
//! `fixtures/injection-scanner-tables.json` is the TypeScript scanner's
//! `INJECTION_PATTERNS` and `SECRET_PATTERNS`, source for source and in order,
//! captured before that implementation was retired. Comparing the Rust
//! constants with the Rust constants would prove nothing; comparing them with a
//! committed snapshot makes every change to what is detected, or to what a
//! finding reports, show up as an explicit fixture edit in review.
//!
//! The pattern SOURCE is also what a finding reports, so a drift here changes
//! what a reviewer reads in a CI log, not only what is detected.

use mewkit_core::memory::{
    INJECTION_PATTERN_SOURCES, SCRUB_PATTERN_SOURCES, injection_pattern_count, scrub_pattern_count,
};
use serde_json::Value;

const FIXTURE: &str = include_str!("fixtures/injection-scanner-tables.json");

fn table(name: &str) -> Vec<Value> {
    let parsed: Value = serde_json::from_str(FIXTURE).expect("the fixture is JSON");
    parsed[name]
        .as_array()
        .unwrap_or_else(|| panic!("the fixture has no {name} array"))
        .clone()
}

fn text<'a>(entry: &'a Value, field: &str) -> &'a str {
    entry[field]
        .as_str()
        .unwrap_or_else(|| panic!("fixture entry has no {field}: {entry}"))
}

#[test]
fn every_injection_pattern_source_matches_the_frozen_table_in_order() {
    let frozen = table("injection");
    assert_eq!(
        frozen.len(),
        INJECTION_PATTERN_SOURCES.len(),
        "the frozen table has {} injection patterns and this crate has {}",
        frozen.len(),
        INJECTION_PATTERN_SOURCES.len()
    );
    for (index, (entry, rust_source)) in frozen.iter().zip(INJECTION_PATTERN_SOURCES).enumerate() {
        assert_eq!(
            text(entry, "source"),
            *rust_source,
            "injection pattern {index} differs from the frozen table"
        );
        // Every injection pattern is case-insensitive and nothing else; the
        // compiler in `injection_patterns.rs` hard-codes that.
        assert_eq!(text(entry, "flags"), "i", "injection pattern {index} flags");
    }
    assert_eq!(injection_pattern_count(), INJECTION_PATTERN_SOURCES.len());
}

#[test]
fn every_scrub_pattern_source_flag_and_replacement_matches_the_frozen_table() {
    let frozen = table("secret");
    assert_eq!(
        frozen.len(),
        SCRUB_PATTERN_SOURCES.len(),
        "the frozen table has {} secret patterns and this crate has {}",
        frozen.len(),
        SCRUB_PATTERN_SOURCES.len()
    );
    for (index, (entry, (source, replacement, case_insensitive))) in
        frozen.iter().zip(SCRUB_PATTERN_SOURCES).enumerate()
    {
        assert_eq!(
            text(entry, "source"),
            *source,
            "secret pattern {index} differs from the frozen table"
        );
        let flags = text(entry, "flags");
        // `g` is implicit in `Regex::replace_all`; only `i` has to be carried.
        assert!(
            flags.contains('g'),
            "secret pattern {index} is not global, but `scrub_secrets` replaces all"
        );
        assert_eq!(
            flags.contains('i'),
            *case_insensitive,
            "secret pattern {index} disagrees about the `i` flag"
        );
        // The frozen replacement uses the JavaScript spelling `$1`; Rust spells
        // a group reference `${1}`. The produced text is identical.
        assert_eq!(
            &text(entry, "replacement")
                .replace("$1", "${1}")
                .replace("$2", "${2}"),
            replacement,
            "secret pattern {index} has a different replacement"
        );
    }
    assert_eq!(scrub_pattern_count(), SCRUB_PATTERN_SOURCES.len());
}
