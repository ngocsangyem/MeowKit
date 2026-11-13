//! `plan status` against both CLIs.
//!
//! The progress block is read by humans at Gate 1 and by the planning skills
//! that quote it, so the bar, the percentages and the observation list are the
//! contract — not a stand-in for one.
use crate::parity;

#[test]
#[ignore = "needs node and the TS build"]
fn a_healthy_plan_reports_its_progress() {
    let Some((ts, _)) = parity::case("plan-status")
        .fixture("plan-complete")
        .args(&["plan", "status", "tasks/plans/261112-demo-plan"])
        .run()
    else {
        return;
    };
    // Two CLIs that both printed an empty bar would agree while proving
    // nothing: this fixture has one of two boxes ticked in its phase file.
    assert!(
        ts.stdout.contains("Overall") && ts.stdout.contains("50% (1/2 boxes)"),
        "the fixture stopped exercising the progress bar: {}",
        ts.describe()
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_healthy_plan_as_json() {
    parity::case("plan-status-json")
        .fixture("plan-complete")
        .args(&["plan", "status", "--json", "tasks/plans/261112-demo-plan"])
        .run();
}

/// Observations are reported, never enforced: a plan with problems is still a
/// successful `status` run.
#[test]
#[ignore = "needs node and the TS build"]
fn a_ragged_plan_reports_observations_and_still_succeeds() {
    let Some((ts, _)) = parity::case("plan-status-ragged")
        .fixture("plan-ragged")
        .args(&["plan", "status", "tasks/plans/261112-ragged-plan"])
        .run()
    else {
        return;
    };
    assert_eq!(
        ts.code,
        0,
        "status reports, it does not judge: {}",
        ts.describe()
    );
    assert!(
        ts.stdout.contains("Observations ("),
        "the fixture stopped producing observations: {}",
        ts.describe()
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_ragged_plan_as_json() {
    parity::case("plan-status-ragged-json")
        .fixture("plan-ragged")
        .args(&["plan", "status", "--json", "tasks/plans/261112-ragged-plan"])
        .run();
}

/// A directory that is not there is not a failure either: the summary says what
/// is missing. Only an unreadable plan exits non-zero.
#[test]
#[ignore = "needs node and the TS build"]
fn an_absent_plan_directory_is_described_not_refused() {
    let Some((ts, _)) = parity::case("plan-status-absent")
        .fixture("plan-complete")
        .args(&["plan", "status", "tasks/plans/261112-not-here"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(
        ts.stdout.contains("no plan.md"),
        "the case stopped exercising the missing-plan observation: {}",
        ts.describe()
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_missing_plan_directory_argument_exits_one() {
    let Some((ts, _)) = parity::case("plan-status-no-target")
        .fixture("plan-complete")
        .args(&["plan", "status"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
}
