//! Unit tests for `pseudo_capabilities` — the pseudo capabilities rules.
use super::*;

fn with_prose(body: &str) -> tempfile::TempDir {
    let dir = tempfile::tempdir().expect("a temp dir");
    std::fs::write(dir.path().join("skill.md"), body).expect("write the prose");
    dir
}

#[test]
fn an_unsubstituted_placeholder_is_found_with_its_line() {
    let dir = with_prose("# Skill\n\nUse the manage_plan capability here.\n");
    let findings = find_pseudo_capabilities(dir.path());
    assert_eq!(findings.len(), 1);
    assert_eq!(findings[0].line, 3);
    assert_eq!(findings[0].found, "manage_plan capability");
}

#[test]
fn naming_the_operation_alone_is_legitimate_prose() {
    let dir = with_prose("The run_shell operation is adapter-internal.\n");
    assert!(find_pseudo_capabilities(dir.path()).is_empty());
}

#[test]
fn the_marker_lets_the_rules_own_prose_quote_the_anti_pattern() {
    let dir = with_prose(
        "Never write `delegate_agent capability`. <!-- lint-allow-pseudo-capability -->\n",
    );
    assert!(find_pseudo_capabilities(dir.path()).is_empty());
}

#[test]
fn only_markdown_is_scanned() {
    let dir = with_prose("clean\n");
    std::fs::write(dir.path().join("script.cjs"), "ask_user capability\n").expect("write a script");
    assert!(find_pseudo_capabilities(dir.path()).is_empty());
}
