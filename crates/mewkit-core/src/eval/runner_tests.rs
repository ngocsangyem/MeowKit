use std::time::{Duration, Instant};

use super::runner::*;
use super::*;

fn spec<'a>(runtime: Runtime, tools: &'a [String]) -> RunSpec<'a> {
    RunSpec {
        runtime,
        model: "m-1",
        prompt: "do it",
        tools,
        max_turns: 8,
    }
}

#[test]
fn claude_command_pins_model_and_format_and_lists_tools() {
    let (program, args) = command_line(&spec(Runtime::ClaudeCode, &[]));
    assert_eq!(program, "claude");
    assert_eq!(&args[..2], ["-p", "do it"]);
    let joined = args.join(" ");
    for part in [
        "--model m-1",
        "--output-format stream-json --verbose",
        "--setting-sources project",
        "--max-turns 8",
        "--disallowedTools WebFetch WebSearch",
        "--allowedTools Skill Read Glob Grep",
    ] {
        assert!(joined.contains(part), "{part} missing in {joined}");
    }
    for widening in [
        "--dangerously-skip-permissions",
        "bypassPermissions",
        "--permission-mode",
    ] {
        assert!(!joined.contains(widening), "{widening}");
    }
}

#[test]
fn codex_is_read_only_unless_the_case_needs_writes() {
    let (program, args) = command_line(&spec(Runtime::Codex, &[]));
    assert_eq!(program, "codex");
    assert!(args.join(" ").contains("-s read-only"));
    let tools = vec!["Read".to_owned(), "Edit".to_owned()];
    let (_, args) = command_line(&spec(Runtime::Codex, &tools));
    let joined = args.join(" ");
    assert!(joined.contains("-s workspace-write"));
    assert!(!joined.contains("danger"), "{joined}");
    assert_eq!(args.last().map(String::as_str), Some("do it"));
}

#[test]
fn case_tools_replace_the_default_list() {
    let tools = vec!["Skill".to_owned(), "Write".to_owned()];
    let (_, args) = command_line(&spec(Runtime::ClaudeCode, &tools));
    assert!(args.join(" ").ends_with("--allowedTools Skill Write"));
}

#[cfg(unix)]
#[test]
fn a_child_past_its_deadline_is_killed() {
    let dir = tempfile::tempdir().expect("tmp");
    let started = Instant::now();
    let err = run_child(
        "/bin/sleep",
        &["30".to_owned()],
        &[],
        dir.path(),
        &dir.path().join("o"),
        Duration::from_secs(1),
    )
    .expect_err("times out");
    assert!(matches!(err, ChildError::Timeout(1)), "{err}");
    assert!(started.elapsed() < Duration::from_secs(10));
}

#[test]
fn a_missing_program_is_a_spawn_error() {
    let dir = tempfile::tempdir().expect("tmp");
    let err = run_child(
        "mewkit-no-such-program",
        &[],
        &[],
        dir.path(),
        &dir.path().join("o"),
        Duration::from_secs(1),
    )
    .expect_err("no program");
    assert!(matches!(err, ChildError::Spawn { .. }), "{err}");
}

#[test]
fn backoff_grows() {
    assert_eq!(backoff(1), Duration::from_secs(2));
    assert_eq!(backoff(2), Duration::from_secs(8));
}
