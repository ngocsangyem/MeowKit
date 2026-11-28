//! The rejections a config is subject to once it has parsed.
//!
//! Every one rejects the WHOLE file. A config that applied the keys parsed
//! before the bad one would hand the user a half-configured session whose
//! behaviour matches no file they can read, and the error identifiers below
//! exist so the hook reader and this one can be asserted to agree on which rule
//! fired rather than merely that both said no.
//!
//! Each message names the key, the scope it came from, and what to do instead,
//! because "invalid config" tells a user nothing they can act on.
use super::config_values::{ConfigValue, ConfigValues};
use super::schema::{
    ValueKind, forbidden_namespace, is_user_only_key, known_keys, protected_hook, state_only_key,
};
use super::yaml_grammar::SCHEMA_KEY;
use crate::path_shape::is_absolute_path;

/// Which file a key came from. It is in every message: a user asked to remove a
/// key needs to know which of the two files holds it.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum ConfigScope {
    #[default]
    ProjectConfig,
    UserConfig,
}

impl ConfigScope {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::ProjectConfig => "project config",
            Self::UserConfig => "user config",
        }
    }
}

impl std::fmt::Display for ConfigScope {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

/// One rule that fired, with the identifier both readers report.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RuleError {
    pub code: &'static str,
    pub key: String,
    pub message: String,
    pub fix: String,
}

fn reject<T>(
    code: &'static str,
    key: &str,
    message: String,
    fix: String,
) -> Result<T, Box<RuleError>> {
    Err(Box::new(RuleError {
        code,
        key: key.to_string(),
        message,
        fix,
    }))
}

/// A committed file must not hold a secret, however the user spelled the key.
/// `/keys|token|secret|password/i`.
fn looks_like_secret(text: &str) -> bool {
    let lowered = text.to_lowercase();
    ["keys", "token", "secret", "password"]
        .iter()
        .any(|word| lowered.contains(word))
}

/// A `hooks.<name>` toggle that is well formed but names no registered handler,
/// reported instead of refused. Removing or renaming a handler must not turn a
/// config that only switched it off into a rejected file, which would also drop
/// every other key in it; the key is skipped and this says so.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RuleWarning {
    pub code: &'static str,
    pub key: String,
    pub message: String,
    pub fix: String,
}

/// True for `hooks.<kebab-name>: <boolean>` where the name is neither
/// registered nor protected — the shape a removed handler's toggle leaves.
pub fn is_stale_hook_toggle(key: &str, value: &ConfigValue, observer_names: &[String]) -> bool {
    let Some(name) = key.strip_prefix("hooks.") else {
        return false;
    };
    matches!(value, ConfigValue::Bool(_))
        && is_kebab(name)
        && protected_hook(name).is_none()
        && !observer_names.iter().any(|known| known == name)
}

/// `^[a-z0-9]+(-[a-z0-9]+)*$`, the registry's toggle-key shape.
fn is_kebab(name: &str) -> bool {
    !name.is_empty()
        && name.split('-').all(|part| {
            !part.is_empty()
                && part
                    .bytes()
                    .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit())
        })
}

/// One warning per stale hook toggle in `values`, in file order.
pub fn stale_hook_toggles(
    values: &ConfigValues,
    observer_names: &[String],
    scope: ConfigScope,
) -> Vec<RuleWarning> {
    values
        .iter()
        .filter(|(key, value)| is_stale_hook_toggle(key, value, observer_names))
        .map(|(key, _)| RuleWarning {
            code: "unknown-hook-toggle",
            key: key.to_string(),
            message: format!(
                "{key} in the {scope} names no registered hook handler, so it switches nothing off"
            ),
            fix: format!("remove {key}; the handler it named was removed or renamed"),
        })
        .collect()
}

