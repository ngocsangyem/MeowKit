//! Unit tests for `ownership_rows` — the ownership rows rules.
use super::*;

#[test]
fn the_embedded_schema_carries_every_required_enum() {
    // A schema that lost an enum would make every value "not in enum", so
    // the check would fail an install that is fine.
    for field in REQUIRED_FIELDS {
        assert!(
            !schema_enum(field).is_empty(),
            "the embedded schema has no enum for {field}"
        );
    }
    assert!(schema_enum("owner").contains("lifecycle"));
}

#[test]
fn an_empty_install_is_covered_rather_than_failed() {
    let dir = tempfile::tempdir().expect("a temp dir");
    let rows = check_ownership(&dir.path().join(".claude"));
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].status, Status::Pass);
    assert_eq!(rows[0].detail, "0 artifacts, 100% governance coverage");
}

#[test]
fn an_ungoverned_rule_is_reported_against_its_path() {
    let dir = tempfile::tempdir().expect("a temp dir");
    let rules = dir.path().join(".claude").join("rules");
    std::fs::create_dir_all(&rules).expect("create the rules dir");
    std::fs::write(rules.join("core-behaviors.md"), "# Rules\n").expect("write the rule");
    let rows = check_ownership(&dir.path().join(".claude"));
    assert!(
        rows.iter()
            .any(|row| row.name == "Ownership: rules/core-behaviors.md"
                && row.detail.contains("no governance metadata (registry)")),
        "{rows:#?}"
    );
    assert_eq!(rows.last().expect("the coverage row").status, Status::Fail);
}
