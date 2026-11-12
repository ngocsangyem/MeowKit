//! Round-trip and fail-closed cases for the dossier document. The round trip IS
//! the contract: the renderer is the file's only writer, and the 2 KiB cap in
//! `dossier.rs` is measured against exactly these bytes.

use serde_json::json;

use super::super::dossier::{CheckpointMarker, CheckpointState, Dossier};
use super::super::dossier_parse::{DossierRead, parse_dossier};
use super::super::supervision_protocol::{Disposition, SupervisionStage};
use super::*;

fn dossier() -> Dossier {
    serde_json::from_value(json!({
        "runId": "run-1",
        "skill": "mk:cook",
        "stage": "GUIDE",
        "lockedDecisionPointers": ["plan.md#locked-decisions"],
        "latestDirective": "start with the validator",
        "correctionCount": 0,
        "receiptPointers": [],
        "nextSafeAction": "implement packet schema",
        "checkpoint": null,
        "history": [],
        "escalatedToHuman": false
    }))
    .expect("valid dossier")
}

#[test]
fn states_in_the_artifact_that_it_is_not_verification() {
    assert!(
        render_dossier(&dossier()).contains("NEVER verification and never a gate approval"),
        "the not-verification line is part of the artifact"
    );
}

#[test]
fn round_trips_a_compact_dossier() {
    let original = dossier();
    let text = render_dossier(&original);
    match parse_dossier(&text) {
        DossierRead::Found(back) => assert_eq!(*back, original),
        other => panic!("expected a parsed dossier, got {other:?}"),
    }
}

#[test]
fn round_trips_a_checkpoint_marker_including_its_partition() {
    let mut original = dossier();
    original.checkpoint = Some(CheckpointMarker {
        checkpoint_id: "cook-review".into(),
        stage: SupervisionStage::Review,
        state: CheckpointState::Pending,
        partition: Some("ship".into()),
    });
    original.history = vec![
        serde_json::from_value(json!({
            "checkpointId": "cook-guide-1",
            "stage": "GUIDE",
            "disposition": "CONTINUE_WITH_DIRECTIVE"
        }))
        .expect("valid history entry"),
    ];
    let text = render_dossier(&original);
    assert!(text.contains("partition: \"ship\""), "{text}");
    match parse_dossier(&text) {
        DossierRead::Found(back) => {
            assert_eq!(*back, original);
            assert_eq!(
                back.history[0].disposition,
                Disposition::ContinueWithDirective
            );
        }
        other => panic!("expected a parsed dossier, got {other:?}"),
    }
}

#[test]
fn renders_history_as_inline_json_so_the_frontmatter_stays_well_formed() {
    let mut original = dossier();
    original.history = vec![
        serde_json::from_value(json!({
            "checkpointId": "c1",
            "stage": "REVIEW",
            "disposition": "RETURN_TO_EXECUTOR"
        }))
        .expect("entry"),
    ];
    let text = render_dossier(&original);
    assert!(
        text.contains(
            "history: [{\"checkpointId\":\"c1\",\"stage\":\"REVIEW\",\"disposition\":\"RETURN_TO_EXECUTOR\"}]"
        ),
        "{text}"
    );
}

#[test]
fn collapses_a_multi_line_directive_so_nothing_truncates_on_read() {
    let mut original = dossier();
    original.latest_directive = "first line\n\tsecond line".into();
    let text = render_dossier(&original);
    assert!(
        text.contains("**Latest directive:** first line second line"),
        "{text}"
    );
    match parse_dossier(&text) {
        DossierRead::Found(back) => assert_eq!(back.latest_directive, "first line second line"),
        other => panic!("expected a parsed dossier, got {other:?}"),
    }
}

#[test]
fn an_empty_directive_round_trips_as_empty_not_as_the_placeholder() {
    let mut original = dossier();
    original.latest_directive = String::new();
    original.next_safe_action = String::new();
    let text = render_dossier(&original);
    assert!(text.contains("**Latest directive:** (none yet)"), "{text}");
    match parse_dossier(&text) {
        DossierRead::Found(back) => {
            assert!(back.latest_directive.is_empty());
            assert!(back.next_safe_action.is_empty());
        }
        other => panic!("expected a parsed dossier, got {other:?}"),
    }
}

#[test]
fn escapes_a_quote_in_a_scalar_and_reads_it_back_exactly() {
    let mut original = dossier();
    original.skill = "mk:\"cook\"\\x".into();
    let text = render_dossier(&original);
    match parse_dossier(&text) {
        DossierRead::Found(back) => assert_eq!(back.skill, "mk:\"cook\"\\x"),
        other => panic!("expected a parsed dossier, got {other:?}"),
    }
}
