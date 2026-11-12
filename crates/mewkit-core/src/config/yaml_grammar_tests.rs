//! Unit cover for the subset parser: the constructs it refuses by name, and the
//! three value types it resolves. The fixture corpus in
//! `tests/config_loader.rs` is the cross-reader half of the same property.
use super::*;
use crate::config::config_values::ConfigValue;

fn parse(source: &str) -> ConfigValues {
    parse_config_subset(source).expect("inside the subset")
}

fn code(source: &str) -> &'static str {
    parse_config_subset(source)
        .expect_err("outside the subset")
        .code
}

#[test]
fn two_levels_of_keys_flatten_to_dotted_paths() {
    let values = parse("tdd: true\nbudget:\n  cap: 5\n  warn: 30\n");
    assert_eq!(values.get("tdd"), Some(&ConfigValue::Bool(true)));
    assert_eq!(values.get("budget.cap"), Some(&ConfigValue::Int(5)));
    assert_eq!(values.get("budget.warn"), Some(&ConfigValue::Int(30)));
    // A key that only opened a map contributes no value of its own.
    assert_eq!(values.get("budget"), None);
    assert_eq!(values.len(), 3);
}

#[test]
fn a_quoted_scalar_keeps_its_text_and_loses_its_quotes() {
    let values = parse("autobuild:\n  mode: \"LEAN\"\n");
    assert_eq!(
        values.get("autobuild.mode"),
        Some(&ConfigValue::Str("LEAN".into()))
    );
    let single = parse("autobuild:\n  mode: 'FULL'\n");
    assert_eq!(
        single.get("autobuild.mode"),
        Some(&ConfigValue::Str("FULL".into()))
    );
}

#[test]
fn a_bom_a_crlf_and_a_trailing_comment_change_nothing() {
    for source in [
        "\u{feff}tdd: true\n",
        "tdd: true\r\n",
        "tdd: true # switch strict mode on\n",
        "\n\ntdd: true\n\n",
    ] {
        assert_eq!(
            parse(source).get("tdd"),
            Some(&ConfigValue::Bool(true)),
            "{source:?}"
        );
    }
}

#[test]
fn a_comment_inside_a_quoted_value_is_part_of_the_value() {
    let values = parse("autobuild:\n  mode: \"a # b\"\n");
    assert_eq!(
        values.get("autobuild.mode"),
        Some(&ConfigValue::Str("a # b".into()))
    );
    assert_eq!(strip_comment("mode: \"a # b\" # tail"), "mode: \"a # b\" ");
}

#[test]
fn an_empty_or_comment_only_file_has_no_keys() {
    assert!(parse("").is_empty());
    assert!(parse("# nothing but comments\n# another line\n").is_empty());
}

#[test]
fn every_construct_outside_the_subset_is_refused_by_name() {
    assert_eq!(code("tdd: &flag true\n"), "anchor-not-supported");
    assert_eq!(code("tdd: *flag\n"), "anchor-not-supported");
    assert_eq!(code("tdd: !!bool true\n"), "tag-not-supported");
    assert_eq!(
        code("autobuild:\n  mode: |\n    FULL\n"),
        "block-scalar-not-supported"
    );
    assert_eq!(
        code("budget: { cap: 5 }\n"),
        "flow-collection-not-supported"
    );
    assert_eq!(
        code("hooks:\n  - name: post-write\n"),
        "sequence-not-supported"
    );
    assert_eq!(code("---\ntdd: true\n"), "document-marker-not-supported");
    assert_eq!(code("budget:\n\tcap: 5\n"), "tab-indentation");
    assert_eq!(code("budget:\n   cap: 5\n"), "odd-indentation");
    assert_eq!(code("budget:\n  cap:\n    nested: 1\n"), "nesting-too-deep");
    assert_eq!(code("  cap: 5\n"), "orphan-nesting");
    assert_eq!(code("tdd: true\ntdd: false\n"), "duplicate-key");
    assert_eq!(code("budget.cap: 5\n"), "dotted-key");
    assert_eq!(code("just a sentence\n"), "not-a-key");
    assert_eq!(code("1key: true\n"), "bad-key");
}

#[test]
fn an_integer_too_large_for_the_type_is_accepted_the_way_both_js_readers_accept_it() {
    // Verified: `parseYamlSubset("budget:\n  cap: 99999999999999999999\n")`
    // yields `{ "budget.cap": 1e20 }` and `js-yaml` yields the same double.
    // Refusing it made this reader stricter than the two it must agree with.
    let values = parse_config_subset("budget:\n  cap: 99999999999999999999\n")
        .expect("a huge whole number is still a whole number");
    assert_eq!(values.get("budget.cap"), Some(&ConfigValue::Int(i64::MAX)));
}

#[test]
fn every_spelling_outside_the_subset_is_refused_by_name() {
    assert_eq!(code("tdd: null\n"), "null-not-supported");
    assert_eq!(code("tdd: ~\n"), "null-not-supported");
    assert_eq!(code("tdd: True\n"), "bad-boolean-spelling");
    assert_eq!(code("tdd: TRUE\n"), "bad-boolean-spelling");
    assert_eq!(code("budget:\n  cap: 1.5\n"), "float-not-supported");
    assert_eq!(code("budget:\n  cap: +5\n"), "non-decimal-integer");
    assert_eq!(code("budget:\n  cap: 0x1f\n"), "non-decimal-integer");
    assert_eq!(code("budget:\n  cap: 0o17\n"), "non-decimal-integer");
    assert_eq!(
        code("autobuild:\n  mode: \"LEA\\x4E\"\n"),
        "escape-not-supported"
    );
    assert_eq!(
        code("$schema: \"https://meowkit.dev/x\n"),
        "unterminated-quote"
    );
    assert_eq!(
        code("autobuild:\n  mode: \"LEAN\" and more\n"),
        "trailing-content-after-quote"
    );
}

#[test]
fn the_error_carries_the_line_and_names_the_path() {
    let error = parse_config_subset("tdd: true\nbudget:\n  cap: 1.5\n").expect_err("a float");
    assert_eq!(error.line, 3);
    assert_eq!(error.code, "float-not-supported");
    assert!(
        error.message.starts_with("budget.cap is 1.5"),
        "{}",
        error.message
    );
}

#[test]
fn a_schema_pointer_is_the_one_key_allowed_to_start_with_a_dollar() {
    let values = parse("$schema: https://meowkit.dev/schemas/config-v1.json\ntdd: true\n");
    assert_eq!(
        values.get(SCHEMA_KEY),
        Some(&ConfigValue::Str(
            "https://meowkit.dev/schemas/config-v1.json".into()
        ))
    );
    assert_eq!(code("$other: 1\n"), "bad-key");
}

#[test]
fn check_grammar_reports_the_same_first_violation() {
    assert!(check_grammar("tdd: true\n").is_none());
    assert_eq!(
        check_grammar("tdd: True\n").map(|e| e.code),
        Some("bad-boolean-spelling")
    );
}
