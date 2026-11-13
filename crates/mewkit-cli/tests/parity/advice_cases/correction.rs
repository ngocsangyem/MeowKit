//! What a returned correction does to the WORKFLOW evidence index.
//!
//! Separate from the supervision record on purpose: a correction can mark
//! recorded proof stale and can DEMOTE an approval, and it has no path that
//! grants one. The write target is narrowed to one filename, because the
//! correction spreads whatever JSON object it reads and writes it back.
use super::fixtures::REVIEW_OPEN;
use super::{advice, dossier, receipt};

const INDEX: &str = "tasks/plans/demo/reports/evidence/workflow-evidence.json";

/// A `RETURN_TO_EXECUTOR` commit against the `REVIEW_OPEN` fixture.
fn returning(
    name: &'static str,
    extra: &[&str],
) -> Option<(crate::parity::Run, crate::parity::Run)> {
    let mut args = vec![
        "commit",
        "--run",
        "demo-run",
        "--checkpoint",
        "cp-1",
        "--disposition",
        "RETURN_TO_EXECUTOR",
        "--outcome",
        "adopted",
        "--reason",
        "the proof is stale",
        "--correction",
        "add the regression test",
    ];
    args.extend_from_slice(extra);
    let (dossier_path, receipt_path) = (dossier("demo-run"), receipt("demo-run", 1));
    advice(name, Some(REVIEW_OPEN), &args)
        .writes(&[&dossier_path, &receipt_path])
        .run()
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_source_correction_supersedes_evidence_and_demotes_only_gate_two() {
    let Some((ts, _)) = returning("advice-commit-correction-source", &["--evidence", INDEX]) else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(
        ts.stdout
            .contains("evidence revision → 3; verification and review marked superseded."),
        "{}",
        ts.stdout
    );
    assert!(
        !ts.stdout.contains("Gate 1 returned to required"),
        "an in-scope fix does not move what Gate 1 approved: {}",
        ts.stdout
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_scope_correction_also_returns_gate_one_to_required() {
    let Some((ts, _)) = returning(
        "advice-commit-correction-scope",
        &["--correction-kind", "scope", "--evidence", INDEX],
    ) else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(
        ts.stdout
            .contains("; Gate 1 returned to required (scope changed)."),
        "{}",
        ts.stdout
    );
    assert!(
        ts.stdout
            .contains("superseded evidence cannot satisfy a later gate."),
        "{}",
        ts.stdout
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_correction_with_no_evidence_path_says_so_instead_of_inventing_one() {
    let Some((ts, _)) = returning("advice-commit-correction-no-evidence", &[]) else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(
        ts.stdout
            .contains("downstream evidence was NOT marked superseded."),
        "{}",
        ts.stdout
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_correction_writes_the_evidence_index_and_no_other_artifact() {
    for (name, evidence, expected) in [
        (
            "advice-commit-correction-wrong-file",
            "tasks/plans/demo/reports/evidence/review-artifact.json",
            "--evidence must name a workflow-evidence.json (got review-artifact.json).",
        ),
        (
            "advice-commit-correction-missing-file",
            "tasks/plans/demo/reports/evidence/missing.json",
            "Cannot apply correction: evidence file not found:",
        ),
        (
            "advice-commit-correction-outside-project",
            "../workflow-evidence.json",
            "Cannot apply correction: evidence file not found:",
        ),
    ] {
        let Some((ts, _)) = returning(name, &["--evidence", evidence]) else {
            return;
        };
        assert_eq!(ts.code, 1, "{}", ts.describe());
        assert!(ts.stderr.contains(expected), "{}", ts.describe());
    }
}

#[test]
#[ignore = "needs node and the TS build"]
fn an_unknown_correction_kind_is_refused_before_any_path_is_read() {
    let Some((ts, _)) = returning(
        "advice-commit-correction-bad-kind",
        &["--correction-kind", "sideways"],
    ) else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stderr
            .contains("--correction-kind must be source|scope, got sideways.")
    );
}
