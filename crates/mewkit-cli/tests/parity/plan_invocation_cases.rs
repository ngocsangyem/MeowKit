//! A wrong `plan` invocation, which both CLIs refuse with exit 2 before any
//! subcommand runs.
//!
//! The exit CODE is the contract a caller branches on; the wording is not, and
//! deliberately differs: the npm CLI renders from its command catalogue, this
//! one from clap's own parser. Declaring that per case keeps the difference
//! visible instead of letting a global allowance hide the next one.
use crate::parity;

const OWN_RENDERER: &str = "the refusal text is each CLI's own parser output \
                            (a command catalogue here, clap there); the exit code is compared";

#[test]
#[ignore = "needs node and the TS build"]
fn plan_without_a_subcommand_is_an_invocation_error() {
    let Some((ts, _)) = parity::case("plan-no-subcommand")
        .fixture("plan-complete")
        .args(&["plan"])
        .ignore_stderr(OWN_RENDERER)
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 2, "{}", ts.describe());
}

#[test]
#[ignore = "needs node and the TS build"]
fn an_unknown_plan_subcommand_is_an_invocation_error() {
    let Some((ts, _)) = parity::case("plan-unknown-subcommand")
        .fixture("plan-complete")
        .args(&["plan", "bogus"])
        .ignore_stderr(OWN_RENDERER)
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 2, "{}", ts.describe());
}

/// minimist reads flags wherever they sit, so a flag written before the
/// sub-verb must change the output (`--json`) and the receipt (`--by`) the same
/// way in both CLIs.
#[test]
#[ignore = "needs node and the TS build"]
fn a_flag_before_the_sub_verb_reaches_it() {
    let Some((ts, _)) = parity::case("plan-json-before-status")
        .fixture("plan-complete")
        .args(&["plan", "--json", "status", "tasks/plans/261112-demo-plan"])
        .run()
    else {
        return;
    };
    assert!(ts.stdout.trim_start().starts_with('{'), "{}", ts.describe());

    let Some((ts, _)) = parity::case("plan-by-before-approve")
        .fixture("plan-approvable")
        .args(&[
            "plan",
            "--by",
            "flag-first",
            "approve",
            "tasks/plans/261112-demo-plan",
        ])
        .writes(&["tasks/plans/261112-demo-plan/plan.md"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
}
