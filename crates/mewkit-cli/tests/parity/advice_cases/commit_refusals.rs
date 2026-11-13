//! What `advice commit` refuses, and what it still leaves behind when it does.
//!
//! A refusal here is never an approval in disguise: `commit` can decline to
//! RECORD a disposition, and no path it takes advances a gate.
use super::fixtures::{OPEN, REVIEW_OPEN, SHIP};
use super::{Run, advice, receipt};

/// `commit --run demo-run --checkpoint cp-1`, plus whatever the case adds.
fn commit(
    name: &'static str,
    fixture: &'static str,
    extra: &[&str],
    writes: &[&str],
) -> Option<(Run, Run)> {
    let mut args = vec!["commit", "--run", "demo-run", "--checkpoint", "cp-1"];
    args.extend_from_slice(extra);
    advice(name, Some(fixture), &args).writes(writes).run()
}

#[test]
#[ignore = "needs node and the TS build"]
fn there_is_nothing_to_commit_without_a_run_or_an_open_checkpoint() {
    let Some((ts, _)) = advice(
        "advice-commit-no-such-run",
        None,
        &[
            "commit",
            "--run",
            "demo-run",
            "--checkpoint",
            "cp-1",
            "--disposition",
            "CONTINUE_WITH_DIRECTIVE",
            "--reason",
            "r",
        ],
    )
    .run() else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stderr
            .contains("No supervision run \"demo-run\" — run `mewkit advice begin` first.")
    );

    let Some((ts, _)) = advice(
        "advice-commit-unopened-checkpoint",
        Some(OPEN),
        &[
            "commit",
            "--run",
            "demo-run",
            "--checkpoint",
            "cp-9",
            "--disposition",
            "CONTINUE_WITH_DIRECTIVE",
            "--reason",
            "r",
        ],
    )
    .run() else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stderr
            .contains("Refused: no open checkpoint \"cp-9\" on run \"demo-run\".")
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_forward_stage_cannot_report_finished_work_ready() {
    let Some((ts, _)) = commit(
        "advice-commit-illegal-disposition",
        OPEN,
        &["--disposition", "READY_FOR_EXISTING_GATE", "--reason", "r"],
        &[],
    ) else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stderr
            .contains("Refused: \"READY_FOR_EXISTING_GATE\" is not legal at GUIDE.")
    );
    assert!(ts.stderr.contains("legal here: CONTINUE_WITH_DIRECTIVE"));
}

#[test]
#[ignore = "needs node and the TS build"]
fn an_unknown_outcome_and_an_authority_claim_are_both_refused_before_the_write() {
    for (name, outcome, reason, expected) in [
        (
            "advice-commit-bad-outcome",
            "bogus",
            "r",
            "outcome: Invalid enum value. Expected 'adopted' | 'rejected' | 'deferred', received 'bogus'",
        ),
        (
            "advice-commit-authority-language",
            "adopted",
            "gate 2 is approved",
            "approval claim in counsel",
        ),
        // A declared string flag written with no value is `""` under minimist,
        // which is how both shape refusals are reachable from a command line.
        (
            "advice-commit-blank-outcome",
            "",
            "r",
            "outcome: Invalid enum value. Expected 'adopted' | 'rejected' | 'deferred', received ''",
        ),
        (
            "advice-commit-blank-reason",
            "adopted",
            "",
            "reason: String must contain at least 1 character(s)",
        ),
    ] {
        let Some((ts, _)) = commit(
            name,
            OPEN,
            &[
                "--disposition",
                "CONTINUE_WITH_DIRECTIVE",
                "--outcome",
                outcome,
                "--reason",
                reason,
            ],
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
fn returning_work_with_nothing_to_change_is_not_actionable() {
    let Some((ts, _)) = commit(
        "advice-commit-return-without-correction",
        REVIEW_OPEN,
        &[
            "--disposition",
            "RETURN_TO_EXECUTOR",
            "--outcome",
            "adopted",
            "--reason",
            "the proof is stale",
        ],
        &[],
    ) else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stderr
            .contains("RETURN_TO_EXECUTOR requires at least one required correction")
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_directive_over_the_active_summary_cap_leaves_a_readable_orphan() {
    // The receipt is written BEFORE the dossier, so a refusal between them
    // leaves evidence that landed rather than a committed checkpoint whose
    // evidence did not. The cap itself is what keeps a fresh parent's reload
    // small, so it refuses rather than truncating the directive.
    let directive = "word ".repeat(600);
    let Some((ts, _)) = commit(
        "advice-commit-directive-over-cap",
        OPEN,
        &[
            "--disposition",
            "CONTINUE_WITH_DIRECTIVE",
            "--outcome",
            "adopted",
            "--reason",
            "r",
            "--directive",
            &directive,
        ],
        &[&receipt("demo-run", 1)],
    ) else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stderr
            .contains("over the 2048B cap — shorten the directive"),
        "{}",
        ts.stderr
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn the_release_stage_is_fixed_when_the_slot_is_claimed() {
    let Some((ts, _)) = advice(
        "advice-commit-release-stage-moved",
        Some(SHIP),
        &[
            "commit",
            "--run",
            "ship-run",
            "--checkpoint",
            "cp-2",
            "--disposition",
            "READY_FOR_EXISTING_GATE",
            "--outcome",
            "adopted",
            "--reason",
            "staged",
            "--release-stage",
            "publish",
        ],
    )
    .run() else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stderr
            .contains("opened in prepare, not publish — the release stage is fixed at `begin`.")
    );
}
