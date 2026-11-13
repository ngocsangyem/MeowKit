use super::*;
use crate::schema::supervision_protocol::{Disposition, SupervisionStage};

fn receipt() -> Receipt {
    Receipt {
        run_id: "run-1".into(),
        stage: SupervisionStage::Review,
        disposition: Disposition::ReturnToExecutor,
        outcome: ReceiptOutcome::Adopted,
        reason: "the  evidence\nis thin".into(),
        task_id: "none".into(),
        provider: "unknown".into(),
        skill: "mk:cook".into(),
        checkpoint_id: "cp-1".into(),
        release_stage: None,
        question: String::new(),
        directive: "re-run the failing case".into(),
        required_corrections: vec!["add the regression test".into()],
        evidence_pointers: vec!["tasks/reports/run.md".into()],
        next_safe_action: String::new(),
    }
}

#[test]
fn the_record_says_what_it_is_not() {
    let rendered = render_receipt(&receipt());
    assert!(rendered.contains(
        "This is a record of supervision, NEVER verification and never a gate approval."
    ));
}

#[test]
fn no_rendered_receipt_can_carry_a_gate_decision() {
    // The receipt is the most re-readable supervision output, so it is the one
    // most likely to be mistaken for proof at a later gate. Its frontmatter
    // keys are a closed set, and none of them is an approval.
    let rendered = render_receipt(&receipt());
    let frontmatter = rendered
        .split("---")
        .nth(1)
        .expect("a frontmatter block")
        .to_string();
    let keys: Vec<&str> = frontmatter
        .lines()
        .filter_map(|line| line.split_once(':').map(|(key, _)| key.trim()))
        .collect();
    assert_eq!(
        keys,
        vec![
            "kind",
            "runId",
            "stage",
            "disposition",
            "outcome",
            "reason",
            "taskId",
            "provider",
            "skill",
            "checkpointId",
        ]
    );
    for authority in [
        "approval", "approved", "gate1", "gate2", "verdict", "status",
    ] {
        assert!(!keys.contains(&authority), "{authority} reached a receipt");
    }
}

#[test]
fn a_multi_line_reason_collapses_so_it_cannot_break_the_frontmatter() {
    let rendered = render_receipt(&receipt());
    assert!(rendered.contains("reason: \"the evidence is thin\""));
}

#[test]
fn absent_prose_reads_as_absent_rather_than_blank() {
    let rendered = render_receipt(&receipt());
    assert!(rendered.contains("**Question asked:** (not recorded)"));
    assert!(rendered.contains("**Next safe action:** (none recorded)"));
    assert!(rendered.contains("1. add the regression test"));
    assert!(rendered.contains("- tasks/reports/run.md"));
}

#[test]
fn a_release_stage_appears_only_when_one_was_charged() {
    assert!(!render_receipt(&receipt()).contains("releaseStage"));
    let charged = Receipt {
        release_stage: Some("publish".into()),
        ..receipt()
    };
    assert!(
        render_receipt(&charged).contains("\ncheckpointId: \"cp-1\"\nreleaseStage: \"publish\"\n")
    );
}

#[test]
fn an_empty_list_reads_as_none() {
    let bare = Receipt {
        required_corrections: Vec::new(),
        evidence_pointers: Vec::new(),
        ..receipt()
    };
    let rendered = render_receipt(&bare);
    assert!(rendered.contains("**Required corrections:**\n\nnone\n"));
    assert!(rendered.contains("**Evidence pointers:**\n\nnone\n"));
}
