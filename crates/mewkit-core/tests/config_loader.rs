//! The committed fixture corpus, read by the Rust loader.
//!
//! `tests/config/fixtures/*.yaml` at the repository root is ONE corpus, shared
//! by three readers: the hook's hand reader, the TypeScript CLI and this crate.
//! The fixtures are read from that path rather than copied here, because a
//! second copy is a second corpus, and the divergence a corpus exists to catch
//! would then hide between them.
//!
//! A fixture is named for what it asserts: `accept-` parses and applies,
//! `grammar-` is outside the subset, `reject-` parses but says something a
//! committed file must not say.
use std::fs;
use std::path::{Path, PathBuf};

use mewkit_core::config::{ConfigScope, ConfigValue, load_config_file, observer_names};

#[path = "support/config_corpus.rs"]
mod config_corpus;
use config_corpus::{REJECTED, accepted};

fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("..").join("..")
}

fn fixtures_dir() -> PathBuf {
    repo_root().join("tests").join("config").join("fixtures")
}

fn names() -> Vec<String> {
    observer_names(&repo_root())
}

fn fixture_files() -> Vec<String> {
    let mut files: Vec<String> = fs::read_dir(fixtures_dir())
        .expect("the committed fixture corpus")
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.file_name().to_string_lossy().to_string())
        .filter(|name| name.ends_with(".yaml"))
        .collect();
    files.sort();
    files
}

#[test]
fn the_corpus_covers_every_grammar_and_rejection_class() {
    let files = fixture_files();
    // The real floor: `>= 12` stayed green with 46 of the 58 fixtures deleted.
    // A fixture may be ADDED without touching this number.
    assert!(
        files.len() >= 58,
        "the corpus shrank to {} fixtures, below the 58 committed",
        files.len()
    );
    for prefix in ["accept-", "grammar-", "reject-"] {
        assert!(
            files.iter().any(|name| name.starts_with(prefix)),
            "no {prefix} fixture"
        );
    }
}

#[test]
fn every_fixture_on_disk_has_a_declared_verdict() {
    let declared: Vec<&str> = REJECTED
        .iter()
        .map(|(file, _)| *file)
        .chain(accepted().iter().map(|(file, _)| *file))
        .collect();
    let undeclared: Vec<String> = fixture_files()
        .into_iter()
        .filter(|file| !declared.contains(&file.as_str()))
        .collect();
    assert!(
        undeclared.is_empty(),
        "fixtures with no declared verdict: {undeclared:?}"
    );
}

#[test]
fn every_declared_verdict_names_a_fixture_that_exists() {
    let files = fixture_files();
    let missing: Vec<&str> = REJECTED
        .iter()
        .map(|(file, _)| *file)
        .chain(accepted().iter().map(|(file, _)| *file))
        .filter(|file| !files.iter().any(|name| name == file))
        .collect();
    assert!(
        missing.is_empty(),
        "verdicts naming no fixture: {missing:?}"
    );
}

#[test]
fn the_loader_rejects_what_a_committed_config_must_not_say() {
    let names = names();
    for (file, code) in REJECTED {
        let error = load_config_file(
            &fixtures_dir().join(file),
            &names,
            ConfigScope::ProjectConfig,
        )
        .err()
        .unwrap_or_else(|| panic!("{file} was accepted"));
        assert_eq!(error.code, *code, "{file} fired the wrong rule");
    }
}

#[test]
fn an_accepted_fixture_applies_exactly_its_own_keys() {
    let names = names();
    for (file, expected) in accepted() {
        let loaded = load_config_file(
            &fixtures_dir().join(file),
            &names,
            ConfigScope::ProjectConfig,
        )
        .unwrap_or_else(|error| panic!("{file} was rejected: {}", error.message));
        assert!(loaded.present, "{file}");
        let applied: Vec<(&str, ConfigValue)> = loaded
            .values
            .iter()
            .map(|(key, value)| (key, value.clone()))
            .collect();
        assert_eq!(applied, expected, "{file} applied the wrong keys");
    }
}

#[test]
fn a_grammar_failure_names_the_file_and_the_line() {
    let file = fixtures_dir().join("grammar-tab.yaml");
    let error = load_config_file(&file, &names(), ConfigScope::ProjectConfig).expect_err("a tab");
    assert_eq!(error.line, Some(2));
    assert!(
        error.message.contains("grammar-tab.yaml:2"),
        "{}",
        error.message
    );
    assert_eq!(error.file, file);
}

#[test]
fn a_protected_hook_says_which_hook_and_why() {
    let error = load_config_file(
        &fixtures_dir().join("reject-protected-gate2-check.yaml"),
        &names(),
        ConfigScope::ProjectConfig,
    )
    .expect_err("a protected hook");
    assert!(error.message.contains("gate2-check"), "{}", error.message);
    assert!(error.message.contains("Gate 2"), "{}", error.message);
    assert!(error.fix.contains("not a preference"), "{}", error.fix);
}

#[test]
fn a_rejected_key_names_the_scope_it_came_from() {
    for scope in [ConfigScope::ProjectConfig, ConfigScope::UserConfig] {
        let error = load_config_file(
            &fixtures_dir().join("reject-unknown-key.yaml"),
            &names(),
            scope,
        )
        .expect_err("an unknown key");
        assert!(error.message.contains(scope.as_str()), "{}", error.message);
        assert_eq!(error.scope, scope);
    }
}

#[test]
fn the_gate_one_hatch_key_is_accepted_in_the_user_file_only() {
    let file = fixtures_dir().join("reject-user-scope-only.yaml");
    assert!(load_config_file(&file, &names(), ConfigScope::UserConfig).is_ok());
    assert!(load_config_file(&file, &names(), ConfigScope::ProjectConfig).is_err());
}

#[test]
fn no_message_prints_a_stack_trace_or_a_parser_class_name() {
    let names = names();
    for (file, _) in REJECTED {
        let Err(error) = load_config_file(
            &fixtures_dir().join(file),
            &names,
            ConfigScope::ProjectConfig,
        ) else {
            continue;
        };
        let text = format!("{} {}", error.message, error.fix);
        for noise in ["YAMLException", "panicked at", "ScanError", "backtrace"] {
            assert!(!text.contains(noise), "{file}: {text}");
        }
    }
}