/// `Ok(())` for an already-parsed flat map, or the first rule that fired. A
/// stale hook toggle is not a rule failure: see [`stale_hook_toggles`].
///
/// The values are not transformed: a config either applies as written or does
/// not apply at all, so there is nothing to hand back on success that the caller
/// does not already hold.
pub fn apply_rules(
    values: &ConfigValues,
    observer_names: &[String],
    scope: ConfigScope,
) -> Result<(), Box<RuleError>> {
    let keys = known_keys(observer_names);

    for (key, value) in values.iter() {
        if key == SCHEMA_KEY {
            continue;
        }
        let namespace = key.split('.').next().unwrap_or(key);

        if let Some(why) = forbidden_namespace(namespace) {
            return reject(
                "forbidden-namespace",
                key,
                format!(
                    "{key} in the {scope}: the \"{namespace}\" namespace does not exist, because {why}"
                ),
                format!("remove {key}"),
            );
        }

        if looks_like_secret(key) || value.as_str().is_some_and(looks_like_secret) {
            return reject(
                "secret-in-config",
                key,
                format!(
                    "{key} in the {scope} looks like a credential, and the config is committed"
                ),
                "move the value to the environment or to .meowkit/.env, which is never committed"
                    .to_string(),
            );
        }

        if let Some(text) = value.as_str().filter(|text| is_absolute_path(text)) {
            return reject(
                "absolute-path",
                key,
                format!(
                    "{key} in the {scope} is an absolute path ({text}), which resolves differently on a teammate's machine"
                ),
                "use a path relative to the project root, or drop the key".to_string(),
            );
        }

        if namespace == "hooks"
            && let Some(name) = key.strip_prefix("hooks.")
            && let Some(why) = protected_hook(name)
        {
            return reject(
                "protected-hook",
                key,
                format!("{name} cannot be disabled from the {scope}: {why}"),
                "remove the key; a safety check is not a preference".to_string(),
            );
        }

        if is_stale_hook_toggle(key, value, observer_names) {
            continue;
        }

        if let Some(why) = state_only_key(key) {
            return reject(
                "state-only-key",
                key,
                format!("{key} is not a config key in the {scope}: {why}"),
                format!(
                    "remove the key and run .claude/hooks/lib/workflow-config set {key} true, which records it in .meowkit/state/"
                ),
            );
        }

        if scope == ConfigScope::ProjectConfig && is_user_only_key(key) {
            return reject(
                "user-only-key",
                key,
                format!(
                    "{key} in the {scope}: host settings are machine-wide, so a project file cannot change them"
                ),
                format!("remove {key} here and set it in ~/.meowkit/config.yaml"),
            );
        }

        let Some((_, spec)) = keys.iter().find(|(known, _)| known == key) else {
            return reject(
                "unknown-key",
                key,
                format!("{key} in the {scope} is not a config key"),
                "check the spelling against .meowkit/config.yaml, whose commented stubs list every key"
                    .to_string(),
            );
        };

        match spec.kind {
            ValueKind::Boolean if !matches!(value, ConfigValue::Bool(_)) => {
                return reject(
                    "wrong-type",
                    key,
                    format!(
                        "{key} in the {scope} must be true or false, not {}",
                        value.literal()
                    ),
                    format!("set {key} to true or false"),
                );
            }
            ValueKind::Integer if !matches!(value, ConfigValue::Int(_)) => {
                return reject(
                    "wrong-type",
                    key,
                    format!(
                        "{key} in the {scope} must be a whole number, not {}",
                        value.literal()
                    ),
                    format!("set {key} to a whole number"),
                );
            }
            ValueKind::String if !matches!(value, ConfigValue::Str(_)) => {
                let allowed = match spec.allowed {
                    Some(allowed) => allowed.join(", "),
                    None => "the documented values".to_string(),
                };
                return reject(
                    "wrong-type",
                    key,
                    format!(
                        "{key} in the {scope} must be a string, not {}",
                        value.literal()
                    ),
                    format!("set {key} to one of {allowed}"),
                );
            }
            _ => {}
        }

        if let Some(allowed) = spec.allowed
            && !value.as_str().is_some_and(|text| allowed.contains(&text))
        {
            let list = allowed.join(", ");
            return reject(
                "not-in-enum",
                key,
                format!(
                    "{key} in the {scope} is {}, which is not one of {list}",
                    value.literal()
                ),
                format!("set {key} to one of {list}"),
            );
        }
    }

    Ok(())
}

#[cfg(test)]
#[path = "config_rules_tests.rs"]
mod config_rules_tests;
