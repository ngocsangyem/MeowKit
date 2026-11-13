use super::*;
use serde_json::json;

fn index(value: serde_json::Value) -> Map<String, Value> {
    value.as_object().expect("an object").clone()
}

#[test]
fn an_index_written_before_revisions_existed_reads_as_revision_one() {
    assert_eq!(current_revision(&index(json!({}))), 1);
    assert_eq!(
        current_revision(&index(json!({ "evidenceRevision": 4 }))),
        4
    );
    // `Number.isInteger(4.0)` is true on the TypeScript side.
    assert_eq!(
        current_revision(&index(json!({ "evidenceRevision": 4.0 }))),
        4
    );
    assert_eq!(
        current_revision(&index(json!({ "evidenceRevision": "4" }))),
        1
    );
}

#[test]
fn a_source_correction_supersedes_evidence_and_demotes_gate_two_only() {
    let before = index(json!({
        "evidenceRevision": 2,
        "verification": { "evidenceRevision": 2, "status": "valid" },
        "review": { "evidenceRevision": 2, "status": "valid" },
        "approvals": { "gate1": "approved", "gate2": "approved" }
    }));
    let after = apply_correction(&before, CorrectionKind::Source);
    assert_eq!(after["evidenceRevision"], json!(3));
    assert_eq!(after["scopeRevision"], json!(0));
    assert_eq!(after["verification"]["status"], json!("superseded"));
    assert_eq!(after["review"]["status"], json!("superseded"));
    assert_eq!(after["approvals"]["gate2"], json!("required"));
    assert_eq!(
        after["approvals"]["gate1"],
        json!("approved"),
        "an in-scope fix does not move what Gate 1 approved"
    );
}

#[test]
fn a_scope_correction_also_returns_gate_one_to_required() {
    let before = index(json!({
        "approvals": { "gate1": "approved", "gate2": "approved" }
    }));
    let after = apply_correction(&before, CorrectionKind::Scope);
    assert_eq!(after["evidenceRevision"], json!(2));
    assert_eq!(after["scopeRevision"], json!(2));
    assert_eq!(after["approvals"]["gate1"], json!("required"));
}

#[test]
fn a_correction_can_invalidate_an_approval_and_never_grants_one() {
    // The only writes this makes to `approvals` are approved → required. There
    // is no path in the other direction, in either correction kind.
    for kind in [CorrectionKind::Source, CorrectionKind::Scope] {
        let before = index(json!({ "approvals": { "gate1": "required", "gate2": "required" } }));
        let after = apply_correction(&before, kind);
        assert_eq!(after["approvals"]["gate1"], json!("required"));
        assert_eq!(after["approvals"]["gate2"], json!("required"));
    }
}

#[test]
fn unrelated_fields_keep_their_place_in_the_file() {
    let before = index(json!({ "plan": "261112-x", "evidenceRevision": 1, "notes": "keep me" }));
    let after = apply_correction(&before, CorrectionKind::Source);
    assert_eq!(
        after.keys().map(String::as_str).collect::<Vec<_>>(),
        vec![
            "plan",
            "evidenceRevision",
            "notes",
            "scopeRevision",
            "verification",
            "review",
            "approvals"
        ]
    );
}

#[test]
fn a_failed_read_names_the_file_rather_than_guessing_at_an_empty_index() {
    let dir = tempfile::tempdir().expect("a temp dir");
    let missing = dir.path().join("workflow-evidence.json");
    assert!(
        read_json_file(&missing)
            .expect_err("absent")
            .contains("evidence file not found")
    );

    std::fs::write(&missing, "{ not json").expect("a damaged index");
    assert!(
        read_json_file(&missing)
            .expect_err("damaged")
            .ends_with("is not valid JSON")
    );

    std::fs::write(&missing, "[1, 2]").expect("an array");
    assert!(
        read_json_file(&missing)
            .expect_err("not an object")
            .ends_with("is not a JSON object")
    );
}

#[test]
fn the_written_index_is_two_space_json_with_a_trailing_newline() {
    let dir = tempfile::tempdir().expect("a temp dir");
    let target = dir.path().join("workflow-evidence.json");
    write_json_atomic(&target, &index(json!({ "a": 1 }))).expect("the write lands");
    assert_eq!(
        std::fs::read_to_string(&target).expect("the index"),
        "{\n  \"a\": 1\n}\n"
    );
}
