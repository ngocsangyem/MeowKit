//! Which mode is detected, and what the default run contains.
use std::fs;

use super::super::result::{Section, Status};
use super::{ValidateMode, build_default_checks, detect_validate_mode};

fn run(mode: ValidateMode, portable: bool) -> (tempfile::TempDir, Vec<super::CheckResult>) {
    let dir = tempfile::tempdir().expect("a temp dir");
    let results = build_default_checks(&dir.path().join(".claude"), dir.path(), mode, portable);
    (dir, results)
}

#[test]
fn the_cli_crate_is_what_makes_a_checkout_authoring() {
    let dir = tempfile::tempdir().expect("a temp dir");
    assert_eq!(detect_validate_mode(dir.path()), ValidateMode::FlatCopy);
    let manifest = dir.path().join(crate::kit_source::KIT_SOURCE_MARKER);
    fs::create_dir_all(manifest.parent().unwrap()).expect("create the crate dir");
    fs::write(&manifest, "[package]\nname = \"mewkit-cli\"\n").expect("write the manifest");
    assert_eq!(detect_validate_mode(dir.path()), ValidateMode::Authoring);
}

#[test]
fn a_mode_is_parsed_only_from_its_two_documented_spellings() {
    assert_eq!(
        ValidateMode::parse("authoring"),
        Some(ValidateMode::Authoring)
    );
    assert_eq!(
        ValidateMode::parse("flat-copy"),
        Some(ValidateMode::FlatCopy)
    );
    assert_eq!(ValidateMode::parse("Authoring"), None);
    assert_eq!(ValidateMode::parse(""), None);
}

#[test]
fn an_empty_project_fails_the_flat_copy_run_on_every_presence_row() {
    let (_dir, results) = run(ValidateMode::FlatCopy, false);
    // Two directories, seven always-on rules, and the hooks row.
    let failures = results.iter().filter(|r| r.status == Status::Fail).count();
    assert!(failures >= 10, "{results:#?}");
    assert!(
        results.iter().any(|r| r.section == Section::Memory),
        "the memory lint runs in a consumer install too"
    );
}

#[test]
fn the_flat_copy_run_covers_every_consumer_actionable_section() {
    let (_dir, results) = run(ValidateMode::FlatCopy, false);
    for section in [
        Section::Structure,
        Section::Hooks,
        Section::Docs,
        Section::Plugin,
        Section::Memory,
    ] {
        assert!(
            results.iter().any(|r| r.section == section),
            "no row in {}",
            section.heading()
        );
    }
    // And NOT the authoring-coherence sections: a consumer customizes rules/,
    // so those rows would be false failures in a healthy consumer install.
    for section in [
        Section::Workflow,
        Section::Gates,
        Section::Ownership,
        Section::Substrate,
        Section::Packs,
        Section::Inventory,
        Section::Rules,
        Section::Capabilities,
        Section::Agents,
    ] {
        assert!(
            !results.iter().any(|r| r.section == section),
            "{} must be suppressed in flat-copy mode",
            section.heading()
        );
    }
}

#[test]
fn the_authoring_run_adds_every_coherence_section() {
    let (_dir, results) = run(ValidateMode::Authoring, false);
    for section in [
        Section::Workflow,
        Section::Gates,
        Section::Portability,
        Section::Inventory,
        Section::Ownership,
        Section::Agents,
        Section::Substrate,
        Section::Packs,
        Section::Capabilities,
    ] {
        assert!(
            results.iter().any(|r| r.section == section),
            "no row in {}",
            section.heading()
        );
    }
    // `Rules` is deliberately absent here: the routing-breadth check produces
    // NO rows when there is no `rules/` directory at all, which is what an
    // empty fixture has. `routing_breadth_tests` covers it with one.
    assert!(!results.iter().any(|r| r.section == Section::Rules));
}

#[test]
fn portable_adds_the_provider_contract_rows_in_either_mode() {
    let (_dir, consumer) = run(ValidateMode::FlatCopy, true);
    assert!(
        consumer
            .iter()
            .any(|r| r.name.starts_with("Provider contract: ")),
        "the surface matrix is provider data, not project data"
    );
    assert!(
        consumer.iter().any(|r| r.name == "Portability coverage"),
        "the coverage summary makes the totals explicit"
    );
}

#[test]
fn a_codex_tree_under_portable_points_at_the_target_check() {
    let dir = tempfile::tempdir().expect("a temp dir");
    fs::create_dir_all(dir.path().join(".codex")).expect("create the codex tree");
    let claude = dir.path().join(".claude");
    let with = build_default_checks(&claude, dir.path(), ValidateMode::FlatCopy, true);
    let row = with
        .iter()
        .find(|r| r.name == "Codex projection")
        .expect("the pointer row");
    assert_eq!(row.status, Status::Na);
    assert!(row.detail.contains("--target codex"), "{}", row.detail);
    let without = build_default_checks(&claude, dir.path(), ValidateMode::FlatCopy, false);
    assert!(without.iter().all(|r| r.name != "Codex projection"));
}
