//! Declared counts versus the inventory, and the completeness rows.
use std::fs;
use std::path::Path;

use super::super::result::Status;
use super::{check_stale_index, compare_counts, missing_rows};

/// A repo with one skill and one agent, plus the docs that count them.
fn repo(readme: &str, skills_index: &str, agents_index: &str) -> tempfile::TempDir {
    let dir = tempfile::tempdir().expect("a temp dir");
    let claude = dir.path().join(".claude");
    let skill = claude.join("skills").join("cook");
    fs::create_dir_all(&skill).expect("create the skill dir");
    fs::write(skill.join("SKILL.md"), "---\nname: mk:cook\n---\n").expect("write the skill");
    fs::create_dir_all(claude.join("agents")).expect("create the agents dir");
    fs::write(
        claude.join("agents").join("developer.md"),
        "---\nname: developer\n---\n",
    )
    .expect("write the agent");
    fs::write(dir.path().join("README.md"), readme).expect("write the readme");
    fs::write(claude.join("agents").join("SKILLS_INDEX.md"), skills_index)
        .expect("write the skills index");
    fs::write(claude.join("agents").join("AGENTS_INDEX.md"), agents_index)
        .expect("write the agents index");
    dir
}

fn labels(dir: &Path) -> Vec<String> {
    compare_counts(dir)
        .into_iter()
        .map(|diff| format!("{}|{}|{:?}", diff.source, diff.label, diff.declared))
        .collect()
}

#[test]
fn a_missing_count_token_is_itself_a_failure() {
    // Never pass-on-no-match: a claim that was deleted has to be noticed.
    let dir = repo("# Kit\n", "", "");
    let found = labels(dir.path());
    assert!(
        found
            .iter()
            .any(|entry| entry.contains("skills (token not found)|None")),
        "{found:?}"
    );
}

#[test]
fn a_declared_count_that_matches_the_inventory_produces_no_diff() {
    let dir = repo(
        "1 skills, 1 agents, 0 rules, 0 hook scripts\n",
        "**Total**|**1**\n",
        "[1]{agent_file\n",
    );
    let diffs: Vec<String> = labels(dir.path())
        .into_iter()
        .filter(|entry| entry.starts_with("README.md") || entry.starts_with(".claude/agents"))
        .collect();
    assert!(diffs.is_empty(), "{diffs:?}");
}

#[test]
fn a_wrong_count_names_both_numbers() {
    let dir = repo(
        "7 skills, 1 agents, 0 rules, 0 hook scripts\n",
        "**Total**|**1**\n",
        "[1]{agent_file\n",
    );
    let rows = check_stale_index(dir.path());
    assert!(
        rows.iter()
            .any(|row| row.name == "Count drift: README.md (skills)"
                && row.detail == "declared 7, found 1"),
        "{rows:#?}"
    );
    assert!(rows.iter().all(|row| row.status == Status::Fail));
}

#[test]
fn an_artifact_missing_from_its_index_is_listed_by_id() {
    let dir = repo(
        "1 skills, 1 agents, 0 rules, 0 hook scripts\n",
        "**Total**|**1**\n",
        "[1]{agent_file\n",
    );
    let missing = missing_rows(dir.path());
    let skills = missing
        .iter()
        .find(|(source, _, _)| source == ".claude/agents/SKILLS_INDEX.md")
        .expect("the skills index row");
    assert_eq!(skills.2, vec!["mk:cook".to_string()]);
    let rows = check_stale_index(dir.path());
    assert!(
        rows.iter().any(
            |row| row.name == "Index incomplete: .claude/agents/SKILLS_INDEX.md"
                && row.detail == "1 skill(s) missing: mk:cook"
        ),
        "{rows:#?}"
    );
}

#[test]
fn a_fully_reconciled_repo_reports_one_pass() {
    let dir = repo(
        "1 skills, 1 agents, 0 rules, 0 hook scripts\n",
        "**Total**|**1**\n\nmk:cook\n",
        "[1]{agent_file\n\ndeveloper\n",
    );
    // The architecture overview and the hooks index are absent here, so their
    // tokens are "not found" — which is a failure by design. Add them.
    fs::create_dir_all(dir.path().join("docs").join("core")).expect("create the docs dir");
    fs::write(
        dir.path()
            .join("docs")
            .join("core")
            .join("meowkit-architecture.md"),
        "1 domain skills and 0 rule files\n",
    )
    .expect("write the architecture doc");
    fs::create_dir_all(dir.path().join(".claude").join("hooks")).expect("create the hooks dir");
    fs::write(
        dir.path()
            .join(".claude")
            .join("hooks")
            .join("HOOKS_INDEX.md"),
        "0 node hooks\n",
    )
    .expect("write the hooks index");
    let rows = check_stale_index(dir.path());
    assert_eq!(rows.len(), 1, "{rows:#?}");
    assert_eq!(rows[0].status, Status::Pass);
    assert_eq!(rows[0].detail, "README + index files match the inventory");
}
