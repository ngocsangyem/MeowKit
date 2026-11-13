//! `advice commit` — the record a delivered checkpoint leaves behind.
//!
//! What it REFUSES is in [`super::commit_refusals`]; the evidence-index half of
//! a returned correction is in [`super::correction`].
use super::fixtures::{OPEN, RETURNED, REVIEW_OPEN};
use super::{Run, advice, dossier, receipt};

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
fn a_committed_checkpoint_records_what_the_parent_did_not_only_what_came_back() {
    let (dossier_path, receipt_path) = (dossier("demo-run"), receipt("demo-run", 1));
    let Some((ts, _)) = commit(
        "advice-commit-rejected",
        OPEN,
        &[
            "--disposition",
            "CONTINUE_WITH_DIRECTIVE",
            "--outcome",
            "rejected",
            "--reason",
            "the directive misreads the schema",
            "--directive",
            "revert the writer",
            "--next",
            "ship the reader",
            "--question",
            "is it safe to ship first",
            "--evidence-pointer",
            "tasks/reports/x.md",
            "--task-id",
            "t-1",
            "--provider",
            "claude",
        ],
        &[&dossier_path, &receipt_path],
    ) else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(
        ts.stdout.contains(
            "Committed GUIDE/cp-1 — disposition CONTINUE_WITH_DIRECTIVE, outcome rejected."
        ),
        "a receipt that cannot express disagreement is a record of compliance: {}",
        ts.stdout
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn nothing_written_here_records_an_approval() {
    // The standing Gate Authority check over a real checkpoint's artifacts: the
    // disposition that most reads like clearance says the opposite in print.
    let (dossier_path, receipt_path) = (dossier("demo-run"), receipt("demo-run", 1));
    let Some((ts, _)) = commit(
        "advice-commit-ready-for-gate",
        REVIEW_OPEN,
        &[
            "--disposition",
            "READY_FOR_EXISTING_GATE",
            "--outcome",
            "adopted",
            "--reason",
            "the evidence supports shipping",
        ],
        &[&dossier_path, &receipt_path],
    ) else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(
        ts.stdout
            .contains("the normal reviewer/gate is the next step — this does NOT clear it."),
        "{}",
        ts.stdout
    );
    assert!(
        !ts.stdout.to_lowercase().contains("approved"),
        "no commit output may read as an approval: {}",
        ts.stdout
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn commit_needs_a_run_a_checkpoint_and_a_reason() {
    for (name, args, expected) in [
        (
            "advice-commit-no-run",
            vec!["commit"],
            "`advice commit` requires --run <supervisionRunId>.",
        ),
        (
            "advice-commit-no-checkpoint",
            vec!["commit", "--run", "demo-run"],
            "`advice commit` requires --checkpoint <checkpointId>.",
        ),
        (
            "advice-commit-no-reason",
            vec!["commit", "--run", "demo-run", "--checkpoint", "cp-1"],
            "`advice commit` requires --reason (required even when adopted).",
        ),
    ] {
        let Some((ts, _)) = advice(name, Some(OPEN), &args).run() else {
            return;
        };
        assert_eq!(ts.code, 1, "{}", ts.describe());
        assert!(ts.stderr.contains(expected), "{}", ts.describe());
    }
}
#[test]
#[ignore = "needs node and the TS build"]
fn a_second_unresolved_return_advances_the_receipt_index_and_the_escalation() {
    let (dossier_path, receipt_path) = (dossier("demo-run"), receipt("demo-run", 2));
    let Some((ts, _)) = advice(
        "advice-commit-second-return",
        Some(RETURNED),
        &[
            "commit",
            "--run",
            "demo-run",
            "--checkpoint",
            "cp-2",
            "--disposition",
            "RETURN_TO_EXECUTOR",
            "--outcome",
            "adopted",
            "--reason",
            "still thin",
            "--correction",
            "add the test",
        ],
    )
    .writes(&[&dossier_path, &receipt_path])
    .run() else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(
        ts.stdout.contains("receipt: tasks/reports/"),
        "the receipt index advances past the one already recorded: {}",
        ts.stdout
    );
}
