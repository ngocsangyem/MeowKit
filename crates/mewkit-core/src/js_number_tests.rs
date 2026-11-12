// Every expectation is the value Node printed for the same input:
//
//   node -e 'for (const c of ["3","","abc","-3","1.5","0x10"])
//              console.log(JSON.stringify(c), Number(c), Number.isInteger(Number(c)))'
//
//   "3" 3 true · "" 0 true · "abc" NaN false · "-3" -3 true
//   "1.5" 1.5 false · "0x10" 16 true
use super::*;

fn n(raw: &str) -> Option<String> {
    js_number(raw).map(|value| value.to_string())
}

#[test]
fn a_whole_number_is_an_integer_so_a_count_field_still_reads_it() {
    assert_eq!(n("3").as_deref(), Some("3"));
    assert_eq!(n("0").as_deref(), Some("0"));
    assert_eq!(n("1e3").as_deref(), Some("1000"));
    assert_eq!(n("+5").as_deref(), Some("5"));
    assert_eq!(n("5.").as_deref(), Some("5"));
    assert_eq!(n("0.0").as_deref(), Some("0"));
}

#[test]
fn an_absent_or_blank_value_is_zero_exactly_as_number_computes_it() {
    assert_eq!(n("").as_deref(), Some("0"));
    assert_eq!(n("   ").as_deref(), Some("0"));
    assert_eq!(n("  7  ").as_deref(), Some("7"));
}

#[test]
fn a_radix_literal_is_a_number_in_javascript() {
    assert_eq!(n("0x10").as_deref(), Some("16"));
    assert_eq!(n("0o17").as_deref(), Some("15"));
    assert_eq!(n("0b101").as_deref(), Some("5"));
    // A prefix with no digits is NaN, not a fallback to decimal `0`.
    assert_eq!(n("0x"), None);
}

#[test]
fn garbled_input_is_not_a_number_at_all() {
    for raw in ["abc", "1_0", "inf", "nan", "1.2.3", "5px", "--1"] {
        assert_eq!(n(raw), None, "{raw} should be NaN");
    }
}

#[test]
fn infinity_is_not_representable_and_reads_as_no_number() {
    assert_eq!(n("Infinity"), None);
    assert_eq!(n("-Infinity"), None);
    assert_eq!(n("1e999"), None);
}

#[test]
fn a_negative_or_fractional_value_survives_as_a_number_for_the_schema_to_refuse() {
    // These are valid JS numbers and INVALID counts. Keeping them as numbers is
    // what lets the schema report "expected a whole number ≥ 0" instead of the
    // reader silently substituting 0.
    assert_eq!(n("-3").as_deref(), Some("-3"));
    assert_eq!(n("1.5").as_deref(), Some("1.5"));
    assert!(
        serde_json::from_value::<u64>(serde_json::Value::Number(
            js_number("-3").expect("a number")
        ))
        .is_err()
    );
    assert!(
        serde_json::from_value::<u64>(serde_json::Value::Number(
            js_number("1.5").expect("a number")
        ))
        .is_err()
    );
}

#[test]
fn a_value_above_two_to_the_fiftythree_stays_a_double_as_it_does_in_javascript() {
    // Node: Number("9007199254740993") === 9007199254740992.
    assert_eq!(
        js_number("9007199254740993").map(|v| v.as_f64().unwrap_or_default()),
        Some(9_007_199_254_740_992.0)
    );
}
