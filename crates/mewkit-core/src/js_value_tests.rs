//! Expected values were printed by Node 26 for the same inputs.
use serde_json::{Map, Value, json};

use super::*;

#[test]
fn date_parse_matches_v8_for_iso_forms() {
    let cases: &[(&str, Option<i64>)] = &[
        ("2026-11-13", Some(1_794_528_000_000)),
        ("2026-11-13T10:20:30Z", Some(1_794_565_230_000)),
        ("2026-11-13T10:20:30.5+02:00", Some(1_794_558_030_500)),
        ("2026", Some(1_767_225_600_000)),
        ("2026-02", Some(1_769_904_000_000)),
        ("2024-02-29T00:00:00.123456Z", Some(1_709_164_800_123)),
        ("2026-02-30", Some(1_772_409_600_000)),
        ("2026-02-31", Some(1_772_496_000_000)),
        ("2026-11-13T24:00:00Z", Some(1_794_614_400_000)),
        ("2026-11-13T10:20Z", Some(1_794_565_200_000)),
        ("2026-11-13 10:20:30Z", Some(1_794_565_230_000)),
        ("2026-11-13t10:20Z", Some(1_794_565_200_000)),
        ("1969-12-31T23:59:59Z", Some(-1000)),
        ("2026-02-32", None),
        ("2026-13-01", None),
        ("bad", None),
    ];
    for (text, want) in cases {
        assert_eq!(js_date_parse_millis(text), *want, "{text}");
    }
}

#[test]
fn numbers_and_strings_print_like_javascript() {
    assert_eq!(js_number_text(1.585), "1.585");
    assert_eq!(js_number_text(-0.0), "0");
    assert_eq!(js_number_text(2.0), "2");
    assert_eq!(js_number_text(0.1 + 0.2), "0.30000000000000004");
    assert_eq!(js_string(&json!([1, null, "a", [2, 3]])), "1,,a,2,3");
    assert_eq!(js_string(&json!({"a": 1})), "[object Object]");
    assert_eq!(js_json_number(3.0), json!(3));
}

#[test]
fn truthiness() {
    for v in [json!(null), json!(false), json!(0), json!(""), json!(0.0)] {
        assert!(!js_truthy(&v), "{v}");
    }
    for v in [json!(true), json!(1), json!("x"), json!([]), json!({})] {
        assert!(js_truthy(&v), "{v}");
    }
}

#[test]
fn object_keys_enumerate_in_javascript_order() {
    let mut map = Map::new();
    for (k, v) in [("b", 1), ("10", 2), ("2", 3), ("01", 4), ("a", 5)] {
        map.insert(k.into(), Value::from(v));
    }
    let ordered = js_object_order(map);
    assert_eq!(
        serde_json::to_string(&Value::Object(ordered)).unwrap(),
        r#"{"2":3,"10":2,"b":1,"01":4,"a":5}"#
    );
}
