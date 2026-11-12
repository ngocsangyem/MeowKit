//! Which level answered, and why that order.
//!
//!   environment override > CLI flag > project config > user config > default
//!
//! The environment sits at the top for exactly one key. `MEOWKIT_TDD` is one of
//! only two sources that can turn strict test-first mode ON, so demoting it
//! below a committed file would let `tdd: false` in a pull request switch an
//! enforcement mode off for everyone, silently. Every other behaviour toggle has
//! no environment form at all — that is the point of having one committed file.
//!
//! The resolver reports the answering level alongside the value. A user asking
//! "why is this on?" is asking which file to edit, and a bare value cannot say.
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use super::config_rules::ConfigScope;
use super::config_values::{ConfigValue, ConfigValues};
use super::load_config::{ConfigFailure, load_config_file, project_config_path, user_config_path};
use super::yaml_grammar::SCHEMA_KEY;

/// The level that answered one key.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Level {
    Env,
    Flag,
    Project,
    User,
    Default,
}

impl Level {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Env => "env",
            Self::Flag => "flag",
            Self::Project => "project",
            Self::User => "user",
            Self::Default => "default",
        }
    }
}

impl std::fmt::Display for Level {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

/// Environment names that keep overriding their config key. Exactly one
/// qualifies, and it is named in the repository's classification table under the
/// class that exists for it, rather than special-cased in code.
pub const ENV_OVERRIDES: &[(&str, &str)] = &[("tdd", "MEOWKIT_TDD")];

const TRUTHY: &[&str] = &["1", "true", "yes", "on", "enable", "enabled"];
const FALSY: &[&str] = &["0", "false", "no", "off", "disable", "disabled"];

/// Interpret an override's raw string, or `None` when it says nothing.
pub fn env_boolean(raw: Option<&str>) -> Option<bool> {
    let raw = raw?;
    if raw.is_empty() {
        return None;
    }
    let text = raw.trim().to_lowercase();
    if TRUTHY.contains(&text.as_str()) {
        return Some(true);
    }
    if FALSY.contains(&text.as_str()) {
        return Some(false);
    }
    None
}

/// Where to read the levels from. Every source is explicit so a caller can
/// resolve for a directory that is not the process's own.
pub struct ResolveOptions<'a> {
    pub root: &'a Path,
    pub observer_names: &'a [String],
    pub env: &'a BTreeMap<String, String>,
    pub home: &'a Path,
    /// Values a command-line flag supplied, keyed the same way as the config.
    pub flags: &'a ConfigValues,
}

/// The merged answer, the level that gave each key, and every scope that failed.
#[derive(Clone, Debug, Default)]
pub struct Resolved {
    pub values: ConfigValues,
    pub levels: BTreeMap<String, Level>,
    /// Every scope that failed to load, in load order. Never raised.
    pub errors: Vec<ConfigFailure>,
}

impl Resolved {
    /// One key's value, or `None` when no level answered it.
    pub fn get(&self, key: &str) -> Option<&ConfigValue> {
        self.values.get(key)
    }

    pub fn level_of(&self, key: &str) -> Option<Level> {
        self.levels.get(key).copied()
    }

    /// The error identifiers, in load order — what a report prints.
    pub fn error_codes(&self) -> Vec<&'static str> {
        self.errors.iter().map(|error| error.code).collect()
    }
}

/// Merge the levels into one answer per key. A failing scope contributes no keys
/// and one error: an invalid file must not half-apply, and must not stop the
/// caller either, because an observer with a broken config still has to run.
pub fn resolve_config(options: &ResolveOptions<'_>) -> Resolved {
    let mut resolved = Resolved::default();

    let assign = |source: &ConfigValues, level: Level, into: &mut Resolved| {
        for (key, value) in source.iter() {
            if key == SCHEMA_KEY {
                continue;
            }
            into.values.insert(key, value.clone());
            into.levels.insert(key.to_string(), level);
        }
    };

    match load_config_file(
        &user_config_path(options.home),
        options.observer_names,
        ConfigScope::UserConfig,
    ) {
        Ok(loaded) => assign(&loaded.values, Level::User, &mut resolved),
        Err(error) => resolved.errors.push(*error),
    }

    match load_config_file(
        &project_config_path(options.root),
        options.observer_names,
        ConfigScope::ProjectConfig,
    ) {
        Ok(loaded) => assign(&loaded.values, Level::Project, &mut resolved),
        Err(error) => resolved.errors.push(*error),
    }

    assign(options.flags, Level::Flag, &mut resolved);

    for (key, name) in ENV_OVERRIDES {
        let Some(override_) = env_boolean(options.env.get(*name).map(String::as_str)) else {
            continue;
        };
        resolved.values.insert(*key, override_);
        resolved.levels.insert((*key).to_string(), Level::Env);
    }

    resolved
}

/// One key's resolved value and the level that answered it, falling back to the
/// built-in default.
pub fn config_value(
    key: &str,
    fallback: &ConfigValue,
    options: &ResolveOptions<'_>,
) -> (ConfigValue, Level) {
    let resolved = resolve_config(options);
    match (resolved.values.get(key), resolved.level_of(key)) {
        (Some(value), Some(level)) => (value.clone(), level),
        _ => (fallback.clone(), Level::Default),
    }
}

/// The user's home directory, read the way the shells set it. Not `$HOME` on
/// Windows, where the user profile is the equivalent.
pub fn home_dir() -> Option<PathBuf> {
    for name in ["HOME", "USERPROFILE"] {
        if let Some(value) = std::env::var_os(name)
            && !value.is_empty()
        {
            return Some(PathBuf::from(value));
        }
    }
    None
}

/// The process environment as the map `ResolveOptions` takes.
pub fn process_env() -> BTreeMap<String, String> {
    std::env::vars().collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_override_reads_the_spellings_a_shell_exports() {
        for raw in ["1", "true", "TRUE", " yes ", "on", "enable", "enabled"] {
            assert_eq!(env_boolean(Some(raw)), Some(true), "{raw}");
        }
        for raw in ["0", "false", "no", "off", "disable", "disabled"] {
            assert_eq!(env_boolean(Some(raw)), Some(false), "{raw}");
        }
        // Nothing, empty and gibberish all say nothing rather than defaulting.
        for raw in [None, Some(""), Some("maybe"), Some("2")] {
            assert_eq!(env_boolean(raw), None, "{raw:?}");
        }
    }

    #[test]
    fn exactly_one_environment_name_outranks_a_committed_file() {
        assert_eq!(ENV_OVERRIDES, &[("tdd", "MEOWKIT_TDD")]);
    }
}
