//! Unit tests for the status-block rule in `agent_conformance`.
use std::fs;

use super::super::result::Status;
use super::check_agent_conformance;

fn agent_file(body: &str) -> String {
    format!(
        "---\nname: sample\ndescription: Does a thing. Not for other things.\ntools: Read, Grep\nowner: testing\ncriticality: low\nstatus: active\nruntime: claude-code\n---\n\n{body}\n"
    )
}

fn status_rows(body: &str) -> Vec<(String, Status)> {
    let dir = tempfile::tempdir().expect("a temp dir");
    let agents = dir.path().join(".claude/agents");
    fs::create_dir_all(&agents).expect("create the agents dir");
    fs::write(agents.join("sample.md"), agent_file(body)).expect("write the agent");
    check_agent_conformance(dir.path())
        .into_iter()
        .filter(|row| row.name.starts_with("Agent status block"))
        .map(|row| (row.name, row.status))
        .collect()
}

#[test]
fn an_agent_without_the_status_block_fails() {
    let rows = status_rows("You review things.");
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].1, Status::Fail);
}

#[test]
fn an_agent_citing_the_a1_block_passes() {
    let rows = status_rows(
        "End with the A1 status block exactly as defined in `.claude/rules/agent-conduct.md` (A1).",
    );
    assert!(rows.is_empty());
}
