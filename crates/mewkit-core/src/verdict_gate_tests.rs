use std::fs;

use super::{GateStatus, evaluate};

const VALID: &str = r#"{"schema_version":"1","slug":"s","gate":"review","decision":"PASS","dimensions":[],"created_at":"t"}"#;

#[test]
fn each_outcome_of_the_check() {
    let dir = tempfile::tempdir().unwrap();
    let path = |name: &str| dir.path().join(name).to_string_lossy().into_owned();

    let missing = evaluate(&path("none.json"));
    assert_eq!((missing.ok, missing.status), (false, GateStatus::Missing));

    fs::write(path("legacy.md"), "| Security | FAIL |\n").unwrap();
    let legacy = evaluate(&path("legacy.json"));
    // Tolerated even with a FAIL row: the npm CLI does the same, and the
    // stricter reading is a separate behaviour change.
    assert_eq!((legacy.ok, legacy.status), (true, GateStatus::LegacyMd));

    fs::write(path("pass.json"), VALID).unwrap();
    let pass = evaluate(&path("pass.json"));
    assert_eq!((pass.ok, pass.status), (true, GateStatus::Pass));
    assert_eq!(pass.decision.as_deref(), Some("PASS"));

    fs::write(
        path("blocked.json"),
        VALID.replace("\"PASS\"", "\"BLOCKED\""),
    )
    .unwrap();
    let blocked = evaluate(&path("blocked.json"));
    assert_eq!((blocked.ok, blocked.status), (false, GateStatus::Blocked));
    assert_eq!(
        blocked.errors,
        vec!["verdict decision is BLOCKED — Gate 2 blocks ship."]
    );

    fs::write(path("bad.json"), "{").unwrap();
    let bad = evaluate(&path("bad.json"));
    assert_eq!((bad.ok, bad.status), (false, GateStatus::Invalid));
    assert!(bad.errors[0].starts_with("invalid JSON: "));

    fs::write(path("shape.json"), "{}").unwrap();
    let shape = evaluate(&path("shape.json"));
    assert_eq!(shape.status, GateStatus::Invalid);
    assert_eq!(shape.errors.len(), 6);

    fs::create_dir(path("dir.json")).unwrap();
    let dir_case = evaluate(&path("dir.json"));
    assert_eq!(
        dir_case.errors,
        vec!["invalid JSON: EISDIR: illegal operation on a directory, read"]
    );
}

#[test]
fn a_pass_with_risk_decision_passes() {
    let dir = tempfile::tempdir().unwrap();
    let file = dir.path().join("r.json");
    fs::write(&file, VALID.replace("\"PASS\"", "\"PASS_WITH_RISK\"")).unwrap();
    let result = evaluate(&file.to_string_lossy());
    assert!(result.ok);
    assert_eq!(result.decision.as_deref(), Some("PASS_WITH_RISK"));
}
