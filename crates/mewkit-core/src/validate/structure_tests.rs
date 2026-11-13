//! The presence rows, and the one row that is a WARN by design.
use std::fs;

use super::super::result::Status;
use super::{always_on_rule_paths, check_config, check_dir_exists, check_file_exists};
use crate::validate::Section;

fn project() -> tempfile::TempDir {
    let dir = tempfile::tempdir().expect("a temp dir");
    fs::create_dir_all(dir.path().join(".claude").join("rules")).expect("create the rules dir");
    dir
}

#[test]
fn the_always_on_set_is_the_seven_rule_files() {
    let paths = always_on_rule_paths();
    assert_eq!(paths.len(), 7);
    assert!(paths.contains(&"rules/injection-rules.md".to_string()));
    assert!(paths.iter().all(|p| p.starts_with("rules/")));
}

#[test]
fn a_missing_file_names_the_path_it_looked_for() {
    let project = project();
    let claude = project.path().join(".claude");
    let row = check_file_exists(&claude, "rules/gate-rules.md", Section::Structure);
    assert_eq!(row.status, Status::Fail);
    assert!(row.detail.starts_with("Missing: "), "{}", row.detail);
    assert!(row.detail.ends_with("gate-rules.md"), "{}", row.detail);
}

#[test]
fn a_file_where_a_directory_is_expected_is_not_a_directory() {
    let project = project();
    let claude = project.path().join(".claude");
    fs::write(claude.join("agents"), "not a directory").expect("write the decoy");
    assert_eq!(check_dir_exists(&claude, "agents").status, Status::Fail);
}

#[test]
fn an_absent_config_warns_rather_than_failing() {
    // A project with no config runs on its defaults, which is not a defect.
    let project = project();
    let row = check_config(&project.path().join(".claude"));
    assert_eq!(row.status, Status::Warn);
    assert!(
        row.detail
            .ends_with("absent — every setting is at its default"),
        "{}",
        row.detail
    );
}

#[test]
fn a_leftover_v2_descriptor_warns_with_the_upgrade_to_run() {
    let project = project();
    fs::create_dir_all(project.path().join(".meowkit")).expect("create the state dir");
    fs::write(project.path().join(".meowkit").join("config.json"), "{}\n")
        .expect("write the descriptor");
    let row = check_config(&project.path().join(".claude"));
    assert_eq!(row.status, Status::Warn);
    assert!(
        row.detail.contains("run `mewkit upgrade`"),
        "{}",
        row.detail
    );
}

#[test]
fn an_invalid_config_fails_with_the_readers_own_code() {
    let project = project();
    let meowkit = project.path().join(".meowkit");
    fs::create_dir_all(&meowkit).expect("create the state dir");
    fs::write(meowkit.join("config.yaml"), "telemetry: [1, 2, 3]\n").expect("write the config");
    let row = check_config(&project.path().join(".claude"));
    assert_eq!(row.status, Status::Fail);
    // The bracketed code is what a reader greps for; the message is the
    // config reader's own, shared with the hook that parses the same file.
    assert!(row.detail.ends_with(']'), "{}", row.detail);
}
