//! `validate` with no scoping flag: the whole consumer run, both verdicts.
//!
//! The default run is what a user types, so these cases compare the full
//! report — every section heading, every row, the summary line and the exit
//! code — against the npm CLI on the same fixture.
use crate::parity;

/// A HEALTHY consumer install, reported row for row: both CLIs agree on every
/// section, every status and the summary, and the run exits 0.
///
/// The fixture's hooks arrive executable because the harness carries a fixture
/// file's mode, which is what lets a fixture express a healthy install at all;
/// `a_broken_install_fails_on_each_row_that_is_broken` is the fixture that
/// drops the bit on purpose.
#[test]
#[ignore = "needs node and the TS build"]
fn a_consumer_install_is_reported_row_for_row() {
    let Some((ts, _)) = parity::case("validate-flat-copy")
        .fixture("validate-flat-copy")
        .args(&["validate"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    // Agreement on an empty report would pass the comparison while proving
    // nothing, so the fixture is held to exercising each section.
    for expected in ["Structure", "Hooks", "Docs", "Plugin", "Memory"] {
        assert!(
            ts.stdout.contains(expected),
            "the fixture stopped producing a {expected} section: {}",
            ts.describe()
        );
    }
    for expected in [
        "flat-copy (auto-detected)",
        "[PASS] File exists: rules/injection-rules.md",
        "[WARN] Project config valid",
        "[PASS] Hook executable: pre-ship.cjs",
        "[PASS] Team memory store lint",
    ] {
        assert!(
            ts.stdout.contains(expected),
            "the fixture stopped producing {expected:?}: {}",
            ts.describe()
        );
    }
}

/// An explicit `--mode` is reported as an override, not as a detection.
#[test]
#[ignore = "needs node and the TS build"]
fn an_explicit_mode_is_labelled_as_an_override() {
    let Some((ts, _)) = parity::case("validate-mode-override")
        .fixture("validate-flat-copy")
        .args(&["validate", "--mode", "flat-copy"])
        .run()
    else {
        return;
    };
    assert!(
        ts.stdout.contains("flat-copy (override)"),
        "the override label is part of the contract: {}",
        ts.describe()
    );
}

/// Missing directories, missing always-on rules, a hook without its execute
/// bit, a leaked skill name and an unresolvable `subagent_type` — one fixture
/// that exercises every FAIL row of the consumer run at once.
#[test]
#[ignore = "needs node and the TS build"]
fn a_broken_install_fails_on_each_row_that_is_broken() {
    let Some((ts, _)) = parity::case("validate-broken-install")
        .fixture("validate-broken-install")
        .args(&["validate"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    for expected in [
        "[FAIL] Directory exists: agents",
        "[FAIL] File exists: rules/development-rules.md",
        "[FAIL] Hook executable: pre-ship.cjs",
        "[FAIL] Skill names are mk:-scoped",
        "[WARN] subagent_type refs resolve",
    ] {
        assert!(
            ts.stdout.contains(expected),
            "the fixture stopped producing {expected:?}: {}",
            ts.describe()
        );
    }
}

/// No provider directory at all: the message names what it looked for, and the
/// run exits 1 rather than reporting a vacuous pass.
#[test]
#[ignore = "needs node and the TS build"]
fn a_project_without_a_provider_directory_is_reported_not_passed() {
    let Some((ts, _)) = parity::case("validate-no-provider-dir")
        .fixture("validate-empty")
        .args(&["validate"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stderr
            .contains("Could not find .claude/ directory in the current directory."),
        "{}",
        ts.describe()
    );
}

/// A maintainer contract present, with one reference off the allowlist and one
/// on the reserved list: the default run reports both, and fails for the error.
#[test]
#[ignore = "needs node and the TS build"]
fn an_unlisted_docs_reference_fails_the_default_run() {
    let Some((ts, _)) = parity::case("validate-docs-refs-default")
        .fixture("validate-docs-refs")
        .args(&["validate"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stdout.contains("docs/maintainer/secret-plan.md"),
        "the fixture stopped exercising the allowlist: {}",
        ts.describe()
    );
}
