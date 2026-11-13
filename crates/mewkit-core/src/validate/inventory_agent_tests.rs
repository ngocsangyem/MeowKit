//! Unit tests for `inventory_agent` — the inventory agent rules.
use super::*;

#[test]
fn a_hub_leaf_is_classified_by_its_id_prefix() {
    assert_eq!(
        agent_contract_fields("jira-issue"),
        ("domain", "hub-only", true)
    );
    assert_eq!(
        agent_contract_fields("developer"),
        ("core-support", "direct-only", true)
    );
    assert!(!agent_contract_fields("advisor").2);
}

#[test]
fn ownership_stops_at_the_next_heading() {
    let body = "## Exclusive Ownership\n\nOwns `src/one.rs` and `mk:skill`.\n\n## Other\n\nCites `docs/two.md`.\n";
    assert_eq!(agent_declared_artifacts(body), vec!["src/one.rs"]);
}

#[test]
fn without_a_section_the_whole_body_is_scanned() {
    let body = "Writes `tasks/plans/*`.\n";
    assert_eq!(agent_declared_artifacts(body), vec!["tasks/plans/*"]);
}

#[test]
fn a_trigger_owner_needs_both_a_verb_and_a_boundary() {
    assert!(trigger_owner("Use for X. Does not review code."));
    assert!(!trigger_owner("Use for X."));
    assert!(!trigger_owner("Never anything."));
}
