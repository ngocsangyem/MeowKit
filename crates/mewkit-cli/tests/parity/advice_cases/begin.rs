//! `advice begin` — the route contract and what a successful claim writes.
//!
//! The budget half (caps, stage ceilings, partitions, escalations) is in
//! [`super::begin_budget`].
use super::fixtures::OPEN;
use super::{advice, begin_case, dossier};

#[test]
#[ignore = "needs node and the TS build"]
fn a_first_checkpoint_opens_and_writes_the_pending_marker() {
    let Some((ts, _)) = begin_case(
        "advice-begin-first",
        None,
        ["demo-run", "mk:cook", "GUIDE", "cp-1"],
        &[],
        &[&dossier("demo-run")],
    ) else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(
        ts.stdout
            .contains("Checkpoint GUIDE/cp-1 opened (1 of 5 for mk:cook).")
    );
    assert!(
        ts.stdout
            .contains("legal dispositions: CONTINUE_WITH_DIRECTIVE, ESCALATE_TO_HUMAN, BLOCKED_MISSING_EVIDENCE"),
        "a forward stage cannot report finished work ready: {}",
        ts.stdout
    );
    assert!(
        ts.stdout
            .contains("supervision is evidence — it clears no gate and counts as no verification."),
        "the success line says what a checkpoint is not: {}",
        ts.stdout
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn every_part_of_the_triple_is_required() {
    for (name, args, expected) in [
        (
            "advice-begin-no-run",
            vec!["begin"],
            "`advice begin` requires --run <supervisionRunId>.",
        ),
        (
            "advice-begin-no-skill",
            vec!["begin", "--run", "demo-run"],
            "`advice begin` requires --skill <mk:skill>.",
        ),
        (
            "advice-begin-no-checkpoint",
            vec![
                "begin", "--run", "demo-run", "--skill", "mk:cook", "--stage", "GUIDE",
            ],
            "`advice begin` requires --checkpoint <checkpointId>.",
        ),
    ] {
        let Some((ts, _)) = advice(name, None, &args).run() else {
            return;
        };
        assert_eq!(ts.code, 1, "{}", ts.describe());
        assert!(ts.stderr.contains(expected), "{}", ts.describe());
    }
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_call_that_cannot_be_capped_or_resumed_is_refused_rather_than_downgraded() {
    // An invalid run id or an unknown stage would make the call unbounded or
    // uncheckable, so it is refused instead of being read as a stateless
    // consult.
    for (name, run_id, stage, expected) in [
        (
            "advice-begin-bad-run-id",
            "Bad Run",
            "GUIDE",
            "a direct consult cannot become supervision",
        ),
        (
            "advice-begin-unknown-stage",
            "demo-run",
            "BOGUS",
            "embedded supervision requires a known stage, got \"BOGUS\"",
        ),
    ] {
        let Some((ts, _)) = begin_case(name, None, [run_id, "mk:cook", stage, "cp-1"], &[], &[])
        else {
            return;
        };
        assert_eq!(ts.code, 1, "{}", ts.describe());
        assert!(ts.stderr.contains(expected), "{}", ts.describe());
    }
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_skill_with_no_checkpoint_has_no_entry_point() {
    let Some((ts, _)) = begin_case(
        "advice-begin-unsupervised-skill",
        None,
        ["demo-run", "mk:unknown", "GUIDE", "cp-1"],
        &[],
        &[],
    ) else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stderr
            .contains("Refused: mk:unknown does not expose --advice.")
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_run_belongs_to_one_skill() {
    let Some((ts, _)) = begin_case(
        "advice-begin-wrong-skill",
        Some(OPEN),
        ["demo-run", "mk:fix", "GUIDE", "cp-9"],
        &[],
        &[],
    ) else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stderr
            .contains("Refused: run \"demo-run\" belongs to mk:cook, not mk:fix.")
    );
}
