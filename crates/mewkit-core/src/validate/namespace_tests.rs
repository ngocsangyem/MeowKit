//! Agents bare, skills `mk:`-scoped, and every `subagent_type` resolvable.
use std::fs;
use std::path::Path;

use super::super::result::Status;
use super::{check_plugin_namespace, collect_agent_names};

fn install(agents: &[(&str, &str)], skills: &[(&str, &str)]) -> tempfile::TempDir {
    let dir = tempfile::tempdir().expect("a temp dir");
    let claude = dir.path().join(".claude");
    fs::create_dir_all(claude.join("agents")).expect("create the agents dir");
    for (file, body) in agents {
        fs::write(claude.join("agents").join(file), body).expect("write an agent");
    }
    for (name, body) in skills {
        let skill = claude.join("skills").join(name);
        fs::create_dir_all(&skill).expect("create a skill dir");
        fs::write(skill.join("SKILL.md"), body).expect("write a skill");
    }
    dir
}

fn claude(dir: &Path) -> std::path::PathBuf {
    dir.join(".claude")
}

#[test]
fn an_agent_name_is_read_from_the_frontmatter_line() {
    let dir = install(
        &[
            (
                "developer.md",
                "---\nname: developer\ndescription: x\n---\n",
            ),
            ("tester.md", "---\nname: \"tester\"\n---\n"),
            ("notes.txt", "name: ignored\n"),
        ],
        &[],
    );
    let names = collect_agent_names(&claude(dir.path()).join("agents"));
    assert_eq!(names, vec!["developer", "tester"]);
}

#[test]
fn a_clean_install_passes_all_three_rows() {
    let dir = install(
        &[("developer.md", "---\nname: developer\n---\n")],
        &[(
            "cook",
            "---\nname: mk:cook\n---\nDelegate with subagent_type: developer.\n",
        )],
    );
    let rows = check_plugin_namespace(&claude(dir.path()));
    assert_eq!(rows.len(), 3);
    assert!(rows.iter().all(|r| r.status == Status::Pass), "{rows:?}");
    assert_eq!(rows[0].detail, "1 agents, none namespaced");
}

#[test]
fn a_namespaced_agent_name_fails() {
    let dir = install(&[("developer.md", "---\nname: mk:developer\n---\n")], &[]);
    let rows = check_plugin_namespace(&claude(dir.path()));
    assert_eq!(rows[0].status, Status::Fail);
    assert_eq!(rows[0].detail, "unexpectedly namespaced: mk:developer");
}

#[test]
fn a_non_mk_skill_name_is_a_leak() {
    let dir = install(&[], &[("cook", "---\nname: other:cook\n---\n")]);
    let rows = check_plugin_namespace(&claude(dir.path()));
    assert_eq!(rows[1].status, Status::Fail);
    assert_eq!(rows[1].detail, "non-mk: skill names: cook → other:cook");
}

#[test]
fn a_built_in_host_agent_type_resolves_without_being_a_kit_agent() {
    let dir = install(
        &[],
        &[("cook", "---\nname: mk:cook\n---\nsubagent_type=Explore\n")],
    );
    assert_eq!(
        check_plugin_namespace(&claude(dir.path()))[2].status,
        Status::Pass
    );
}

#[test]
fn an_unknown_subagent_reference_warns_and_names_the_file() {
    let dir = install(
        &[],
        &[(
            "cook",
            "---\nname: mk:cook\n---\nsubagent_type: ghost-agent\n",
        )],
    );
    let rows = check_plugin_namespace(&claude(dir.path()));
    // A WARN, not a FAIL: the reference may name an agent a consumer removed,
    // and that is a routing gap to report rather than a broken install.
    assert_eq!(rows[2].status, Status::Warn);
    assert!(
        rows[2]
            .detail
            .contains("skills/cook/SKILL.md → ghost-agent"),
        "{}",
        rows[2].detail
    );
}

#[test]
fn a_reference_in_an_unscanned_file_type_is_ignored() {
    let dir = install(&[], &[("cook", "---\nname: mk:cook\n---\n")]);
    fs::write(
        claude(dir.path())
            .join("skills")
            .join("cook")
            .join("notes.txt"),
        "subagent_type: ghost-agent\n",
    )
    .expect("write the note");
    assert_eq!(
        check_plugin_namespace(&claude(dir.path()))[2].status,
        Status::Pass
    );
}
