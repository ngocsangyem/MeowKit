use super::report_tests::{arm, case, report, run};
use super::*;
use RunOutcome::{Error, Fail, Pass};

fn trigger(pass: usize, fail: usize) -> Report {
    let mut runs = vec![run(Pass); pass];
    runs.extend(vec![run(Fail); fail]);
    report(vec![case("t", CaseKind::Trigger, runs)])
}

#[test]
fn same_suite_compares_with_deltas_against_the_margin() {
    let base = trigger(5, 5); // 50%
    let new = trigger(8, 2); // 80%
    let c = compare(&base, &new).expect("comparable");
    assert_eq!(c.margin_pp, 10.0);
    let d = c
        .suite
        .iter()
        .find(|d| d.metric == "triggerRate")
        .expect("rate");
    assert!((d.delta_pp - 30.0).abs() < 1e-9);
    assert!(d.beyond_margin);
    assert_eq!(c.cases.len(), 1);
    assert_eq!(c.cases[0].metric, "t:pass");
}

#[test]
fn a_change_inside_the_margin_is_not_beyond_it() {
    let c = compare(&trigger(5, 5), &trigger(6, 4)).expect("comparable");
    assert!(!c.suite[0].beyond_margin);
}

#[test]
fn larger_measured_spread_widens_the_margin() {
    let mut base = trigger(5, 5);
    base.spread_pp = Some(35.0);
    let c = compare(&base, &trigger(8, 2)).expect("comparable");
    assert_eq!(c.margin_pp, 35.0);
    assert!(!c.suite[0].beyond_margin);
}

#[test]
fn a_hand_raised_margin_does_not_hide_a_regression() {
    let mut base = trigger(8, 2);
    base.margin_pp = 100.0;
    let c = compare(&base, &trigger(5, 5)).expect("comparable");
    assert_eq!(c.margin_pp, 10.0);
    assert!(c.suite[0].beyond_margin);
}

#[test]
fn different_judge_or_off_arm_is_refused() {
    let base = trigger(1, 0);
    let mut other = base.clone();
    other.judge_model = Some("claude-haiku-5-5".into());
    assert!(matches!(
        compare(&base, &other),
        Err(CompareError::JudgeModel { .. })
    ));
    let mut other = base.clone();
    other.off_arm = "native-switch".into();
    assert!(matches!(
        compare(&base, &other),
        Err(CompareError::OffArm { .. })
    ));
}

#[test]
fn different_case_lists_under_one_hash_are_refused() {
    let base = report(vec![
        case("t", CaseKind::Trigger, vec![run(Pass)]),
        case("u", CaseKind::Trigger, vec![run(Fail)]),
    ]);
    // A dropped case.
    let dropped = report(vec![case("t", CaseKind::Trigger, vec![run(Pass)])]);
    assert_eq!(compare(&base, &dropped), Err(CompareError::Cases));
    // A flipped control flag.
    let mut flipped = base.clone();
    flipped.cases[1].kind = CaseKind::Parachute;
    flipped.cases[1].control = true;
    assert_eq!(compare(&base, &flipped), Err(CompareError::Cases));
}

#[test]
fn incomplete_reports_are_refused_even_if_marked_complete() {
    let mut base = trigger(1, 0);
    base.cases[0].runs.push(run(Error)); // 50% errors
    base.complete = true;
    assert_eq!(
        compare(&base, &trigger(1, 0)),
        Err(CompareError::Incomplete("base"))
    );
    assert_eq!(
        compare(&trigger(1, 0), &base),
        Err(CompareError::Incomplete("new"))
    );
}

#[test]
fn different_case_sets_models_runtimes_or_schemas_are_refused() {
    let base = trigger(1, 0);

    let mut other = base.clone();
    other.case_set_hash = "def".into();
    assert!(matches!(
        compare(&base, &other),
        Err(CompareError::CaseSet { .. })
    ));

    let mut other = base.clone();
    other.model = "claude-sonnet-5-5".into();
    assert!(matches!(
        compare(&base, &other),
        Err(CompareError::Model { .. })
    ));

    let mut other = base.clone();
    other.runtime = Runtime::Codex;
    assert!(matches!(
        compare(&base, &other),
        Err(CompareError::Runtime { .. })
    ));

    let mut other = base.clone();
    other.schema_version = 2;
    assert!(matches!(
        compare(&base, &other),
        Err(CompareError::SchemaVersion { .. })
    ));
}

#[test]
fn paired_cases_compare_by_arm() {
    let p = |on| {
        report(vec![case(
            "p",
            CaseKind::Paired,
            vec![arm(Arm::On, on), arm(Arm::Off, Fail)],
        )])
    };
    let c = compare(&p(Fail), &p(Pass)).expect("comparable");
    let metrics: Vec<&str> = c.cases.iter().map(|d| d.metric.as_str()).collect();
    assert_eq!(metrics, ["p:on", "p:off"]);
    assert_eq!(c.cases[0].delta_pp, 100.0);
    assert_eq!(c.cases[1].delta_pp, 0.0);
}
