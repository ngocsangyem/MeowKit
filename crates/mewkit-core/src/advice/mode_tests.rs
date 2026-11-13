use super::*;

#[test]
fn the_full_triple_classifies_as_embedded() {
    let call = classify_embedded_call("261112-advice-7", Some("REVIEW"), "cp-1")
        .expect("a complete triple");
    assert_eq!(call.stage, SupervisionStage::Review);
}

#[test]
fn a_consult_cannot_become_supervision_by_omitting_the_run_id() {
    for run_id in ["", "../escape", "Not A Slug"] {
        let refused = classify_embedded_call(run_id, Some("GUIDE"), "cp-1")
            .expect_err("an invalid run id is refused");
        assert!(refused.contains("a direct consult cannot become supervision"));
    }
}

#[test]
fn an_unknown_stage_is_refused_rather_than_coerced() {
    // Truthiness is not enough: a truthy-but-unknown stage would classify as
    // valid and then index a cadence table with a key it does not have.
    let refused = classify_embedded_call("run-1", Some("bogus"), "cp-1").expect_err("refused");
    assert_eq!(
        refused,
        "embedded supervision requires a known stage, got \"bogus\""
    );
    let absent = classify_embedded_call("run-1", None, "cp-1").expect_err("refused");
    assert_eq!(
        absent,
        "embedded supervision requires a known stage, got undefined"
    );
}

#[test]
fn a_blank_checkpoint_id_is_not_a_checkpoint() {
    let refused = classify_embedded_call("run-1", Some("GUIDE"), "   ").expect_err("refused");
    assert_eq!(
        refused,
        "embedded supervision requires a non-blank checkpointId"
    );
}
