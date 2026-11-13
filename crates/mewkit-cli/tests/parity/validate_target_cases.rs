//! `validate --target <provider> [dir]`: the generated-project profiles.
//!
//! A generated target has no `.claude/`, so these runs take the path that
//! bypasses that lookup and validate the target's OWN artifacts. Both verdicts
//! are compared for Codex, because a profile that failed everything would
//! satisfy the broken case alone.
use crate::parity;

#[test]
#[ignore = "needs node and the TS build"]
fn a_correct_codex_target_passes_every_row() {
    let Some((ts, _)) = parity::case("validate-target-codex")
        .fixture("validate-target-codex")
        .args(&["validate", "--target", "codex"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    for expected in [
        "[PASS] Codex AGENTS.md present",
        "[PASS] Codex config.toml parses",
        "[PASS] Codex config.toml agent refs",
        "[PASS] Codex config.toml secret-free",
        "[PASS] Codex hooks.json parses",
        "[PASS] Codex hook wrappers exist + executable",
        "[PASS] Codex hook deny contract",
        "[PASS] Codex agent name uniqueness",
        "[PASS] Codex root reference graph",
        "[PASS] Codex exec-policy rules valid",
        "[PASS] Codex installed skills parse",
        "[PASS] Codex no native memory surface",
    ] {
        assert!(
            ts.stdout.contains(expected),
            "the fixture stopped producing {expected:?}: {}",
            ts.describe()
        );
    }
}

/// The same profile over a target carrying one defect per row: a dangling agent
/// ref, a secret-like key with a value, a missing hook wrapper, a duplicate
/// agent name, a nameless agent, an invalid exec-policy decision, a
/// claude-code-runtime skill with host-bound tokens, and both legacy surfaces.
#[test]
#[ignore = "needs node and the TS build"]
fn a_broken_codex_target_fails_each_row_by_name() {
    let Some((ts, _)) = parity::case("validate-target-codex-broken")
        .fixture("validate-target-codex-broken")
        .args(&["validate", "--target", "codex"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    for expected in [
        "[FAIL] Codex AGENTS.md present",
        "[FAIL] Codex config.toml agent refs",
        "[FAIL] Codex config.toml secret-free",
        "[FAIL] Codex hook wrappers exist",
        "[FAIL] Codex agent name field",
        "[FAIL] Codex agent name uniqueness",
        "[FAIL] Codex exec-policy rules valid",
        "[FAIL] Codex installed skills runtime-supported",
        "[FAIL] Codex installed skills tool-token clean",
        "[WARN] Codex installed skills path refs",
        "[FAIL] Codex no native memory surface",
        "[FAIL] Codex no legacy prompts surface",
    ] {
        assert!(
            ts.stdout.contains(expected),
            "the fixture stopped producing {expected:?}: {}",
            ts.describe()
        );
    }
    // The secret's VALUE must never reach the report — only the key's path.
    assert!(
        !ts.stdout.contains("sk-not-a-real-key"),
        "a secret value leaked into the report: {}",
        ts.describe()
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_cursor_target_is_checked_against_its_authored_skeleton() {
    let Some((ts, _)) = parity::case("validate-target-cursor")
        .fixture("validate-target-cursor")
        .args(&["validate", "--target", "cursor"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(
        ts.stdout
            .contains("[PASS] Cursor reconciliation ledger present"),
        "{}",
        ts.describe()
    );
}

/// `--strict` reaches the target path too: a WARN row there fails the run.
#[test]
#[ignore = "needs node and the TS build"]
fn strict_applies_to_a_target_run() {
    let Some((ts, _)) = parity::case("validate-target-codex-strict")
        .fixture("validate-target-codex-broken")
        .args(&["validate", "--target", "codex", "--strict"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
}

/// A Codex target pointed at by a RELATIVE directory argument: the header and
/// every "Missing:" detail name the resolved absolute path.
#[test]
#[ignore = "needs node and the TS build"]
fn a_relative_target_directory_resolves_the_same_on_both_clis() {
    let Some((ts, _)) = parity::case("validate-target-relative-dir")
        .fixture("validate-target-codex")
        .args(&["validate", "--target", "codex", "./"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(
        ts.stdout.starts_with("Validating codex target: /"),
        "the directory must be absolutized: {}",
        ts.describe()
    );
}
