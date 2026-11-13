//! How an `advice` command line is classified before anything runs.
//!
//! The sub-verb slot has one meaning per exit code: 2 is "the invocation was
//! wrong", which a script can tell apart from "it ran and failed".
use super::advice;

#[test]
#[ignore = "needs node and the TS build"]
fn a_missing_subcommand_is_an_invocation_error_not_a_no_op() {
    let Some((ts, _)) = advice("advice-no-subcommand", None, &[]).run() else {
        return;
    };
    assert_eq!(ts.code, 2, "{}", ts.describe());
    assert!(ts.stderr.contains("`mewkit advice` needs a subcommand."));
    assert!(
        ts.stderr
            .contains("Valid subcommands: begin, commit, status, validate-packet")
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_mistyped_subcommand_names_the_ones_that_exist() {
    let Some((ts, _)) = advice("advice-unknown-subcommand", None, &["bogus"]).run() else {
        return;
    };
    assert_eq!(ts.code, 2, "{}", ts.describe());
    assert!(ts.stderr.contains("Unknown `advice` subcommand: bogus"));
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_flag_in_the_subcommand_slot_is_still_a_missing_subcommand() {
    // minimist reads `--json` as a flag, not as a misspelled sub-verb, so the
    // answer is the missing-subcommand one rather than "unknown: --json".
    let Some((ts, _)) = advice("advice-flag-only", None, &["--json"]).run() else {
        return;
    };
    assert_eq!(ts.code, 2, "{}", ts.describe());
    assert!(ts.stderr.contains("needs a subcommand"));
}

#[test]
#[ignore = "needs node and the TS build"]
fn help_is_answered_rather_than_running_the_command() {
    let Some((ts, rust)) = advice("advice-help", None, &["--help"])
        .ignore_stdout("help text is rendered by each CLI's own parser")
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert_eq!(rust.code, 0, "{}", rust.describe());
}
