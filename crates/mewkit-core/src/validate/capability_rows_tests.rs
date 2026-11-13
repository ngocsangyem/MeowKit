//! Unit tests for `capability_rows` — the capability rows rules.
use super::*;

fn entry(id: &str, intents: &[&str], authored: bool) -> CapabilityEntry {
    CapabilityEntry {
        id: id.to_string(),
        kind: "skill",
        aliases: Vec::new(),
        source_path: Some(format!("skills/{id}/SKILL.md")),
        inventory_id: Some(id.to_string()),
        owner: String::new(),
        intents: intents.iter().map(|i| (*i).to_string()).collect(),
        invocation_kind: "skill",
        invocation_id: "invoke-skill",
        upstream: Vec::new(),
        intents_authored: authored,
    }
}

#[test]
fn only_capabilities_with_intents_reach_the_view() {
    let rendered = render_capability_view(&[
        entry("mk:cook", &["build this"], true),
        entry("mk:quiet", &[], false),
    ]);
    assert!(rendered.contains("`mk:cook`") && rendered.contains("authored"));
    assert!(!rendered.contains("mk:quiet"));
}

#[test]
fn a_pipe_in_an_intent_is_escaped_so_the_table_survives() {
    let rendered = render_capability_view(&[entry("mk:x", &["a | b"], false)]);
    assert!(rendered.contains(r"a \| b"), "{rendered}");
}

#[test]
fn a_doc_without_markers_is_not_drift() {
    assert_eq!(
        capability_view_drift("# Registry\n", &[]),
        ViewDriftState::AbsentMarkers
    );
}

#[test]
fn a_spliced_region_is_compared_trimmed() {
    let entries = vec![entry("mk:cook", &["build this"], true)];
    let doc = format!(
        "# Registry\n\n{VIEW_START}\n\n{}\n\n{VIEW_END}\n",
        render_capability_view(&entries)
    );
    assert_eq!(
        capability_view_drift(&doc, &entries),
        ViewDriftState::InSync
    );
    let stale = format!("{VIEW_START}\n| old |\n{VIEW_END}");
    assert_eq!(
        capability_view_drift(&stale, &entries),
        ViewDriftState::Drift
    );
}
