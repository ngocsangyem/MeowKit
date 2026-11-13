use super::bootstrap::BOOTSTRAP;
use super::lifecycle::{enforcement_gaps, gating_events};
use super::projection::is_projected_provider;

#[test]
fn only_proven_denies_gate() {
    assert_eq!(gating_events("claude-code"), ["pre_tool", "stop"]);
    assert!(gating_events("codex").is_empty());
    assert!(gating_events("nothing").is_empty());
}

#[test]
fn a_provider_without_a_proof_reports_every_safety_event_as_a_gap() {
    let events: Vec<&str> = enforcement_gaps("codex").iter().map(|g| g.event).collect();
    assert_eq!(events, ["pre_tool", "prompt_submitted", "stop"]);
    let claude: Vec<&str> = enforcement_gaps("claude-code")
        .iter()
        .map(|g| g.event)
        .collect();
    assert_eq!(claude, ["prompt_submitted"]);
}

#[test]
fn a_report_only_provider_is_not_projected() {
    assert!(is_projected_provider("codex"));
    assert!(!is_projected_provider("qwen"));
    assert!(!is_projected_provider("zed"));
}

#[test]
fn the_bootstrap_names_the_resolver_it_tells_agents_to_run() {
    assert!(BOOTSTRAP.contains("mewkit capabilities resolve --intent"));
}
