//! Unit tests for `operations` — the operations rules.
use super::*;

#[test]
fn no_logical_operation_is_frontmatter_reachable() {
    // The invariant itself: if someone adds `run_shell` to the invocation
    // enum to make a skill resolve, this fails instead of handing
    // author-controlled frontmatter a shell.
    assert!(assert_operations_not_invocable().is_empty());
}

#[test]
fn a_scoped_tool_resolves_to_its_base_operation() {
    assert_eq!(base_tool_name("Bash(git:*)"), "Bash");
    assert_eq!(operation_of_tool("Bash"), Some("run_shell"));
    assert_eq!(operation_of_tool("Read"), None);
}

#[test]
fn codex_claims_nothing_it_cannot_do() {
    assert_eq!(
        support_of("codex", "delegate_agent"),
        OperationSupport::Unsupported
    );
    assert_eq!(support_of("codex", "run_shell"), OperationSupport::Unknown);
    assert_eq!(
        support_of("codex", "ask_user"),
        OperationSupport::LocalFallback
    );
    assert_eq!(
        support_of("claude-plugin", "ask_user"),
        OperationSupport::Supported
    );
    assert_eq!(support_of("emacs", "ask_user"), OperationSupport::Unknown);
}

#[test]
fn only_a_hard_gap_blocks() {
    let finding = |support| OperationConformanceFinding {
        skill: "mk:x".to_string(),
        operation: "ask_user",
        provider: "codex",
        support,
    };
    assert!(is_blocking_gap(&finding(OperationSupport::Unsupported)));
    assert!(is_blocking_gap(&finding(OperationSupport::Unknown)));
    assert!(!is_blocking_gap(&finding(OperationSupport::LocalFallback)));
}
