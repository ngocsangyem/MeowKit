use super::*;

pub(super) fn run(outcome: RunOutcome) -> RunResult {
    RunResult {
        outcome,
        arm: None,
        error: None,
    }
}

pub(super) fn arm(a: Arm, outcome: RunOutcome) -> RunResult {
    RunResult {
        arm: Some(a),
        ..run(outcome)
    }
}

/// A case whose plan is what it ran: the run count, or the `on` count when paired.
pub(super) fn case(id: &str, kind: CaseKind, runs: Vec<RunResult>) -> CaseResult {
    let planned_runs = match kind {
        CaseKind::Paired => runs.iter().filter(|r| r.arm == Some(Arm::On)).count(),
        _ => runs.len(),
    } as u32;
    CaseResult {
        id: id.into(),
        skill: "cook".into(),
        kind,
        held_out: false,
        control: false,
        planned_runs,
        runs,
    }
}

pub(super) fn report(cases: Vec<CaseResult>) -> Report {
    let mut r = Report {
        schema_version: REPORT_SCHEMA_VERSION,
        runtime: Runtime::ClaudeCode,
        model: "claude-opus-5-5".into(),
        judge_model: None,
        case_set_hash: "abc".into(),
        off_arm: "scratch-install".into(),
        complete: false,
        skipped: vec![],
        cases,
        totals: Totals::default(),
        spread_pp: None,
        margin_pp: 0.0,
        probes: vec![],
        gates: vec![],
    };
    r.finalize();
    r
}

use RunOutcome::{Error, Fail, Pass};

#[test]
fn rates_come_from_runs_and_errors_stay_out_of_them() {
    let mut control = case("ctl", CaseKind::Parachute, vec![run(Pass), run(Fail)]);
    control.control = true;
    let r = report(vec![
        case(
            "t",
            CaseKind::Trigger,
            vec![run(Pass), run(Pass), run(Fail), run(Error)],
        ),
        case(
            "w",
            CaseKind::Parachute,
            vec![run(Pass), run(Fail), run(Fail), run(Fail)],
        ),
        control,
    ]);
    assert_eq!(r.totals.runs, 10);
    assert_eq!(r.totals.errors, 1);
    assert_eq!(r.totals.trigger_rate, Some(2.0 / 3.0));
    assert_eq!(r.totals.mismatch_report_rate, Some(0.25));
    assert_eq!(r.totals.false_report_rate, Some(0.5));
    assert_eq!(r.totals.paired_on_rate, None);
    assert!(!r.complete, "1 error in 10 runs is over the 5% limit");
}

#[test]
fn error_share_at_the_limit_is_still_complete() {
    let mut runs = vec![run(Pass); 19];
    runs.push(run(Error));
    assert!(report(vec![case("t", CaseKind::Trigger, runs)]).complete);
}

#[test]
fn paired_arms_count_together_or_not_at_all() {
    let r = report(vec![case(
        "p",
        CaseKind::Paired,
        vec![
            arm(Arm::On, Pass),
            arm(Arm::Off, Fail),
            arm(Arm::On, Pass),
            arm(Arm::Off, Error), // drops the whole second pair
        ],
    )]);
    assert_eq!(r.totals.paired_on_rate, Some(1.0));
    assert_eq!(r.totals.paired_off_rate, Some(0.0));
}

#[test]
fn one_arm_without_the_other_makes_the_report_incomplete() {
    let r = report(vec![case(
        "p",
        CaseKind::Paired,
        vec![arm(Arm::On, Pass), arm(Arm::Off, Pass), arm(Arm::On, Pass)],
    )]);
    assert!(!r.complete);
}

#[test]
fn a_skipped_case_makes_the_report_incomplete_whatever_the_file_says() {
    let mut r = report(vec![case("t", CaseKind::Trigger, vec![run(Pass)])]);
    assert!(r.complete);
    r.skipped.push(SkippedCase {
        id: "t2".into(),
        reason: "cost ceiling reached".into(),
    });
    r.complete = true;
    r.finalize();
    assert!(!r.complete);
}

#[test]
fn margin_is_the_spread_but_never_below_the_floor() {
    assert_eq!(margin_pp(None), 10.0);
    assert_eq!(margin_pp(Some(4.0)), 10.0);
    assert_eq!(margin_pp(Some(17.5)), 17.5);
    let mut r = report(vec![case("t", CaseKind::Trigger, vec![run(Pass)])]);
    r.spread_pp = Some(12.0);
    r.finalize();
    assert_eq!(r.margin_pp, 12.0);
}

