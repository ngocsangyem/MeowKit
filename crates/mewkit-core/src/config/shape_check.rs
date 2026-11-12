//! The second validation layer, kept deliberately redundant.
//!
//! `load-config.ts` runs `buildConfigSchema(...).safeParse(document)` AFTER
//! `applyRules`, and its comment says why: "the flat rules are what produces a
//! message naming one key. Running both means a shape the rules somehow let
//! through is still refused rather than applied." Dropping it during the port
//! would have been a kit behaviour change hidden inside a port, so the layer is
//! here rather than argued away.
//!
//! Independence is the whole point, so this does NOT call into
//! [`super::config_rules`]. It walks the declared surface
//! ([`super::schema::SCALAR_KEYS`] plus one toggle per observer) and refuses
//! anything that is not exactly in it, in zod's wording, under zod's error code.

use super::config_rules::ConfigScope;
use super::config_values::{ConfigValue, ConfigValues};
use super::schema::{USER_SCOPE_ONLY_KEY, ValueKind, known_keys};
use super::yaml_grammar::SCHEMA_KEY;

/// One key the declared shape does not admit. `key` is the dotted key, as zod
/// reports `issue.path.join(".")`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ShapeViolation {
    pub key: String,
    pub detail: String,
}

/// zod's name for the type of a received value, for `received …` in a message.
fn type_name(value: &ConfigValue) -> &'static str {
    match value {
        ConfigValue::Bool(_) => "boolean",
        ConfigValue::Int(_) => "number",
        ConfigValue::Str(_) => "string",
    }
}

fn expected_name(kind: ValueKind) -> &'static str {
    match kind {
        ValueKind::Boolean => "boolean",
        ValueKind::Integer => "number",
        ValueKind::String => "string",
    }
}

fn violation(key: &str, detail: String) -> Result<(), ShapeViolation> {
    Err(ShapeViolation {
        key: key.to_string(),
        detail,
    })
}

fn unrecognized(key: &str) -> Result<(), ShapeViolation> {
    // zod reports an unknown key on the PARENT object, naming the child.
    let leaf = key.rsplit('.').next().unwrap_or(key);
    violation(key, format!("Unrecognized key(s) in object: '{leaf}'"))
}

fn wrong_type(key: &str, kind: ValueKind, value: &ConfigValue) -> Result<(), ShapeViolation> {
    violation(
        key,
        format!(
            "Expected {}, received {}",
            expected_name(kind),
            type_name(value)
        ),
    )
}

/// `Ok(())` when every key is admitted by the declared shape, or the first key
/// that is not.
pub fn check_shape(
    values: &ConfigValues,
    observer_names: &[String],
    scope: ConfigScope,
) -> Result<(), ShapeViolation> {
    let keys = known_keys(observer_names);
    for (key, value) in values.iter() {
        // A `$schema` line is a pointer rather than a setting, so the rules skip
        // it — but the one thing it has to be is a string, since a non-string
        // pointer is a file no editor will validate.
        if key == SCHEMA_KEY {
            if !matches!(value, ConfigValue::Str(_)) {
                wrong_type(key, ValueKind::String, value)?;
            }
            continue;
        }
        if key == USER_SCOPE_ONLY_KEY {
            if scope != ConfigScope::UserConfig {
                unrecognized(key)?;
            } else if !matches!(value, ConfigValue::Bool(_)) {
                wrong_type(key, ValueKind::Boolean, value)?;
            }
            continue;
        }
        let Some((_, spec)) = keys.iter().find(|(known, _)| known == key) else {
            unrecognized(key)?;
            continue;
        };
        let matches_kind = match spec.kind {
            ValueKind::Boolean => matches!(value, ConfigValue::Bool(_)),
            ValueKind::Integer => matches!(value, ConfigValue::Int(_)),
            ValueKind::String => matches!(value, ConfigValue::Str(_)),
        };
        if !matches_kind {
            wrong_type(key, spec.kind, value)?;
        }
        if let Some(allowed) = spec.allowed
            && !value.as_str().is_some_and(|text| allowed.contains(&text))
        {
            let expected = allowed
                .iter()
                .map(|value| format!("'{value}'"))
                .collect::<Vec<_>>()
                .join(" | ");
            violation(
                key,
                format!(
                    "Invalid enum value. Expected {expected}, received '{}'",
                    value.as_str().unwrap_or_default()
                ),
            )?;
        }
    }
    Ok(())
}

#[cfg(test)]
#[path = "shape_check_tests.rs"]
mod tests;
