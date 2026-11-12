//! Which level answers a key, and what a broken scope does to the others.
//!
//!   environment override > CLI flag > project config > user config > default
//!
//! The order is asserted by raising one level at a time over the same key, so a
//! reordering shows up as the wrong level rather than as a value that happens to
//! match. The environment sits at the top for exactly one key: `MEOWKIT_TDD` is
//! one of only two sources that can turn strict test-first mode ON, and a
//! committed `tdd: false` must not be able to switch an enforcement mode off for
//! everyone.
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use mewkit_core::config::{
    ConfigValue, ConfigValues, Level, ResolveOptions, config_value, observer_names,
    project_config_path, resolve_config,
};

fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("..").join("..")
}

fn names() -> Vec<String> {
    observer_names(&repo_root())
}

struct Project {
    dir: tempfile::TempDir,
    home: tempfile::TempDir,
}

impl Project {
    fn new() -> Self {
        Self {
            dir: tempfile::tempdir().expect("a project directory"),
            home: tempfile::tempdir().expect("a home directory"),
        }
    }

    fn write(dir: &Path, body: &str) {
        let file = dir.join(".meowkit").join("config.yaml");
        fs::create_dir_all(file.parent().expect("a parent")).expect("the config directory");
        fs::write(file, body).expect("the config file");
    }

    fn project_config(&self, body: &str) -> &Self {
        Self::write(self.dir.path(), body);
        self
    }

    fn user_config(&self, body: &str) -> &Self {
        Self::write(self.home.path(), body);
        self
    }

    fn resolve(
        &self,
        env: &[(&str, &str)],
        flags: &[(&str, ConfigValue)],
    ) -> mewkit_core::config::Resolved {
        let env: BTreeMap<String, String> = env
            .iter()
            .map(|(key, value)| ((*key).to_string(), (*value).to_string()))
            .collect();
        let flags: ConfigValues = flags
            .iter()
            .map(|(key, value)| ((*key).to_string(), value.clone()))
            .collect();
        resolve_config(&ResolveOptions {
            root: self.dir.path(),
            observer_names: &names(),
            env: &env,
            home: self.home.path(),
            flags: &flags,
        })
    }
}

#[test]
fn nothing_anywhere_leaves_every_key_to_its_default() {
    let project = Project::new();
    let resolved = project.resolve(&[], &[]);
    assert!(resolved.values.is_empty());
    assert!(resolved.errors.is_empty());
    assert_eq!(resolved.level_of("tdd"), None);
}

#[test]
fn the_levels_answer_in_order_env_then_flag_then_project_then_user() {
    let project = Project::new();
    project.user_config("tdd: false\n");
    assert_eq!(
        project.resolve(&[], &[]).level_of("tdd"),
        Some(Level::User),
        "the user file is the only level with a value"
    );

    project.project_config("tdd: false\n");
    assert_eq!(
        project.resolve(&[], &[]).level_of("tdd"),
        Some(Level::Project)
    );

    let flagged = project.resolve(&[], &[("tdd", ConfigValue::Bool(false))]);
    assert_eq!(flagged.level_of("tdd"), Some(Level::Flag));

    // One environment name outranks a committed file, because a pull request
    // must not be able to switch strict test-first mode off for everyone.
    let overridden = project.resolve(
        &[("MEOWKIT_TDD", "1")],
        &[("tdd", ConfigValue::Bool(false))],
    );
    assert_eq!(overridden.level_of("tdd"), Some(Level::Env));
    assert_eq!(overridden.get("tdd"), Some(&ConfigValue::Bool(true)));
}

#[test]
fn a_project_key_overrides_the_user_key_and_keeps_the_rest() {
    let project = Project::new();
    project.user_config("tdd: true\nbudget:\n  cap: 5\n");
    project.project_config("budget:\n  cap: 9\n");
    let resolved = project.resolve(&[], &[]);
    assert_eq!(resolved.get("budget.cap"), Some(&ConfigValue::Int(9)));
    assert_eq!(resolved.level_of("budget.cap"), Some(Level::Project));
    assert_eq!(resolved.get("tdd"), Some(&ConfigValue::Bool(true)));
    assert_eq!(resolved.level_of("tdd"), Some(Level::User));
}

