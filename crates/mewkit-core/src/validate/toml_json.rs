//! A TOML document as JSON, so one shape serves every target reader.
//!
//! `toml_edit` is the workspace's TOML dependency (the Codex emitter writes
//! with it) and is a format-preserving editor rather than a deserializer —
//! hence this small conversion instead of a serde round-trip, and no new
//! dependency for the target checks.
use serde_json::Value;

/// A TOML table as a JSON object, in document order.
pub(super) fn table_to_json(table: &toml_edit::Table) -> Value {
    let mut map = serde_json::Map::new();
    for (key, item) in table.iter() {
        map.insert(key.to_string(), item_to_json(item));
    }
    Value::Object(map)
}

/// One TOML item as JSON. A datetime becomes its string form: no check reads
/// one, and dropping it would hide a key from the secret scan.
fn item_to_json(item: &toml_edit::Item) -> Value {
    match item {
        toml_edit::Item::Value(value) => value_to_json(value),
        toml_edit::Item::Table(table) => table_to_json(table),
        toml_edit::Item::ArrayOfTables(tables) => {
            Value::Array(tables.iter().map(table_to_json).collect())
        }
        toml_edit::Item::None => Value::Null,
    }
}

fn value_to_json(value: &toml_edit::Value) -> Value {
    match value {
        toml_edit::Value::String(text) => Value::String(text.value().clone()),
        toml_edit::Value::Integer(number) => Value::from(*number.value()),
        toml_edit::Value::Float(number) => serde_json::Number::from_f64(*number.value())
            .map(Value::Number)
            .unwrap_or(Value::Null),
        toml_edit::Value::Boolean(flag) => Value::Bool(*flag.value()),
        toml_edit::Value::Datetime(stamp) => Value::String(stamp.value().to_string()),
        toml_edit::Value::Array(items) => Value::Array(items.iter().map(value_to_json).collect()),
        toml_edit::Value::InlineTable(table) => {
            let mut map = serde_json::Map::new();
            for (key, item) in table.iter() {
                map.insert(key.to_string(), value_to_json(item));
            }
            Value::Object(map)
        }
    }
}
