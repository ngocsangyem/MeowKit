//! The published JSON Schema for `.meowkit/config.yaml`, rendered from the key
//! surface this crate validates with.
//!
//! One declaration feeds both the validator ([`super::shape_check`]) and the
//! document editors read, so an editor cannot accept a key the loader rejects.
//! The committed copy at `schemas/config-v1.json` is checked byte for byte by
//! the tests; `MEWKIT_BLESS=1` rewrites it after an intentional change.
//!
//! Every property is optional and every object closed: an unknown key is an
//! error rather than being ignored, and there is no `gates.*` or `paths.*`
//! property at any scope (see [`super::schema::FORBIDDEN_NAMESPACES`]).
use serde::Serialize;
use serde_json::{Map, Value, json, ser::PrettyFormatter};

use super::key_surface::{KeySpec, ValueKind, known_keys};
use super::schema::SCHEMA_URL;

/// The JSON Schema draft the document declares itself against.
const DRAFT: &str = "https://json-schema.org/draft-07/schema#";

const DESCRIPTION: &str = "The committed, human-owned project config at .meowkit/config.yaml. Generated from the loader's own schema; edit that, not this. There is no gates.* and no paths.* property at any scope, and unknown keys are errors rather than being ignored.";

fn leaf(spec: &KeySpec) -> Value {
    match (spec.kind, spec.allowed) {
        (ValueKind::Boolean, _) => json!({ "type": "boolean" }),
        (ValueKind::Integer, _) => json!({ "type": "integer" }),
        (ValueKind::String, Some(allowed)) => json!({ "type": "string", "enum": allowed }),
        (ValueKind::String, None) => json!({ "type": "string" }),
    }
}

fn closed_object(properties: Map<String, Value>) -> Value {
    json!({ "type": "object", "properties": properties, "additionalProperties": false })
}

/// The schema as a value, for the given observer toggle names. Groups appear in
/// the order their first key is declared, which is how the zod source nested them.
pub fn config_json_schema(observer_names: &[String]) -> Value {
    let mut groups: Map<String, Value> = Map::new();
    let mut properties = Map::new();
    properties.insert("$schema".into(), json!({ "type": "string" }));
    for (key, spec) in known_keys(observer_names) {
        match key.split_once('.') {
            None => {
                properties.insert(key, leaf(&spec));
            }
            Some((group, name)) => {
                if !groups.contains_key(group) {
                    // Reserve the slot now so the group keeps its declaration
                    // position among the top-level properties.
                    properties.insert(group.to_string(), Value::Null);
                    groups.insert(group.to_string(), Value::Object(Map::new()));
                }
                if let Some(Value::Object(members)) = groups.get_mut(group) {
                    members.insert(name.to_string(), leaf(&spec));
                }
            }
        }
    }
    for (group, members) in groups {
        if let Value::Object(members) = members {
            properties.insert(group, closed_object(members));
        }
    }
    let mut root = Map::new();
    root.insert("$schema".into(), json!(DRAFT));
    root.insert("$id".into(), json!(SCHEMA_URL));
    root.insert("title".into(), json!("MeowKit project configuration"));
    root.insert("description".into(), json!(DESCRIPTION));
    root.insert("type".into(), json!("object"));
    root.insert("properties".into(), Value::Object(properties));
    root.insert("additionalProperties".into(), json!(false));
    Value::Object(root)
}

/// The schema as committed: tab indentation and a trailing newline.
pub fn render_config_json_schema(observer_names: &[String]) -> String {
    let mut out = Vec::new();
    let formatter = PrettyFormatter::with_indent(b"\t");
    let mut serializer = serde_json::Serializer::with_formatter(&mut out, formatter);
    config_json_schema(observer_names)
        .serialize(&mut serializer)
        .expect("a JSON value always serializes");
    let mut text = String::from_utf8(out).expect("serde_json emits UTF-8");
    text.push('\n');
    text
}

#[cfg(test)]
#[path = "json_schema_tests.rs"]
mod tests;
