//! What `advice begin` refuses once a run has history: stage ceilings, the call
//! cap, release-stage budgets, retried ids and escalations.
//!
//! Every refusal here errs toward under-permitting. A caller chooses the run id,
//! so each rule has to hold against a caller who would rather not stop.
use super::fixtures::{COMMITTED, CORRUPT, ESCALATED, SHIP, SPENT};
use super::{begin_case, dossier};

#[test]
#[ignore = "needs node and the TS build"]
fn a_partitioned_skill_demands_a_release_stage_and_an_unpartitioned_one_refuses_it() {
    for (name, skill, extra, expected) in [
        (
            "advice-begin-ship-no-release-stage",
            "mk:ship",
            vec![],
            "mk:ship budgets supervision per release stage — name one of prepare, release, publish",
        ),
        (
            "advice-begin-ship-bogus-release-stage",
            "mk:ship",
            vec!["--release-stage", "staging"],
            "\"staging\" is not a release stage for mk:ship — expected prepare, release, publish",
        ),
        (
            "advice-begin-cook-with-release-stage",
            "mk:cook",
            vec!["--release-stage", "prepare"],
            "mk:cook has a per-run cap and takes no release stage",
        ),
    ] {
        let Some((ts, _)) = begin_case(
            name,
            None,
            ["demo-run", skill, "GUIDE", "cp-1"],
            &extra,
            &[],
        ) else {
            return;
        };
        assert_eq!(ts.code, 1, "{}", ts.describe());
        assert!(ts.stderr.contains(expected), "{}", ts.describe());
    }
}

#[test]
#[ignore = "needs node and the TS build"]
fn each_release_stage_spends_its_own_budget() {
    let Some((ts, _)) = begin_case(
        "advice-begin-ship-second-stage",
        Some(SHIP),
        ["ship-run", "mk:ship", "GUIDE", "cp-3"],
        &["--release-stage", "publish"],
        &[&dossier("ship-run")],
    ) else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(
        ts.stdout.contains("opened (1 of 4 for mk:ship / publish)."),
        "a spent prepare budget leaves publish untouched: {}",
        ts.stdout
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_retried_checkpoint_id_returns_the_record_instead_of_spending_a_slot() {
    let Some((ts, _)) = begin_case(
        "advice-begin-duplicate-id",
        Some(COMMITTED),
        ["demo-run", "mk:cook", "GUIDE", "cp-1"],
        &[],
        &[],
    ) else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(
        ts.stdout
            .contains("already ran — returning the recorded result, no slot spent.")
    );
    assert!(
        ts.stdout
            .contains("latest directive: finish the migration first")
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn the_same_id_at_a_different_stage_is_a_collision_not_a_retry() {
    // Treating it as a retry would return another checkpoint's recorded result
    // and silently skip this one, while spending nothing.
    let Some((ts, _)) = begin_case(
        "advice-begin-duplicate-id-other-stage",
        Some(COMMITTED),
        ["demo-run", "mk:cook", "RESCUE", "cp-1"],
        &[],
        &[],
    ) else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stderr
            .contains("already ran at GUIDE — use a distinct id per checkpoint.")
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_stage_ceiling_and_the_rechecks_precondition_both_refuse() {
    for (name, stage, expected) in [
        (
            "advice-begin-stage-ceiling",
            "GUIDE",
            "Checkpoint refused: GUIDE already ran 1× in this run",
        ),
        (
            "advice-begin-recheck-without-return",
            "RECHECK",
            "Checkpoint refused: RECHECK requires a prior RETURN_TO_EXECUTOR in this run",
        ),
    ] {
        let Some((ts, _)) = begin_case(
            name,
            Some(COMMITTED),
            ["demo-run", "mk:cook", stage, "cp-2"],
            &[],
            &[],
        ) else {
            return;
        };
        assert_eq!(ts.code, 1, "{}", ts.describe());
        assert!(ts.stderr.contains(expected), "{}", ts.describe());
    }
}

#[test]
#[ignore = "needs node and the TS build"]
fn the_call_cap_escalates_and_the_marker_survives_the_refusal() {
    let Some((ts, _)) = begin_case(
        "advice-begin-cap-reached",
        Some(SPENT),
        ["demo-run", "mk:brainstorming", "RECHECK", "cp-5"],
        &[],
        &[&dossier("demo-run")],
    ) else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stderr
            .contains("mk:brainstorming reached its 4-call supervision cap in this run")
    );
    assert!(
        ts.stderr
            .contains("Escalate to a human — this is not a retry.")
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_fresh_run_id_does_not_walk_around_an_escalation() {
    // Caps are per run and the run id comes from the caller, so the escalation
    // has to bind to the SKILL as well, or the cheapest answer to a refusal is
    // a new `--run` and the human the refusal asked for never gets involved.
    let Some((ts, _)) = begin_case(
        "advice-begin-sibling-escalated",
        Some(ESCALATED),
        ["other-run", "mk:cook", "GUIDE", "cp-1"],
        &[],
        &[],
    ) else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stderr
            .contains("A new run id does not clear an escalation.")
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn an_unrelated_skill_is_not_blocked_by_another_runs_escalation() {
    let Some((ts, _)) = begin_case(
        "advice-begin-sibling-other-skill",
        Some(ESCALATED),
        ["other-run", "mk:fix", "GUIDE", "cp-1"],
        &[],
        &[&dossier("other-run")],
    ) else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
}

#[test]
#[ignore = "needs node and the TS build"]
fn resuming_an_escalated_run_is_the_humans_call_not_a_retry() {
    let Some((ts, _)) = begin_case(
        "advice-begin-escalated-resume",
        Some(ESCALATED),
        ["demo-run", "mk:cook", "GUIDE", "cp-3"],
        &[],
        &[],
    ) else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(ts.stderr.contains("that decision is theirs, not a retry."));
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_damaged_sibling_record_is_refused_rather_than_skipped() {
    // Skipping it would restore the bypass by simply corrupting the record that
    // says "escalate".
    let Some((ts, _)) = begin_case(
        "advice-begin-corrupt-sibling",
        Some(CORRUPT),
        ["other-run", "mk:cook", "GUIDE", "cp-1"],
        &[],
        &[],
    ) else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stderr
            .contains("is unreadable (history is not valid JSON) — repair or remove it first.")
    );
}
