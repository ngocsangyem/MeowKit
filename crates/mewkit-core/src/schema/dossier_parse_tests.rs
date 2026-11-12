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
