//! The file `init` writes: a commented stub per key, one live schema pointer,
//! and no key the surface does not have.
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use super::*;
use crate::config::config_rules::ConfigScope;
use crate::config::config_values::ConfigValue;
use crate::config::load_config::load_config_file;
use crate::config::observer_names::observer_names;
use crate::config::schema::known_keys;

fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("..").join("..")
}

fn names() -> Vec<String> {
    observer_names(&repo_root())
}

fn body(chosen: &[(&str, &str)]) -> String {
    let map: BTreeMap<String, String> = chosen
        .iter()
        .map(|(key, value)| ((*key).to_string(), (*value).to_string()))
        .collect();
    render_config_stub(&names(), &map)
}

fn live_lines(body: &str) -> Vec<String> {
    body.lines()
        .filter(|line| !line.trim().is_empty() && !line.starts_with('#'))
        .map(str::to_string)
        .collect()
}

#[test]
fn the_schema_pointer_is_the_one_live_line() {
    assert_eq!(
        live_lines(&body(&[])),
        vec![format!("$schema: {SCHEMA_URL}")]
    );
}

#[test]
fn every_surface_key_has_a_stub_and_nothing_else_does() {
    let body = body(&[]);
    let mut stubbed: Vec<String> = Vec::new();
    let mut group = String::new();
    for raw in body.lines().filter(|line| !line.trim().is_empty()) {
        let line = raw.strip_prefix('#').unwrap_or(raw);
        // An explanation line, not a stub.
        if line.trim_start().starts_with('#') {
            continue;
        }
        let Some((head, rest)) = line.split_once(':') else {
            continue;
        };
        let indent = &head[..head.len() - head.trim_start().len()];
        let key = head.trim();
        // Prose above a stub also holds a colon; only a key-shaped left side is
        // a declaration.
        if key != "$schema" && !crate::config::scalar_spelling::is_key_shaped(key) {
            continue;
        }
        if indent.is_empty() && rest.trim().is_empty() {
            group = key.to_string();
            continue;
        }
        if key == "$schema" {
            continue;
        }
        stubbed.push(if indent.is_empty() {
            key.to_string()
        } else {
            format!("{group}.{key}")
        });
    }
    stubbed.sort();
    let mut expected: Vec<String> = known_keys(&names())
        .into_iter()
        .map(|(key, _)| key)
        .collect();
    expected.sort();
    assert_eq!(stubbed, expected);
}

#[test]
fn no_key_without_a_reader_is_declared() {
    let body = body(&[]);
    assert!(!body.contains("pm.auto"));
    assert!(
        !body
            .lines()
            .any(|line| line.trim_start_matches('#').trim_start().starts_with("pm:"))
    );
}

/// The stub is the kit's own instruction to the user about a brake on spending,
/// and the only code that reads these three keys is the budget tracker. So the
/// numbers the stub ships are asserted against that handler's literal defaults
/// rather than against a second copy of them here.
mod budget {
    use super::*;

    fn tracker() -> String {
        std::fs::read_to_string(repo_root().join(".claude/hooks/handlers/budget-tracker.cjs"))
            .expect("the budget tracker handler")
    }

    /// The default the tracker falls back to for `budget.<leaf>`, read out of
    /// the handler's own source: `values['budget.warn'] !== undefined ? … : 30`.
    fn default_of(source: &str, leaf: &str) -> i64 {
        let needle = format!("values['budget.{leaf}']");
        let at = source
            .find(&needle)
            .unwrap_or_else(|| panic!("no default for budget.{leaf} in the tracker"));
        let tail = &source[at + needle.len()..];
        let statement = &tail[..tail.find(';').unwrap_or(tail.len())];
        let colon = statement
            .rfind(':')
            .unwrap_or_else(|| panic!("no fallback for budget.{leaf}"));
        statement[colon + 1..]
            .trim()
            .trim_end_matches([')', ' '])
            .parse()
            .unwrap_or_else(|_| panic!("the fallback for budget.{leaf} is not a number"))
    }

    fn stub_value(body: &str, leaf: &str) -> i64 {
        let prefix = format!("#  {leaf}: ");
        body.lines()
            .find_map(|line| line.strip_prefix(&prefix))
            .unwrap_or_else(|| panic!("no budget.{leaf} stub line"))
            .trim()
            .parse()
            .unwrap_or_else(|_| panic!("the budget.{leaf} stub is not a number"))
    }

    #[test]
    fn the_stub_ships_the_trackers_own_warn_and_block_thresholds() {
        let tracker = tracker();
        let body = body(&[]);
        assert_eq!(stub_value(&body, "warn"), default_of(&tracker, "warn"));
        assert_eq!(stub_value(&body, "block"), default_of(&tracker, "block"));
        // The documented pair, in USD: a warning at 30, a hard block at 100.
        assert_eq!(stub_value(&body, "warn"), 30);
        assert_eq!(stub_value(&body, "block"), 100);
    }

    #[test]
    fn the_shipped_cap_never_raises_the_hard_block() {
        let body = body(&[]);
        assert!(stub_value(&body, "cap") <= stub_value(&body, "block"));
    }

    #[test]
    fn the_tracker_compares_the_three_in_usd() {
        assert!(tracker().contains("in USD"));
        for key in ["budget.cap", "budget.warn", "budget.block"] {
            let doc = crate::config::schema::key_doc(key).expect(key);
            assert!(doc.contains("USD"), "{key}: {doc}");
        }
    }
}

#[test]
fn the_stub_loads_cleanly_so_a_new_project_is_not_born_misconfigured() {
    let dir = tempfile::tempdir().expect("a temporary directory");
    let file = dir.path().join("config.yaml");
    std::fs::write(&file, body(&[])).expect("the stub");
    let loaded = load_config_file(&file, &names(), ConfigScope::ProjectConfig)
        .expect("the stub the installer writes must load");
    // Its one live line is the schema pointer, so no preference is applied.
    assert_eq!(loaded.values.sorted_keys(), vec!["$schema"]);
}

#[test]
fn a_migrated_value_is_uncommented_and_opens_its_parent() {
    let body = body(&[("hooks.budget-tracker", "false"), ("budget.cap", "123")]);
    for expected in [
        "budget:",
        "  cap: 123",
        "hooks:",
        "  budget-tracker: false",
        "#  warn: 30",
        "#  learning-observer: false",
    ] {
        assert!(
            body.lines().any(|line| line == expected),
            "missing line {expected:?} in:\n{body}"
        );
    }
}

#[test]
fn a_migrated_stub_is_accepted_with_those_values_applied() {
    let dir = tempfile::tempdir().expect("a temporary directory");
    let file = dir.path().join("config.yaml");
    std::fs::write(
        &file,
        body(&[("hooks.budget-tracker", "false"), ("budget.cap", "123")]),
    )
    .expect("the stub");
    let loaded = load_config_file(&file, &names(), ConfigScope::ProjectConfig)
        .expect("a migrated stub must load");
    assert_eq!(
        loaded.values.get("budget.cap"),
        Some(&ConfigValue::Int(123))
    );
    assert_eq!(
        loaded.values.get("hooks.budget-tracker"),
        Some(&ConfigValue::Bool(false))
    );
}
