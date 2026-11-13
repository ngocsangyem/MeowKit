//! Unit tests for `agent_views` — the agent views rules.
use super::*;

#[test]
fn two_verdict_patterns_collide_only_when_identical() {
    assert!(artifact_patterns_overlap(
        "tasks/reviews/*-verdict.md",
        "tasks/reviews/*-verdict.md"
    ));
    assert!(!artifact_patterns_overlap(
        "tasks/reviews/*-verdict.md",
        "tasks/reviews/*-evalverdict.md"
    ));
}

#[test]
fn a_compatible_prefix_and_suffix_overlap() {
    assert!(artifact_patterns_overlap("src/*", "src/api/*"));
    assert!(artifact_patterns_overlap("tasks/*.md", "tasks/plans/*.md"));
    assert!(!artifact_patterns_overlap("src/*.rs", "docs/*.md"));
}

#[test]
fn a_pattern_without_a_star_is_an_exact_path() {
    assert!(artifact_patterns_overlap("src/one.rs", "src/one.rs"));
    assert!(!artifact_patterns_overlap("src/one.rs", "src/two.rs"));
}
