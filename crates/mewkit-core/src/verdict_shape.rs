//! The verdict JSON's shape check, reporting zod 3's own issue messages in
//! zod's order: schema keys in declaration order, array items by index, every
//! issue collected rather than the first. `schema::verdict` is the typed model;
//! this is the refusal text `verdict-gate` prints, which a serde error cannot
//! reproduce.
use serde_json::Value;

const DIMENSION_VERDICTS: &[&str] = &["PASS", "WARN", "FAIL"];
const GATES: &[&str] = &["review", "contract"];
const DECISIONS: &[&str] = &["PASS", "PASS_WITH_RISK", "BLOCKED"];

/// Every zod issue for `value`, as `<path>: <message>` (`<root>` for none).
pub fn verdict_issues(value: &Value) -> Vec<String> {
    let mut issues = Issues::default();
    let Some(object) = expect_object(value, "", &mut issues) else {
        return issues.0;
    };
    let field = |key: &str| object.get(key);
    required_string(
        field("schema_version"),
        "schema_version",
        false,
        &mut issues,
    );
    required_string(field("slug"), "slug", true, &mut issues);
    required_enum(field("gate"), "gate", GATES, &mut issues);
    required_enum(field("decision"), "decision", DECISIONS, &mut issues);
    match field("dimensions") {
        None => issues.push("dimensions", "Required"),
        Some(Value::Array(items)) => {
            for (i, item) in items.iter().enumerate() {
                dimension(item, &format!("dimensions.{i}"), &mut issues);
            }
        }
        Some(other) => issues.push("dimensions", &expected("array", other)),
    }
    match field("evidence_refs") {
        None => {}
        Some(Value::Array(items)) => {
            for (i, item) in items.iter().enumerate() {
                if !item.is_string() {
                    issues.push(&format!("evidence_refs.{i}"), &expected("string", item));
                }
            }
        }
        Some(other) => issues.push("evidence_refs", &expected("array", other)),
    }
    required_string(field("created_at"), "created_at", false, &mut issues);
    issues.0
}

fn dimension(value: &Value, path: &str, issues: &mut Issues) {
    let Some(object) = expect_object(value, path, issues) else {
        return;
    };
    required_string(object.get("name"), &format!("{path}.name"), true, issues);
    required_enum(
        object.get("verdict"),
        &format!("{path}.verdict"),
        DIMENSION_VERDICTS,
        issues,
    );
    if let Some(note) = object.get("note")
        && !note.is_string()
    {
        issues.push(&format!("{path}.note"), &expected("string", note));
    }
}

#[derive(Default)]
struct Issues(Vec<String>);

impl Issues {
    fn push(&mut self, path: &str, message: &str) {
        let path = if path.is_empty() { "<root>" } else { path };
        self.0.push(format!("{path}: {message}"));
    }
}

fn expect_object<'a>(
    value: &'a Value,
    path: &str,
    issues: &mut Issues,
) -> Option<&'a serde_json::Map<String, Value>> {
    match value {
        Value::Object(map) => Some(map),
        other => {
            issues.push(path, &expected("object", other));
            None
        }
    }
}

/// `z.string()`, or `z.string().min(1)` when `non_empty`.
fn required_string(value: Option<&Value>, path: &str, non_empty: bool, issues: &mut Issues) {
    match value {
        None => issues.push(path, "Required"),
        Some(Value::String(s)) if non_empty && s.is_empty() => {
            issues.push(path, "String must contain at least 1 character(s)");
        }
        Some(Value::String(_)) => {}
        Some(other) => issues.push(path, &expected("string", other)),
    }
}

/// `z.enum([...])`: a non-string names the options as its expected type; a
/// string outside them gets zod's "Invalid enum value" wording.
fn required_enum(value: Option<&Value>, path: &str, options: &[&str], issues: &mut Issues) {
    let joined = options
        .iter()
        .map(|o| format!("'{o}'"))
        .collect::<Vec<_>>()
        .join(" | ");
    match value {
        None => issues.push(path, "Required"),
        Some(Value::String(s)) if options.contains(&s.as_str()) => {}
        Some(Value::String(s)) => issues.push(
            path,
            &format!("Invalid enum value. Expected {joined}, received '{s}'"),
        ),
        Some(other) => issues.push(
            path,
            &format!("Expected {joined}, received {}", type_name(other)),
        ),
    }
}

fn expected(kind: &str, value: &Value) -> String {
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

#[cfg(test)]
#[path = "verdict_shape_tests.rs"]
mod tests;
