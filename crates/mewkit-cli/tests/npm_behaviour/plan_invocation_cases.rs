//! A wrong `plan` invocation, which both CLIs refuse with exit 2 before any
//! subcommand runs.
//!
//! The exit CODE is the contract a caller branches on; the wording is not, and
//! deliberately differs: the npm CLI renders from its command catalogue, this
//! one from clap's own parser. Declaring that per case keeps the difference
//! visible instead of letting a global allowance hide the next one.
use crate::npm;

const OWN_RENDERER: &str = "the refusal text is each CLI's own parser output \
                            (a command catalogue here, clap there); the exit code is compared";

#[test]
fn plan_without_a_subcommand_is_an_invocation_error() {
    let (ts, _) = npm::case("plan-no-subcommand")
        .fixture("plan-complete")
        .args(&["plan"])
        .ignore_stderr(OWN_RENDERER)
        .run();
    assert_eq!(ts.code, 2, "{}", ts.describe());
}

#[test]
fn an_unknown_plan_subcommand_is_an_invocation_error() {
    let (ts, _) = npm::case("plan-unknown-subcommand")
        .fixture("plan-complete")
        .args(&["plan", "bogus"])
        .ignore_stderr(OWN_RENDERER)
        .run();
    assert_eq!(ts.code, 2, "{}", ts.describe());
}

/// minimist reads flags wherever they sit, so a flag written before the
/// sub-verb must reach it and change the output (`--json`) in both CLIs.
///
/// The mutating half of this case used `--by` before `plan approve`; that
/// subcommand is gone, and no surviving `plan` sub-verb takes a global flag
/// that changes what it writes.
#[test]
fn a_flag_before_the_sub_verb_reaches_it() {
    let (ts, _) = npm::case("plan-json-before-status")
        .fixture("plan-complete")
        .args(&["plan", "--json", "status", "tasks/plans/261112-demo-plan"])
        .run();
    assert!(ts.stdout.trim_start().starts_with('{'), "{}", ts.describe());
}
