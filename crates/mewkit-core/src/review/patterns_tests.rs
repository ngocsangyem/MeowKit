use super::{CONFIG_KEY_RE, LOCKFILE_RE, RISK_PATTERNS, SOURCE_RE, TEST_RE, export_symbols};

#[test]
fn a_declaration_and_a_named_export_both_yield_their_symbols() {
    assert_eq!(export_symbols("export const getUser = 1;"), ["getUser"]);
    assert_eq!(export_symbols("export async function load() {}"), ["load"]);
    assert_eq!(export_symbols("export { a, b as c }"), ["a", "c"]);
    // A re-export renamed with a non-identifier target is dropped rather than
    // searched for.
    assert_eq!(export_symbols("export { a as default }"), ["default"]);
    assert!(export_symbols("const notExported = 1;").is_empty());
}

#[test]
fn a_word_boundary_risk_pattern_keeps_its_ascii_meaning() {
    let cascade = &RISK_PATTERNS
        .iter()
        .find(|(flag, _)| *flag == "DATA_MODEL")
        .expect("DATA_MODEL is a risk flag")
        .1;
    assert!(cascade.is_match("ON DELETE CASCADE"));
    assert!(!cascade.is_match("cascading"));
}

#[test]
fn classifiers_separate_tests_lockfiles_and_source() {
    assert!(TEST_RE.is_match("src/__tests__/a.ts"));
    assert!(TEST_RE.is_match("src/a.test.tsx"));
    assert!(LOCKFILE_RE.is_match("Cargo.lock"));
    assert!(SOURCE_RE.is_match("src/a.mts"));
    assert!(SOURCE_RE.is_match("main.swift"));
    assert!(!SOURCE_RE.is_match("README.md"));
}

#[test]
fn a_config_key_is_read_from_either_assignment_spelling() {
    assert_eq!(
        &CONFIG_KEY_RE.captures("  \"api.key\": 1").expect("a key")[1],
        "api.key"
    );
    assert_eq!(
        &CONFIG_KEY_RE.captures("TOKEN=abc").expect("a key")[1],
        "TOKEN"
    );
    assert!(CONFIG_KEY_RE.captures("# a comment").is_none());
}
