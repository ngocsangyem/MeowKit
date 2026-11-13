//! The ways `validate` can be asked something it refuses, and with which code.
//!
//! Exit codes carry meaning here and they are not interchangeable: 1 is "this
//! project has a problem", 2 is "that invocation is wrong". A CI step reads the
//! difference, so each refusal is compared, message and code together.
use crate::parity;

/// An unknown mode is rejected before anything is printed, and it exits 1 —
/// the npm dispatcher's own answer, not a parser usage error.
#[test]
#[ignore = "needs node and the TS build"]
fn an_unknown_mode_is_refused_before_any_check_runs() {
    let Some((ts, _)) = parity::case("validate-mode-invalid")
        .fixture("validate-flat-copy")
        .args(&["validate", "--mode", "strict-copy"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stdout.is_empty(),
        "a bad argument must not print a report first: {}",
        ts.describe()
    );
    assert!(
        ts.stderr
            .contains("Invalid --mode \"strict-copy\". Expected \"authoring\" or \"flat-copy\"."),
        "{}",
        ts.describe()
    );
}

/// `--target` validates a GENERATED provider tree and `--portable` adds checks
/// about projecting one, so asking for both is a contradiction: exit 2.
#[test]
#[ignore = "needs node and the TS build"]
fn target_and_portable_are_mutually_exclusive() {
    let Some((ts, _)) = parity::case("validate-target-portable")
        .fixture("validate-flat-copy")
        .args(&["validate", "--target", "codex", "--portable"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 2, "{}", ts.describe());
    assert!(
        ts.stderr
            .contains("`--target` and `--portable` are mutually exclusive."),
        "{}",
        ts.describe()
    );
}

/// An unknown provider names the ones that exist, so the user can correct it.
#[test]
#[ignore = "needs node and the TS build"]
fn an_unknown_target_lists_the_known_ones() {
    let Some((ts, _)) = parity::case("validate-target-unknown")
        .fixture("validate-flat-copy")
        .args(&["validate", "--target", "emacs"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 2, "{}", ts.describe());
    assert!(
        ts.stderr
            .contains("Unknown --target \"emacs\". Known targets: codex, cursor."),
        "{}",
        ts.describe()
    );
}

/// A known provider pointed at a directory that is not one of its targets is a
/// finding about the directory, not a usage error: exit 1, on stdout.
#[test]
#[ignore = "needs node and the TS build"]
fn a_directory_that_is_not_the_named_target_exits_one() {
    let Some((ts, _)) = parity::case("validate-target-not-detected")
        .fixture("validate-empty")
        .args(&["validate", "--target", "cursor"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stdout.contains("Not a cursor target"),
        "{}",
        ts.describe()
    );
}
