//! Read one `config.yaml` and say exactly what is wrong with it, or hand back a
//! flat map of applied keys.
//!
//! Three stages, in this order, because each protects the next: the subset
//! parser refuses anything the hook reader could not also parse and yields the
//! values; the rules refuse a file that parses but says something a committed
//! file must not say; the shape check refuses it a second time against the
//! declared key surface. Nothing is applied partially — a rejected config
//! yields zero keys, never the ones that happened to come before the bad one.
use std::fs;
use std::path::{Path, PathBuf};

use super::config_rules::{ConfigScope, RuleError, apply_rules};
use super::config_values::ConfigValues;
use super::shape_check::{ShapeViolation, check_shape};
use super::yaml_grammar::{GrammarError, parse_config_subset};

/// `.meowkit/config.yaml`, the path relative to either root.
pub const CONFIG_REL: &str = ".meowkit/config.yaml";

/// Why one scope did not load. `key` is absent for a grammar failure, which is
/// about a line rather than a key, and `line` for a rule failure, which is about
/// a key rather than a line.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ConfigFailure {
    pub code: &'static str,
    pub key: Option<String>,
    pub line: Option<usize>,
    pub message: String,
    pub fix: String,
    pub file: PathBuf,
    pub scope: ConfigScope,
}

/// A loaded scope. `present` separates "no file" from "a file with no keys":
/// both apply zero keys, and only one of them is worth reporting.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct LoadedConfig {
    pub values: ConfigValues,
    pub present: bool,
}

/// `<root>/.meowkit/config.yaml`.
pub fn project_config_path(root: &Path) -> PathBuf {
    root.join(".meowkit").join("config.yaml")
}

/// `~/.meowkit/config.yaml` — outside any repository, except when the
/// repository is `$HOME`.
pub fn user_config_path(home: &Path) -> PathBuf {
    home.join(".meowkit").join("config.yaml")
}

fn from_grammar(error: GrammarError, file: &Path, scope: ConfigScope) -> Box<ConfigFailure> {
    Box::new(ConfigFailure {
        code: error.code,
        key: None,
        line: Some(error.line),
        message: format!("{}:{}: {}", file.display(), error.line, error.message),
        fix: "the config grammar is two levels of keys with boolean, whole-number or string values"
            .to_string(),
        file: file.to_path_buf(),
        scope,
    })
}

fn from_rule(error: RuleError, file: &Path, scope: ConfigScope) -> Box<ConfigFailure> {
    Box::new(ConfigFailure {
        code: error.code,
        key: Some(error.key),
        line: None,
        message: error.message,
        fix: error.fix,
        file: file.to_path_buf(),
        scope,
    })
}

fn from_shape(error: ShapeViolation, file: &Path, scope: ConfigScope) -> Box<ConfigFailure> {
    Box::new(ConfigFailure {
        code: "schema-violation",
        key: Some(error.key.clone()),
        line: None,
        message: format!("{}: {}: {}", file.display(), error.key, error.detail),
        fix: "check the key against the commented stubs the installer wrote".to_string(),
        file: file.to_path_buf(),
        scope,
    })
}

/// Load one config file. An absent file is success with no keys: a project
/// without a config is configured by its defaults, which is not an error.
pub fn load_config_file(
    file: &Path,
    observer_names: &[String],
    scope: ConfigScope,
) -> Result<LoadedConfig, Box<ConfigFailure>> {
    // Lossy, not strict: Node's `readFileSync(file, "utf8")` substitutes
    // replacement characters and goes on to report a GRAMMAR error on the line,
    // so a strict read here would have reported `unreadable` for a file the
    // hook reader describes by line. The memory scan reads lossily for the same
    // reason.
    let source = match fs::read(file).map(|bytes| String::from_utf8_lossy(&bytes).into_owned()) {
        Ok(source) => source,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => {
            return Ok(LoadedConfig::default());
        }
        Err(err) => {
            return Err(Box::new(ConfigFailure {
                code: "unreadable",
                key: None,
                line: None,
                message: format!("{} could not be read ({err})", file.display()),
                fix: "check the file's permissions".to_string(),
                file: file.to_path_buf(),
                scope,
            }));
        }
    };

    let values = parse_config_subset(&source).map_err(|error| from_grammar(error, file, scope))?;

    apply_rules(&values, observer_names, scope).map_err(|error| from_rule(*error, file, scope))?;

    // The declared surface is the shape of record; the rules above are what
    // produces a message naming one key. Running both means a shape the rules
    // somehow let through is still refused rather than applied — the comment
    // `load-config.ts:118-120` carries, and the reason the layer is still here.
    check_shape(&values, observer_names, scope).map_err(|error| from_shape(error, file, scope))?;

    Ok(LoadedConfig {
        values,
        present: true,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_absent_file_applies_no_keys_and_is_not_an_error() {
        let loaded = load_config_file(
            Path::new("/nonexistent/.meowkit/config.yaml"),
            &[],
            ConfigScope::ProjectConfig,
        )
        .expect("an absent file is not an error");
        assert!(!loaded.present);
        assert!(loaded.values.is_empty());
    }

    #[test]
    fn the_relative_path_is_the_one_both_scopes_use() {
        let project = project_config_path(Path::new("/repo"));
        assert!(project.ends_with(CONFIG_REL), "{}", project.display());
        let user = user_config_path(Path::new("/home/dev"));
        assert!(user.ends_with(CONFIG_REL), "{}", user.display());
    }
}
