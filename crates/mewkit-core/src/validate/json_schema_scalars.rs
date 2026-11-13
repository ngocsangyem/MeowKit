//! The keyword checks for a scalar or an array instance.
//!
//! Split from the dispatcher so that file reads as "which keywords apply to
//! which instance", and this one as "what each keyword means". Every message is
//! the npm validator's wording verbatim, because both CLIs print it.
use serde_json::{Map, Value};

use super::json_schema_lite::{SchemaViolation, stringify, validate_against_schema};

pub(super) fn check_string(
    value: &str,
    schema: &Map<String, Value>,
    path: &[String],
    out: &mut Vec<SchemaViolation>,
) {
    if let Some(pattern) = schema.get("pattern").and_then(Value::as_str) {
        // The schema's patterns are JavaScript `RegExp` sources, so they are
        // compiled with the ECMAScript meanings of `\w`, `\d` and `\b`.
        let compiled = crate::js_regex::compile(pattern);
        let matched = compiled
            .as_ref()
            .map(|regex| regex.is_match(value))
            .unwrap_or(false);
        if !matched {
            out.push(SchemaViolation::new(
                path,
                format!(
                    "{} does not match '{pattern}'",
                    stringify(&Value::String(value.to_string()))
                ),
            ));
        }
    }
    let length = value.chars().count() as i64;
    if let Some(min) = schema.get("minLength").and_then(Value::as_i64)
        && length < min
    {
        out.push(SchemaViolation::new(
            path,
            format!(
                "{} is too short (minLength {min})",
                stringify(&Value::String(value.to_string()))
            ),
        ));
    }
    if let Some(max) = schema.get("maxLength").and_then(Value::as_i64)
        && length > max
    {
        out.push(SchemaViolation::new(
            path,
            format!(
                "{} is too long (maxLength {max})",
                stringify(&Value::String(value.to_string()))
            ),
        ));
    }
}

pub(super) fn check_number(
    value: &Value,
    schema: &Map<String, Value>,
    path: &[String],
    out: &mut Vec<SchemaViolation>,
) {
    let Some(number) = value.as_f64() else {
        return;
    };
    if let Some(minimum) = schema.get("minimum").and_then(Value::as_f64)
        && number < minimum
    {
        out.push(SchemaViolation::new(
            path,
            format!(
                "{} is less than the minimum of {}",
                stringify(value),
                stringify(&schema["minimum"])
            ),
        ));
    }
    if let Some(maximum) = schema.get("maximum").and_then(Value::as_f64)
        && number > maximum
    {
        out.push(SchemaViolation::new(
            path,
            format!(
                "{} is greater than the maximum of {}",
                stringify(value),
                stringify(&schema["maximum"])
            ),
        ));
    }
}

pub(super) fn check_array(
    value: &[Value],
    schema: &Map<String, Value>,
    path: &[String],
    out: &mut Vec<SchemaViolation>,
) {
    if let Some(min) = schema.get("minItems").and_then(Value::as_i64)
        && (value.len() as i64) < min
    {
        out.push(SchemaViolation::new(
            path,
            format!("array is too short (minItems {min})"),
        ));
    }
    if let Some(max) = schema.get("maxItems").and_then(Value::as_i64)
        && (value.len() as i64) > max
    {
        out.push(SchemaViolation::new(
            path,
            format!("array is too long (maxItems {max})"),
        ));
    }
    if schema.get("uniqueItems") == Some(&Value::Bool(true)) {
        let mut seen: Vec<String> = value.iter().map(stringify).collect();
        let total = seen.len();
        seen.sort();
        seen.dedup();
        if seen.len() != total {
            out.push(SchemaViolation::new(
                path,
                "array has non-unique elements".to_string(),
            ));
        }
    }
    if let Some(items) = schema.get("items").and_then(Value::as_object) {
        for (index, element) in value.iter().enumerate() {
            let mut child = path.to_vec();
            child.push(index.to_string());
            out.extend(validate_against_schema(element, items, &child));
        }
    }
}
