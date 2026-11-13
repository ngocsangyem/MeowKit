//! zod 3's issue vocabulary, as the field checks a schema walk is written in.
//!
//! Separated from the schemas themselves ([`super::packet_issues`]) because
//! these are the WORDS and that is the SHAPE: every message below is a string
//! the npm CLI prints and a skill reads, so each is reproduced exactly rather
//! than paraphrased, and the order each helper reports in is zod's own.

use serde_json::{Map, Value};

/// Collected issues, each `<path>: <message>` with the root spelled the way the
/// packet validators spell it.
#[derive(Default)]
pub(super) struct Issues(pub(super) Vec<String>);

impl Issues {
    pub(super) fn push(&mut self, path: &str, message: &str) {
        let path = if path.is_empty() { "(root)" } else { path };
        self.0.push(format!("{path}: {message}"));
    }
}

/// `z.string()`, or `z.string().min(1)` when `non_empty`.
///
/// A field with a `.default()` is optional on the way in, so an absent one is
/// not an issue; a present one is still checked.
pub(super) fn string_field(
    value: Option<&Value>,
    path: &str,
    non_empty: bool,
    issues: &mut Issues,
) {
    match value {
        None if non_empty => issues.push(path, "Required"),
        None => {}
        Some(Value::String(text)) if non_empty && text.is_empty() => {
            issues.push(path, "String must contain at least 1 character(s)");
        }
        Some(Value::String(_)) => {}
        Some(other) => issues.push(path, &expected("string", other)),
    }
}

/// `z.string().max(n)`, reported after the `min` check because that is the
/// order the checks were chained in.
///
/// Counted in CODE POINTS, where JavaScript's `.length` counts UTF-16 code
/// units. The two disagree only for a string carrying an astral character (an
/// emoji counts 1 here and 2 there), and only within `n` of the ceiling — so a
/// 512-character pointer path built from emoji is the one input on which the
/// two CLIs can differ. Narrowing that would mean counting UTF-16 units for a
/// path, which is the wrong unit for every other reader of the same field.
pub(super) fn max_length(text: &str, max: usize, path: &str, issues: &mut Issues) {
    if text.chars().count() > max {
        issues.push(
            path,
            &format!("String must contain at most {max} character(s)"),
        );
    }
}

/// `z.array(z.string())`.
pub(super) fn string_array(value: Option<&Value>, path: &str, issues: &mut Issues) {
    array_of(value, path, None, issues, |item, item_path, issues| {
        if !item.is_string() {
            issues.push(item_path, &expected("string", item));
        }
    });
}

/// `z.array(...)`, optionally with `.max(n)`.
///
/// zod checks an array's LENGTH before its items, so a six-pointer packet
/// reports the budget rather than six item errors.
pub(super) fn array_of(
    value: Option<&Value>,
    path: &str,
    max: Option<usize>,
    issues: &mut Issues,
    item: impl Fn(&Value, &str, &mut Issues),
) {
    let Some(value) = value else {
        return;
    };
    let Value::Array(items) = value else {
        issues.push(path, &expected("array", value));
        return;
    };
    if let Some(max) = max
        && items.len() > max
    {
        issues.push(
            path,
            &format!("Array must contain at most {max} element(s)"),
        );
    }
    for (i, entry) in items.iter().enumerate() {
        item(entry, &format!("{path}.{i}"), issues);
    }
}

/// A nested `z.object()`, or the invalid-type issue that replaces its contents.
pub(super) fn object_at<'a>(
    value: &'a Value,
    path: &str,
    issues: &mut Issues,
) -> Option<&'a Map<String, Value>> {
    match value {
        Value::Object(map) => Some(map),
        other => {
            issues.push(path, &expected("object", other));
            None
        }
    }
}

/// `z.enum([...])`: a non-string names the options as its expected type; a
/// string outside them gets zod's "Invalid enum value" wording.
pub(super) fn enum_field(value: Option<&Value>, path: &str, options: &[&str], issues: &mut Issues) {
    let joined = options
        .iter()
        .map(|o| format!("'{o}'"))
        .collect::<Vec<_>>()
        .join(" | ");
    match value {
        None => issues.push(path, "Required"),
        Some(Value::String(text)) if options.contains(&text.as_str()) => {}
        Some(Value::String(text)) => issues.push(
            path,
            &format!("Invalid enum value. Expected {joined}, received '{text}'"),
        ),
        Some(other) => issues.push(
            path,
            &format!("Expected {joined}, received {}", type_name(other)),
        ),
    }
}

/// `.strict()`: zod reports every unrecognised key in ONE issue, at the root,
/// after each known key has been parsed.
pub(super) fn unrecognised_keys(object: &Map<String, Value>, known: &[&str], issues: &mut Issues) {
    let extra: Vec<String> = object
        .keys()
        .filter(|key| !known.contains(&key.as_str()))
        .map(|key| format!("'{key}'"))
        .collect();
    if !extra.is_empty() {
        issues.push(
            "",
            &format!("Unrecognized key(s) in object: {}", extra.join(", ")),
        );
    }
}

pub(super) fn expected(kind: &str, value: &Value) -> String {
    format!("Expected {kind}, received {}", type_name(value))
}

/// zod's name for a received JSON value.
fn type_name(value: &Value) -> &'static str {
    match value {
        Value::Null => "null",
        Value::Bool(_) => "boolean",
        Value::Number(_) => "number",
        Value::String(_) => "string",
        Value::Array(_) => "array",
        Value::Object(_) => "object",
    }
}
