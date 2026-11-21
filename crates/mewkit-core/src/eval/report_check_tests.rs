use std::fs;

use super::*;

const CASES: &str = "cases:\n  - id: cook-t1\n    skill: cook\n    kind: trigger\n    prompt: build the feature\n    expectTrigger: true\n  - id: cook-c1\n    skill: cook\n    kind: parachute\n    prompt: use the given approach\n    runs: 5\n    approachIsWrong: false\n    mismatchPattern: contradicts\n";

fn set() -> (tempfile::TempDir, CaseSet) {
    let dir = tempfile::tempdir().expect("tempdir");
    fs::create_dir_all(dir.path().join("cook/eval")).expect("mkdir");
    fs::write(dir.path().join("cook/eval/c.yaml"), CASES).expect("write");
    let set = load_cases(dir.path()).expect("loads");
    (dir, set)
}

fn planned_report(set: &CaseSet) -> Report {
    let mut r = super::report_tests::report(vec![]);
    r.case_set_hash = set.hash.clone();
    r.cases = set
        .cases
        .iter()
        .map(|l| CaseResult::planned(&l.case))
        .collect();
    r
}

#[test]
fn planned_result_carries_what_the_case_declares() {
    let (_d, set) = set();
    let c = CaseResult::planned(&set.cases[1].case);
    assert_eq!(c.kind, CaseKind::Parachute);
    assert!(c.control, "approachIsWrong: false is a control brief");
    assert_eq!(c.planned_runs, 5);
    assert!(c.runs.is_empty());
}

#[test]
fn a_report_built_from_the_set_passes() {
    let (_d, set) = set();
    planned_report(&set).check_against(&set).expect("matches");
}

#[test]
fn a_dropped_case_is_missing() {
    let (_d, set) = set();
    let mut r = planned_report(&set);
    r.cases.remove(0);
    assert_eq!(
        r.check_against(&set),
        Err(ReportCheckError::Missing("cook-t1".into()))
    );
}

#[test]
fn an_extra_case_is_unknown() {
    let (_d, set) = set();
    let mut r = planned_report(&set);
    let mut extra = r.cases[0].clone();
    extra.id = "cook-x".into();
    r.cases.push(extra);
    assert_eq!(
        r.check_against(&set),
        Err(ReportCheckError::Unknown("cook-x".into()))
    );
}

#[test]
fn a_flipped_flag_or_run_count_is_a_mismatch() {
    let (_d, set) = set();
    let mut r = planned_report(&set);
    r.cases[1].control = false;
    assert_eq!(
        r.check_against(&set),
        Err(ReportCheckError::Mismatch("cook-c1".into()))
    );
    let mut r = planned_report(&set);
    r.cases[0].planned_runs = 1;
    assert_eq!(
        r.check_against(&set),
        Err(ReportCheckError::Mismatch("cook-t1".into()))
    );
}

#[test]
fn another_hash_is_refused() {
    let (_d, set) = set();
    let mut r = planned_report(&set);
    r.case_set_hash = "other".into();
    assert!(matches!(
        r.check_against(&set),
        Err(ReportCheckError::Hash { .. })
    ));
}
