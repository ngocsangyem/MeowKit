//! The two config readers cannot disagree.
//!
//! There are two on purpose: this crate, and a hook that has no dependencies at
//! all and parses the file by hand. Two parsers for one file is a divergence
//! waiting to happen, and the session where it happens is a fresh clone with a
//! gate about to fire — so the proof is not "both look right" but the committed
//! corpus fed to both, compared verdict for verdict and key for key.
//!
//! The hook side is the shipped `.cjs` itself, run as it runs in a session.
//!
//! When Node is not installed the comparison cannot be made, and this test
//! FAILS. It used to print a skip notice and return, which `cargo test`
//! swallows without `--nocapture`: a CI leg without Node went green while the
//! comparison never ran, which is the one outcome a cross-reader test must not
//! have. Set `MEWKIT_SKIP_NODE_PARITY=1` to opt out deliberately — the opt-out
//! is explicit, named in the failure message, and visible in the CI
//! configuration that uses it.
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use mewkit_core::config::{
    ConfigScope, ConfigValue, apply_rules, check_shape, parse_config_subset,
};

/// Reads one fixture with the shipped hook reader and its hook-side rules, and
/// prints the verdict as JSON. The same two entry points a session uses.
const PROBE: &str = r#"
'use strict';
const path = require('node:path');
const fs = require('node:fs');
const root = process.argv[2];
const file = process.argv[3];
const { parseYamlSubset } = require(path.join(root, '.claude/hooks/lib/yaml-subset.cjs'));
const { applyRules } = require(path.join(root, '.claude/hooks/lib/config-rules.cjs'));
const source = fs.readFileSync(file, 'utf8');
const parsed = parseYamlSubset(source);
if (!parsed.ok) {
  process.stdout.write(JSON.stringify({ ok: false, code: parsed.error.code }));
  process.exit(0);
}
const ruled = applyRules(parsed.values, { root, scope: 'project config' });
if (!ruled.ok) {
  process.stdout.write(JSON.stringify({ ok: false, code: ruled.error.code }));
  process.exit(0);
}
process.stdout.write(JSON.stringify({ ok: true, values: ruled.values }));
"#;

fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("..").join("..")
}

fn fixtures_dir() -> PathBuf {
    repo_root().join("tests").join("config").join("fixtures")
}

fn node_available() -> bool {
    Command::new("node")
        .arg("--version")
        .output()
        .is_ok_and(|out| out.status.success())
}

/// Every fixture committed at review time. A fixture may be ADDED without
/// touching this number; losing one is a corpus regression.
const EXPECTED_FIXTURES: usize = 58;

/// The explicit opt-out. Any value other than `0`/`false`/empty counts.
const SKIP_ENV: &str = "MEWKIT_SKIP_NODE_PARITY";

fn skip_requested() -> bool {
    env::var(SKIP_ENV).is_ok_and(|value| !matches!(value.as_str(), "" | "0" | "false"))
}

#[derive(Debug, PartialEq)]
enum Verdict {
    Rejected(String),
    Applied(Vec<(String, ConfigValue)>),
}

fn rust_verdict(source: &str, observer_names: &[String]) -> Verdict {
    let values = match parse_config_subset(source) {
        Ok(values) => values,
        Err(error) => return Verdict::Rejected(error.code.to_string()),
    };
    if let Err(error) = apply_rules(&values, observer_names, ConfigScope::ProjectConfig) {
        return Verdict::Rejected(error.code.to_string());
    }
    // The whole Rust pipeline, not two thirds of it: the shape layer runs in
    // `load_config_file`, so a fixture it refused and the hook accepted would be
    // a divergence this test exists to find.
    if check_shape(&values, observer_names, ConfigScope::ProjectConfig).is_err() {
        return Verdict::Rejected("schema-violation".to_string());
    }
    let mut applied: Vec<(String, ConfigValue)> = values
        .iter()
        .map(|(key, value)| (key.to_string(), value.clone()))
        .collect();
    applied.sort_by(|left, right| left.0.cmp(&right.0));
    Verdict::Applied(applied)
}

/// A double the `i64` the Rust reader stores cannot represent, clamped the same
/// way that reader clamps it.
fn saturate(value: f64) -> i64 {
    if value >= 0.0 { i64::MAX } else { i64::MIN }
}

fn hook_verdict(probe: &Path, file: &Path) -> Verdict {
    let output = Command::new("node")
        .arg(probe)
        .arg(repo_root())
        .arg(file)
        .output()
        .expect("the hook reader runs");
    assert!(
        output.status.success(),
        "the hook probe failed on {}: {}",
        file.display(),
        String::from_utf8_lossy(&output.stderr)
    );
    let parsed: serde_json::Value =
        serde_json::from_slice(&output.stdout).expect("the probe prints JSON");
    if parsed["ok"] == serde_json::json!(false) {
        return Verdict::Rejected(parsed["code"].as_str().unwrap_or_default().to_string());
    }
    let mut applied: Vec<(String, ConfigValue)> = parsed["values"]
        .as_object()
        .expect("a map of values")
        .iter()
        .map(|(key, value)| {
            let value = match value {
                serde_json::Value::Bool(flag) => ConfigValue::Bool(*flag),
                // `Number.parseInt` is lossy above 2^53, so a huge literal
                // arrives as a double. Saturating matches what the Rust reader
                // stores for the same input; a panic here would report a crash
                // where a disagreement is the finding.
                serde_json::Value::Number(number) => ConfigValue::Int(
                    number
                        .as_i64()
                        .or_else(|| number.as_f64().map(saturate))
                        .unwrap_or(i64::MAX),
                ),
                serde_json::Value::String(text) => ConfigValue::Str(text.clone()),
                other => panic!("the hook reader produced {other:?}, which is not a config scalar"),
            };
            (key.clone(), value)
        })
        .collect();
    applied.sort_by(|left, right| left.0.cmp(&right.0));
    Verdict::Applied(applied)
}

#[test]
fn the_hook_reader_and_this_crate_agree_on_every_fixture() {
    if skip_requested() {
        eprintln!("{SKIP_ENV} is set: the hook reader was not run");
        return;
    }
    assert!(
        node_available(),
        "node is not installed, so the hook reader cannot be run and the two \
         readers were NOT compared. Install node, or set {SKIP_ENV}=1 to accept \
         that this leg proves nothing."
    );
    let probe_dir = tempfile::tempdir().expect("a temporary directory");
    let probe = probe_dir.path().join("probe.cjs");
    fs::write(&probe, PROBE).expect("the probe");

    let observer_names = mewkit_core::config::observer_names(&repo_root());
    let mut files: Vec<PathBuf> = fs::read_dir(fixtures_dir())
        .expect("the committed fixture corpus")
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .filter(|path| path.extension().is_some_and(|ext| ext == "yaml"))
        .collect();
    files.sort();
    // The real floor. `>= 12` passed while 46 of the 58 fixtures went missing.
    assert!(
        files.len() >= EXPECTED_FIXTURES,
        "the corpus shrank to {} fixtures, below the {EXPECTED_FIXTURES} committed",
        files.len()
    );

    for file in files {
        let source = fs::read_to_string(&file).expect("a fixture");
        let name = file.file_name().unwrap_or_default().to_string_lossy();
        // Structural, not stringified: two shapes that print alike can still
        // differ in a value's type, which is exactly the divergence that would
        // matter.
        assert_eq!(
            rust_verdict(&source, &observer_names),
            hook_verdict(&probe, &file),
            "{name}: the readers disagree"
        );
    }
}
