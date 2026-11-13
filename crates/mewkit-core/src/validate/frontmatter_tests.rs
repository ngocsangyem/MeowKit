//! Which frontmatter is an error, which is only an advisory.
use std::fs;
use std::path::Path;

use super::super::frontmatter_rows::check_frontmatter_contract;
use super::super::result::Status;
use super::check_skill_frontmatter;

fn project(skills: &[(&str, &str)]) -> tempfile::TempDir {
    let dir = tempfile::tempdir().expect("a temp dir");
    for (name, body) in skills {
        let skill = dir.path().join(".claude").join("skills").join(name);
        fs::create_dir_all(&skill).expect("create the skill dir");
        fs::write(skill.join("SKILL.md"), *body).expect("write the skill");
    }
    if skills.is_empty() {
        fs::create_dir_all(dir.path().join(".claude").join("skills"))
            .expect("create the skills dir");
    }
    dir
}

/// The minimum a SKILL.md needs to satisfy the shipped schema.
fn valid(name: &str) -> String {
    format!(
        "---\nname: mk:{name}\ndescription: A skill that does one thing well enough to describe.\nwhen_to_use: When the thing is needed.\n---\n\nProse.\n"
    )
}

fn errors(dir: &Path) -> Vec<String> {
    check_skill_frontmatter(dir).errors
}

#[test]
fn an_absent_skills_tree_is_fatal_rather_than_an_empty_pass() {
    let dir = tempfile::tempdir().expect("a temp dir");
    let report = check_skill_frontmatter(dir.path());
    assert!(report.fatal.is_some());
    let rows = check_frontmatter_contract(dir.path());
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].status, Status::Fail);
    assert!(rows[0].detail.starts_with("No skills dir at "));
}

#[test]
fn a_tree_with_no_skills_fails_rather_than_passing_zero() {
    let dir = project(&[]);
    let rows = check_frontmatter_contract(dir.path());
    assert_eq!(rows[0].status, Status::Fail);
    assert_eq!(
        rows[0].detail,
        "Zero SKILL.md files found under .claude/skills/"
    );
}

#[test]
fn a_valid_skill_passes_and_is_counted() {
    let dir = project(&[("cook", &valid("cook"))]);
    let rows = check_frontmatter_contract(dir.path());
    assert_eq!(rows.len(), 1, "{rows:#?}");
    assert_eq!(rows[0].status, Status::Pass);
    assert_eq!(
        rows[0].detail,
        "1 skill(s) validated against skill-schema.json"
    );
}

#[test]
fn a_missing_frontmatter_block_is_an_error() {
    let dir = project(&[("cook", "# Cook\n\nNo block.\n")]);
    let found = errors(dir.path());
    assert_eq!(found.len(), 1);
    assert!(found[0].ends_with(": no YAML frontmatter"), "{found:?}");
}

#[test]
fn the_runtime_contract_is_checked_before_the_schema() {
    // Both would fire; the contract's message is the one that tells an author
    // which of the two fields they wanted.
    let dir = project(&[(
        "cook",
        "---\nname: mk:cook\ndescription: Something long enough to describe a skill.\nruntime: python\n---\n",
    )]);
    let found = errors(dir.path());
    assert_eq!(found.len(), 1, "{found:?}");
    assert!(
        found[0].contains("names an interpreter — use 'requires_runtime' for that"),
        "{found:?}"
    );
}

#[test]
fn a_documented_python_script_obliges_a_runtime_declaration() {
    let dir = project(&[("cook", &valid("cook"))]);
    let skill = dir.path().join(".claude").join("skills").join("cook");
    fs::create_dir_all(skill.join("scripts")).expect("create the scripts dir");
    fs::write(skill.join("scripts").join("run.py"), "print(1)\n").expect("write the script");
    fs::write(
        skill.join("SKILL.md"),
        format!("{}\nRun `scripts/run.py`.\n", valid("cook")),
    )
    .expect("document the script");
    let found = errors(dir.path());
    assert_eq!(found.len(), 1, "{found:?}");
    assert!(
        found[0].contains("declares no 'requires_runtime'"),
        "{found:?}"
    );
}

#[test]
fn a_schema_violation_reports_the_first_one_with_its_path() {
    let dir = project(&[("cook", "---\nname: cook\ndescription: short\n---\n")]);
    let found = errors(dir.path());
    assert_eq!(found.len(), 1, "{found:?}");
    assert!(found[0].contains("(path: ["), "{found:?}");
}

#[test]
fn a_missing_recommended_field_is_only_an_advisory() {
    let dir = project(&[(
        "cook",
        "---\nname: mk:cook\ndescription: A skill that does one thing well enough to describe.\n---\n",
    )]);
    let report = check_skill_frontmatter(dir.path());
    assert!(report.errors.is_empty(), "{:?}", report.errors);
    assert_eq!(report.valid, 1);
    assert!(
        report.warnings[0].ends_with("recommended field 'when_to_use' missing"),
        "{:?}",
        report.warnings
    );
    let rows = check_frontmatter_contract(dir.path());
    assert_eq!(rows[0].status, Status::Pass);
    assert_eq!(rows[1].status, Status::Warn);
    assert!(rows[1].detail.starts_with("1 warning(s)"));
}

#[test]
fn an_external_service_entrypoint_is_advised_to_declare_itself() {
    let dir = project(&[(
        "jira",
        &format!("{}\nSet MEOW_JIRA_URL first.\n", valid("jira")),
    )]);
    let report = check_skill_frontmatter(dir.path());
    assert!(
        report
            .warnings
            .iter()
            .any(|warning| warning.contains("missing 'requires_external_service'")),
        "{:?}",
        report.warnings
    );
}
