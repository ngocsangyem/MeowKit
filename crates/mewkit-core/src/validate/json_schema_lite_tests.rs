//! The subset's keywords, and the exact wording each violation prints.
use serde_json::{Map, Value, json};

use super::{format_violation, validate_against_schema};

fn check(instance: Value, schema: Value) -> Vec<String> {
    let object: Map<String, Value> = schema.as_object().expect("an object schema").clone();
    validate_against_schema(&instance, &object, &[])
        .iter()
        .map(format_violation)
        .collect()
}

#[test]
fn a_type_mismatch_stops_at_one_message() {
    assert_eq!(
        check(json!(7), json!({"type": "string", "minLength": 20})),
        vec!["7 is not of type 'string' (path: /)"]
    );
}

#[test]
fn an_integer_satisfies_number_but_not_the_other_way() {
    assert!(check(json!(3), json!({"type": "number"})).is_empty());
    assert_eq!(check(json!(3.5), json!({"type": "integer"})).len(), 1);
}

#[test]
fn an_enum_lists_what_was_allowed() {
    assert_eq!(
        check(
            json!("python"),
            json!({"enum": ["claude-code", "portable"]})
        ),
        vec![r#""python" is not one of "claude-code", "portable" (path: /)"#]
    );
}

#[test]
fn a_required_property_is_named() {
    assert_eq!(
        check(json!({}), json!({"type": "object", "required": ["name"]})),
        vec!["'name' is a required property (path: /)"]
    );
}

#[test]
fn an_additional_property_is_refused_only_when_declared_closed() {
    let closed = json!({"type": "object", "additionalProperties": false});
    assert_eq!(
        check(json!({"extra": 1}), closed),
        vec!["additional property 'extra' is not allowed (path: /)"]
    );
    assert!(check(json!({"extra": 1}), json!({"type": "object"})).is_empty());
}

#[test]
fn a_pattern_uses_the_javascript_meanings() {
    // `\w` is `[0-9A-Za-z_]` in a non-`u` RegExp, so an accented letter is NOT
    // a word character — the difference `js_regex` exists for.
    let schema = json!({"type": "string", "pattern": "^\\w+$"});
    assert!(check(json!("mk_cook"), schema.clone()).is_empty());
    assert_eq!(check(json!("mké"), schema).len(), 1);
}

#[test]
fn a_nested_path_is_rendered_with_keys_and_indices() {
    let schema = json!({
        "type": "object",
        "properties": {"tags": {"type": "array", "items": {"type": "string"}}}
    });
    assert_eq!(
        check(json!({"tags": ["ok", 3]}), schema),
        vec![r#"3 is not of type 'string' (path: ["tags", 1])"#]
    );
}

#[test]
fn one_of_refuses_both_zero_and_two_matches() {
    let schema = json!({"oneOf": [{"type": "string"}, {"type": "number"}]});
    assert!(check(json!("x"), schema.clone()).is_empty());
    assert_eq!(
        check(json!(true), schema),
        vec!["true is not valid under any of the given schemas (path: /)"]
    );
    let ambiguous = json!({"oneOf": [{"type": "string"}, {"minLength": 1}]});
    assert_eq!(
        check(json!("x"), ambiguous),
        vec![r#""x" is valid under more than one of the given schemas (path: /)"#]
    );
}

#[test]
fn array_bounds_and_uniqueness_are_checked() {
    let schema = json!({"type": "array", "minItems": 2, "uniqueItems": true});
    assert_eq!(
        check(json!(["a"]), schema.clone()),
        vec!["array is too short (minItems 2) (path: /)"]
    );
    assert_eq!(
        check(json!(["a", "a"]), schema),
        vec!["array has non-unique elements (path: /)"]
    );
}

#[test]
fn string_length_and_number_bounds_quote_the_value() {
    assert_eq!(
        check(json!("ab"), json!({"type": "string", "minLength": 3})),
        vec![r#""ab" is too short (minLength 3) (path: /)"#]
    );
    assert_eq!(
        check(json!(12), json!({"type": "integer", "maximum": 10})),
        vec!["12 is greater than the maximum of 10 (path: /)"]
    );
}
