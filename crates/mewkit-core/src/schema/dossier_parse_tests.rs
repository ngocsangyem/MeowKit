//! Fail-closed cases for the dossier reader. A damaged record must read as
//! CORRUPT, never as an absent run: the second reading would reset every
//! supervision cap.

use super::super::dossier::Dossier;
use super::super::dossier_doc::render_dossier;
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
fn history_below_the_active_summary_is_ignored_on_read() {
    let text = format!(
        "{}\n<!-- supervision-history (never auto-loaded) -->\nold receipt\n",
        render_dossier(&dossier())
    );
    match parse_dossier(&text) {
        DossierRead::Found(back) => assert_eq!(*back, dossier()),
        other => panic!("expected a parsed dossier, got {other:?}"),
    }
}

#[test]
fn fails_closed_on_a_record_with_no_frontmatter() {
    assert_eq!(
        parse_dossier("# just a heading\n"),
        DossierRead::Corrupt("no frontmatter block".to_string())
    );
}

#[test]
fn fails_closed_on_unreadable_history_or_pointers_rather_than_resetting_the_caps() {
    let text = render_dossier(&dossier()).replace("history: []", "history: [not json");
    assert_eq!(
        parse_dossier(&text),
        DossierRead::Corrupt("history is not valid JSON".to_string())
    );

    let text = render_dossier(&dossier()).replace(
        "lockedDecisionPointers: [\"plan.md#locked-decisions\"]",
        "lockedDecisionPointers: [oops",
    );
    assert_eq!(
        parse_dossier(&text),
        DossierRead::Corrupt("pointer list is not valid JSON".to_string())
    );
}

#[test]
fn fails_closed_on_a_frontmatter_that_parses_but_does_not_validate() {
    let text = render_dossier(&dossier()).replace("stage: \"GUIDE\"", "stage: \"PLAN\"");
    assert!(
        matches!(parse_dossier(&text), DossierRead::Corrupt(_)),
        "an unknown stage is corrupt, not an empty run"
    );
}

#[test]
fn a_garbled_correction_count_is_corrupt_rather_than_a_silent_reset() {
    // `Number("abc")` is NaN, `-3` fails `min(0)` and `1.5` fails `int()`, so
    // all three are refused on the TypeScript side. Reading any of them as 0
    // would reset the counter every supervision cap keys off.
    for raw in ["abc", "-3", "1.5", "0x", "Infinity", "1_0"] {
        let text = render_dossier(&dossier())
            .replace("correctionCount: 0", &format!("correctionCount: {raw}"));
        assert!(
            matches!(parse_dossier(&text), DossierRead::Corrupt(_)),
            "correctionCount: {raw} read as something other than corrupt"
        );
    }
}

#[test]
fn an_absent_or_blank_correction_count_still_defaults_to_zero() {
    // `Number(undefined ?? 0)` and `Number("")` are both 0 in the TypeScript.
    let rendered = render_dossier(&dossier());
    for text in [
        rendered.replace("correctionCount: 0\n", ""),
        rendered.replace("correctionCount: 0", "correctionCount:"),
    ] {
        match parse_dossier(&text) {
            DossierRead::Found(back) => assert_eq!(back.correction_count, 0),
            other => panic!("expected a parsed dossier, got {other:?}"),
        }
    }
}

#[test]
fn a_well_formed_correction_count_is_read_as_written() {
    let text = render_dossier(&dossier()).replace("correctionCount: 0", "correctionCount: 4");
    match parse_dossier(&text) {
        DossierRead::Found(back) => assert_eq!(back.correction_count, 4),
        other => panic!("expected a parsed dossier, got {other:?}"),
    }
}

/// The checkpoint marker is read with ECMAScript whitespace semantics, because
/// the other writer of this file is a `RegExp` with no `u` flag. The two
/// characters where the engines disagree are the whole test: JavaScript's `\s`
/// matches U+FEFF and not U+0085, and Rust's default `\s` does the opposite —
/// so a marker separated by either one used to be read by one CLI and reported
/// corrupt by the other.
#[test]
fn the_checkpoint_marker_separator_follows_javascript_whitespace() {
    let mut with_checkpoint = dossier();
    with_checkpoint.checkpoint = serde_json::from_value(
        json!({"checkpointId": "cp-1", "stage": "GUIDE", "state": "pending"}),
    )
    .expect("valid checkpoint marker");
    let rendered = render_dossier(&with_checkpoint);
    assert!(
        rendered.contains("checkpointId: \"cp-1\""),
        "the render shape this test rests on changed: {rendered}"
    );

    // U+FEFF: JavaScript matches it, so the marker still reads.
    let feff = rendered.replace("checkpointId: ", "checkpointId:\u{feff}");
    match parse_dossier(&feff) {
        DossierRead::Found(back) => assert_eq!(*back, with_checkpoint),
        other => panic!("U+FEFF must separate the key, got {other:?}"),
    }

    // U+0085: JavaScript does NOT match it, so the key reads as missing and the
    // record fails closed rather than being accepted on a Rust-only reading.
    let nel = rendered.replace("checkpointId: ", "checkpointId:\u{85}");
    match parse_dossier(&nel) {
        DossierRead::Corrupt(_) => {}
        other => panic!("U+0085 must not separate the key, got {other:?}"),
    }
}
