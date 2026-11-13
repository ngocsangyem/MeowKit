//! Unit tests for `runtime_contract` — the runtime contract rules.
use super::*;
use serde_json::json;

fn meta(value: Value) -> Map<String, Value> {
    value.as_object().expect("an object").clone()
}

#[test]
fn an_interpreter_in_the_runtime_field_is_an_error() {
    assert_eq!(
        runtime_contract_errors(&meta(json!({"runtime": "python"}))),
        vec!["'runtime: python' names an interpreter — use 'requires_runtime' for that"]
    );
}

#[test]
fn an_environment_in_the_interpreter_field_is_the_mirror_error() {
    assert_eq!(
        runtime_contract_errors(&meta(json!({"requires_runtime": "claude-code"}))),
        vec![
            "'requires_runtime: claude-code' names an execution environment — use 'runtime' for that"
        ]
    );
}

#[test]
fn a_version_range_keeps_its_family() {
    assert!(runtime_contract_errors(&meta(json!({"requires_runtime": "python>=3.9"}))).is_empty());
    assert_eq!(
        runtime_contract_errors(&meta(json!({"requires_runtime": ["cobol"]}))),
        vec!["'requires_runtime: cobol' names no known interpreter"]
    );
}

#[test]
fn a_documented_script_is_the_one_that_obliges_a_declaration() {
    let dir = tempfile::tempdir().expect("a temp dir");
    let skill = dir.path();
    std::fs::create_dir_all(skill.join("scripts")).expect("create the scripts dir");
    std::fs::write(skill.join("scripts").join("run.py"), "print(1)\n").expect("write a script");
    std::fs::write(skill.join("scripts").join("quiet.py"), "print(2)\n").expect("write a script");
    std::fs::write(skill.join("SKILL.md"), "Run `scripts/run.py` to start.\n")
        .expect("write the skill");
    let scripts = documented_python_scripts(skill);
    assert_eq!(scripts.len(), 1, "{scripts:?}");
    assert!(scripts[0].ends_with("run.py"));
}

#[test]
fn a_test_script_and_a_tests_directory_are_skipped() {
    let dir = tempfile::tempdir().expect("a temp dir");
    let skill = dir.path();
    std::fs::create_dir_all(skill.join("tests")).expect("create the tests dir");
    std::fs::write(skill.join("tests").join("case.py"), "").expect("write a test");
    std::fs::write(skill.join("test_run.py"), "").expect("write a test");
    std::fs::write(
        skill.join("SKILL.md"),
        "Mentions case.py and test_run.py.\n",
    )
    .expect("write the skill");
    assert!(documented_python_scripts(skill).is_empty());
}