#[test]
fn a_stored_margin_is_recomputed_not_kept() {
    let mut r = report(vec![case("t", CaseKind::Trigger, vec![run(Pass)])]);
    r.margin_pp = 100.0;
    r.finalize();
    assert_eq!(r.margin_pp, 10.0);
}

#[test]
fn an_impossible_spread_makes_the_report_incomplete() {
    for bad in [f64::INFINITY, -1.0, 150.0] {
        let mut r = report(vec![case("t", CaseKind::Trigger, vec![run(Pass)])]);
        r.spread_pp = Some(bad);
        r.finalize();
        assert!(!r.complete, "{bad}");
        assert_eq!(r.margin_pp, 10.0, "{bad}");
    }
}

#[test]
fn a_report_with_nothing_run_is_incomplete() {
    assert!(!report(vec![]).complete);
    let mut empty = case("t", CaseKind::Trigger, vec![]);
    empty.planned_runs = 0;
    assert!(!report(vec![empty]).complete);
}

#[test]
fn a_case_stopped_part_way_makes_the_report_incomplete() {
    let mut c = case("t", CaseKind::Trigger, vec![run(Pass), run(Pass)]);
    c.planned_runs = 3;
    assert!(!report(vec![c]).complete);
}

#[test]
fn a_paired_run_without_an_arm_makes_the_report_incomplete() {
    let r = report(vec![case(
        "p",
        CaseKind::Paired,
        vec![arm(Arm::On, Pass), arm(Arm::Off, Pass), run(Fail)],
    )]);
    assert!(!r.complete);
}

#[test]
fn smoke_check_is_derived_from_the_margin_for_pp_gates() {
    let gate = |change: f64, unit: &str| GateRow {
        gate: "g".into(),
        metric: "m".into(),
        unit: unit.into(),
        min_detectable_change: change,
        smoke_check: false,
    };
    let mut r = report(vec![case("t", CaseKind::Trigger, vec![run(Pass)])]);
    r.gates = vec![
        gate(15.0, "pp"),
        gate(2.0, "pp"),
        gate(f64::NAN, "pp"),
        gate(2.0, "bytes"),
    ];
    r.finalize();
    let flags: Vec<bool> = r.gates.iter().map(|g| g.smoke_check).collect();
    assert_eq!(flags, [false, true, true, false]);
}

#[test]
fn unknown_report_keys_are_refused() {
    let r = report(vec![case("t", CaseKind::Trigger, vec![run(Pass)])]);
    let json = serde_json::to_string(&r).expect("serialises");
    let typo = json.replacen("\"heldOut\"", "\"heldOuts\"", 1);
    assert!(serde_json::from_str::<Report>(&typo).is_err());
}

#[test]
fn spread_is_the_largest_gap_between_shared_rates() {
    let a = Totals {
        trigger_rate: Some(0.80),
        mismatch_report_rate: Some(0.50),
        paired_on_rate: Some(0.9),
        ..Totals::default()
    };
    let b = Totals {
        trigger_rate: Some(0.75),
        mismatch_report_rate: Some(0.62),
        ..Totals::default()
    };
    let s = spread_pp(&a, &b).expect("shared rates");
    assert!((s - 12.0).abs() < 1e-9, "{s}");
    assert_eq!(spread_pp(&Totals::default(), &b), None);
}

#[test]
fn report_round_trips_as_camel_case_json() {
    let mut r = report(vec![case("t", CaseKind::Trigger, vec![run(Pass)])]);
    r.probes.push(Probe {
        name: "subagentStartContext".into(),
        outcome: ProbeOutcome::Inconclusive,
        evidence: "no marker in subagent transcript".into(),
    });
    r.gates.push(GateRow {
        gate: "parachute exit".into(),
        metric: "mismatchReportRate".into(),
        unit: "pp".into(),
        min_detectable_change: 15.0,
        smoke_check: false,
    });
    let json = serde_json::to_string(&r).expect("serialises");
    for key in [
        "\"schemaVersion\":1",
        "\"caseSetHash\"",
        "\"offArm\"",
        "\"marginPp\"",
        "\"minDetectableChange\"",
        "\"inconclusive\"",
        "\"claude-code\"",
    ] {
        assert!(json.contains(key), "{key} missing in {json}");
    }
    let back: Report = serde_json::from_str(&json).expect("parses");
    assert_eq!(back, r);
}
