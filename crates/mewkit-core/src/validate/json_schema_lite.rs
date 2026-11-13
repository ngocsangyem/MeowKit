//! A JSON Schema (draft-07 SUBSET) checker — deliberately not a general one.
//!
//! It covers exactly the keywords the kit's own schemas use, so a schema change
//! that reaches for something new fails loudly here instead of being silently
//! ignored. A permissive validator is what let the frontmatter contract drift
//! unnoticed. Port of `core/json-schema-lite.ts`.
//!
//! Supported: type, enum, const, required, properties, additionalProperties
//! (boolean), pattern, minLength, maxLength, minimum, maximum, items, minItems,
//! maxItems, uniqueItems, oneOf, anyOf.
use serde_json::{Map, Value};

use super::json_schema_object::check_object;
use super::json_schema_scalars::{check_array, check_number, check_string};

/// One violation: where in the instance, and what is wrong.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SchemaViolation {
    /// Instance path as keys and indices; empty for the root.
    pub path: Vec<String>,
    pub message: String,
}

impl SchemaViolation {
    pub(super) fn new(path: &[String], message: String) -> Self {
        Self {
            path: path.to_vec(),
            message,
        }
    }
}

/// The name draft-07 gives a value's type. `integer` is reported for a whole
/// number, as JavaScript's `Number.isInteger` does.
fn type_of(value: &Value) -> &'static str {
    match value {
        Value::Null => "null",
        Value::Bool(_) => "boolean",
        Value::Number(number) => {
            if number.as_i64().is_some() || number.as_f64().is_some_and(|f| f.fract() == 0.0) {
                "integer"
            } else {
                "number"
            }
        }
        Value::String(_) => "string",
        Value::Array(_) => "array",
        Value::Object(_) => "object",
    }
}

fn type_matches(value: &Value, expected: &str) -> bool {
    let actual = type_of(value);
    if expected == "number" {
        return actual == "number" || actual == "integer";
    }
    actual == expected
}

/// `JSON.stringify(value)` for the shapes a frontmatter value can take, because
/// every message the npm CLI prints embeds it.
pub(super) fn stringify(value: &Value) -> String {
    serde_json::to_string(value).unwrap_or_else(|_| "null".to_string())
}

pub(super) fn string_list(value: Option<&Value>) -> Vec<String> {
    value
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default()
}

/// Every violation of `schema` by `value`, in document order.
pub fn validate_against_schema(
    value: &Value,
    schema: &Map<String, Value>,
    path: &[String],
) -> Vec<SchemaViolation> {
    let mut out = Vec::new();

    let types = match schema.get("type") {
        Some(Value::String(single)) => vec![single.clone()],
        other => string_list(other),
    };
    if !types.is_empty() && !types.iter().any(|name| type_matches(value, name)) {
        // A type mismatch stops the rest: every further keyword would report
        // the same problem in a less useful way.
        let names: Vec<String> = types.iter().map(|name| format!("'{name}'")).collect();
        return vec![SchemaViolation::new(
            path,
            format!("{} is not of type {}", stringify(value), names.join(", ")),
        )];
    }

    if let Some(allowed) = schema.get("enum").and_then(Value::as_array) {
        let rendered: Vec<String> = allowed.iter().map(stringify).collect();
        if !rendered.contains(&stringify(value)) {
            out.push(SchemaViolation::new(
                path,
                format!("{} is not one of {}", stringify(value), rendered.join(", ")),
            ));
        }
    }
    if let Some(constant) = schema.get("const")
        && stringify(constant) != stringify(value)
    {
        out.push(SchemaViolation::new(
            path,
            format!(
                "{} was expected to be {}",
                stringify(value),
                stringify(constant)
            ),
        ));
    }

    for key in ["oneOf", "anyOf"] {
        let Some(branches) = schema.get(key).and_then(Value::as_array) else {
            continue;
        };
        let passing = branches
            .iter()
            .filter_map(Value::as_object)
            .filter(|branch| validate_against_schema(value, branch, path).is_empty())
            .count();
        if passing == 0 {
            out.push(SchemaViolation::new(
                path,
                format!(
                    "{} is not valid under any of the given schemas",
                    stringify(value)
                ),
            ));
        } else if key == "oneOf" && passing > 1 {
            out.push(SchemaViolation::new(
                path,
                format!(
                    "{} is valid under more than one of the given schemas",
                    stringify(value)
                ),
            ));
        }
    }

    match value {
        Value::String(text) => check_string(text, schema, path, &mut out),
        Value::Number(_) => check_number(value, schema, path, &mut out),
        Value::Array(items) => check_array(items, schema, path, &mut out),
        Value::Object(map) => check_object(map, schema, path, &mut out),
        _ => {}
    }
    out
}

/// The jsonschema-style rendering the kit's validators print.
pub fn format_violation(violation: &SchemaViolation) -> String {
    let location = if violation.path.is_empty() {
        "/".to_string()
    } else {
        let parts: Vec<String> = violation
            .path
            .iter()
            .map(|part| match part.parse::<i64>() {
                // An array index prints as a NUMBER, which is what
                // `JSON.stringify` does for the number the TypeScript pushes.
                Ok(index) if part == &index.to_string() => index.to_string(),
                _ => stringify(&Value::String(part.clone())),
            })
            .collect();
        format!("[{}]", parts.join(", "))
    };
    format!("{} (path: {location})", violation.message)
}

#[cfg(test)]
#[path = "json_schema_lite_tests.rs"]
mod json_schema_lite_tests;