#[test]
fn the_schema_pointer_is_never_a_resolved_value() {
    let project = Project::new();
    project.project_config("$schema: https://meowkit.dev/schemas/config-v1.json\ntdd: true\n");
    let resolved = project.resolve(&[], &[]);
    assert_eq!(resolved.get("$schema"), None);
    assert_eq!(resolved.get("tdd"), Some(&ConfigValue::Bool(true)));
}

#[test]
fn an_environment_name_that_says_nothing_changes_nothing() {
    let project = Project::new();
    project.project_config("tdd: true\n");
    for raw in ["", "maybe", "2"] {
        let resolved = project.resolve(&[("MEOWKIT_TDD", raw)], &[]);
        assert_eq!(
            resolved.level_of("tdd"),
            Some(Level::Project),
            "MEOWKIT_TDD={raw:?} answered for the file"
        );
    }
}

#[test]
fn a_broken_scope_contributes_one_error_and_no_keys_and_stops_nobody() {
    let project = Project::new();
    project.user_config("tdd: true\n");
    project.project_config("tdd: true\nsparkles: true\n");
    let resolved = project.resolve(&[], &[]);
    assert_eq!(resolved.error_codes(), vec!["unknown-key"]);
    // The user file still applied: one invalid scope must not disable the other.
    assert_eq!(resolved.level_of("tdd"), Some(Level::User));
    // And nothing from the rejected file applied, not even the key before the
    // bad one.
    assert_eq!(resolved.values.len(), 1);
}

#[test]
fn both_scopes_broken_reports_both_in_load_order() {
    let project = Project::new();
    project.user_config("tdd: True\n");
    project.project_config("sparkles: true\n");
    let resolved = project.resolve(&[], &[]);
    assert_eq!(
        resolved.error_codes(),
        vec!["bad-boolean-spelling", "unknown-key"]
    );
    assert!(resolved.values.is_empty());
}

#[test]
fn one_key_reports_its_value_and_the_level_that_answered_it() {
    let project = Project::new();
    let env: BTreeMap<String, String> = BTreeMap::new();
    let flags = ConfigValues::new();
    let options = ResolveOptions {
        root: project.dir.path(),
        observer_names: &names(),
        env: &env,
        home: project.home.path(),
        flags: &flags,
    };
    let fallback = ConfigValue::Int(100);

    // No file anywhere: the fallback answers, and the level says so — a user
    // asking "why is this 100?" is asking which file to edit, and "default"
    // is the answer that means "none of them yet".
    assert_eq!(
        config_value("budget.block", &fallback, &options),
        (ConfigValue::Int(100), Level::Default)
    );

    project.project_config("budget:\n  block: 42\n");
    assert_eq!(
        config_value("budget.block", &fallback, &options),
        (ConfigValue::Int(42), Level::Project)
    );
}

/// Two spellings, one symptom: a value a full parser resolves to a boolean and a
/// hand reader keeps as text. Each had strict test-first mode reported ON by the
/// CLI and enforced as OFF by the gate, with no error anywhere — so both are
/// driven end to end through the resolver rather than through the grammar alone.
#[test]
fn a_spelling_the_gate_cannot_read_resolves_to_no_value_at_all() {
    for (source, code, phrase) in [
        ("tdd: True\n", "bad-boolean-spelling", "lower case"),
        ("tdd: !!bool true\n", "tag-not-supported", "plain value"),
    ] {
        let project = Project::new();
        project.project_config(source);
        let resolved = project.resolve(&[], &[]);
        assert_eq!(
            resolved.get("tdd"),
            None,
            "{source:?} resolved a value the gate does not see"
        );
        assert_eq!(resolved.error_codes(), vec![code], "{source:?}");
        assert!(
            resolved.errors[0].message.contains(phrase),
            "{source:?}: {}",
            resolved.errors[0].message
        );
    }
}

#[test]
fn the_project_config_is_read_from_the_path_the_hooks_read() {
    let project = Project::new();
    project.project_config("tdd: true\n");
    let path = project_config_path(project.dir.path());
    assert!(path.exists(), "{}", path.display());
    assert!(path.ends_with(".meowkit/config.yaml"), "{}", path.display());
}
