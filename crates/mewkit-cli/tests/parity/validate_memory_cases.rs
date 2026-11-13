//! `validate --memory` against both CLIs: the lint a ship boundary runs.
//!
//! The pre-ship guard spawns this invocation and turns a non-zero exit into a
//! BLOCK, so the rows AND the code are what that guard parses. Both verdicts
//! are compared: a lint that failed everything would satisfy the poisoned case
//! alone, and one that failed nothing would satisfy the clean case alone.
use crate::parity;

/// A store carrying instruction-like text must fail the lint. This is the case
/// the pre-ship guard exists for: memory is read back as DATA by every read-set
/// skill, and the store is committed.
#[test]
#[ignore = "needs node and the TS build"]
fn a_memory_store_with_an_injection_entry_fails() {
    let Some((ts, _)) = parity::case("validate-memory-poisoned")
        .fixture("validate-memory-poisoned")
        .args(&["validate", "--memory"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stdout.contains("[FAIL] Memory injection:")
            && ts.stdout.contains("instruction-like text"),
        "the fixture stopped exercising the injection scan: {}",
        ts.describe()
    );
}

/// The control: a clean store passes as ONE row, and exits 0. Without this case
/// the failing one above could pass while the lint failed on everything.
#[test]
#[ignore = "needs node and the TS build"]
fn a_clean_memory_store_passes() {
    let Some((ts, _)) = parity::case("validate-memory-clean")
        .fixture("validate-memory-clean")
        .args(&["validate", "--memory"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(
        ts.stdout.contains("[PASS] Team memory store lint"),
        "{}",
        ts.describe()
    );
}

/// `--memory` runs independently of any provider directory: the Codex and
/// Cursor bundles have no `.claude/`, and both instruct the user to run it.
#[test]
#[ignore = "needs node and the TS build"]
fn the_memory_lint_needs_no_provider_directory() {
    let Some((ts, _)) = parity::case("validate-memory-without-claude")
        .fixture("validate-memory-poisoned")
        .args(&["validate", "--memory"])
        .run()
    else {
        return;
    };
    assert!(
        !ts.stderr.contains("Could not find .claude/"),
        "the lint must not be gated behind the provider lookup: {}",
        ts.describe()
    );
}
