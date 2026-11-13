//! The object keywords: required properties, declared properties, and whether
//! an undeclared one is allowed.
use serde_json::{Map, Value};

use super::json_schema_lite::{SchemaViolation, string_list, validate_against_schema};

pub(super) fn check_object(
    value: &Map<String, Value>,
    schema: &Map<String, Value>,
    path: &[String],
    out: &mut Vec<SchemaViolation>,
) {
    for key in string_list(schema.get("required")) {
        if !value.contains_key(&key) {
            out.push(SchemaViolation::new(
                path,
                format!("'{key}' is a required property"),
            ));
        }
    }
    let empty = Map::new();
    let properties = schema
        .get("properties")
        .and_then(Value::as_object)
        .unwrap_or(&empty);
    for (key, raw) in value {
        match properties.get(key).and_then(Value::as_object) {
            Some(property_schema) => {
                let mut child = path.to_vec();
                child.push(key.clone());
                out.extend(validate_against_schema(raw, property_schema, &child));
            }
            None if schema.get("additionalProperties") == Some(&Value::Bool(false)) => {
                out.push(SchemaViolation::new(
                    path,
                    format!("additional property '{key}' is not allowed"),
                ));
            }
            None => {}
        }
    }
}
