//! Which `docs/…` tokens are found, and which of them are allowed.
use std::fs;
use std::path::Path;

use super::super::docs_refs_rows::check_docs_refs_contract;
use super::super::result::Status;
use super::{RefLevel, check_docs_references, extract_tokens};

const CONTRACT: &str = "\
# Contract

<!-- ALLOWLIST-START -->
docs/project-context.md
docs/architecture/
# a comment line is not an entry
<!-- ALLOWLIST-END -->

<!-- RESERVED-START -->
docs/future-thing.md
<!-- RESERVED-END -->
";

fn project_with_contract(skill_body: &str) -> tempfile::TempDir {
    let dir = tempfile::tempdir().expect("a temp dir");
    let maintainer = dir.path().join("docs").join("maintainer");
    fs::create_dir_all(&maintainer).expect("create the docs dir");
    fs::write(maintainer.join("docs-reference-contract.md"), CONTRACT).expect("write the contract");
    let skill = dir.path().join(".claude").join("skills").join("cook");
    fs::create_dir_all(&skill).expect("create the skill dir");
    fs::write(skill.join("SKILL.md"), skill_body).expect("write the skill");
    dir
}

fn claude(dir: &Path) -> std::path::PathBuf {
    dir.join(".claude")
}

#[test]
fn a_url_is_not_a_docs_path() {
    assert!(extract_tokens("see https://example.com/docs/internal.md for more").is_empty());
}

#[test]
fn a_trailing_full_stop_is_not_part_of_the_token() {
    assert_eq!(
        extract_tokens("read docs/project-context.md."),
        vec!["docs/project-context.md"]
    );
}

#[test]
fn an_angle_bracketed_placeholder_is_stripped() {
    assert!(extract_tokens("<docs/anything.md>").is_empty());
}

#[test]
fn an_absent_contract_makes_the_check_not_applicable() {
    let dir = tempfile::tempdir().expect("a temp dir");
    let result = check_docs_references(&claude(dir.path()));
    assert!(result.not_applicable);
    // Rendered as a PASS row, so a consumer install does not fail for lacking
    // a maintainer-only document.
    let rows = check_docs_refs_contract(&claude(dir.path()));
    assert_eq!(rows[0].status, Status::Pass);
    assert!(rows[0].detail.starts_with("N/A — "), "{}", rows[0].detail);
}

#[test]
fn an_allowlisted_path_and_an_allowlisted_prefix_both_pass() {
    let dir = project_with_contract(
        "See docs/project-context.md and docs/architecture/system-architecture.md.\n",
    );
    let result = check_docs_references(&claude(dir.path()));
    assert_eq!(result.scanned_files, 1);
    assert!(result.findings.is_empty(), "{:?}", result.findings);
    assert_eq!(
        check_docs_refs_contract(&claude(dir.path()))[0].status,
        Status::Pass
    );
}

#[test]
fn an_unknown_path_is_an_error_and_a_reserved_one_is_a_warning() {
    let dir = project_with_contract("docs/secret-plan.md and docs/future-thing.md\n");
    let result = check_docs_references(&claude(dir.path()));
    assert_eq!(result.error_count, 1);
    assert_eq!(result.warn_count, 1);
    assert_eq!(result.findings[0].level, RefLevel::Error);
    assert_eq!(result.findings[0].line, 1);
    assert_eq!(result.findings[0].file, "skills/cook/SKILL.md");
    assert_eq!(result.findings[1].level, RefLevel::Warn);

    let rows = check_docs_refs_contract(&claude(dir.path()));
    assert_eq!(rows[0].status, Status::Fail);
    assert!(
        rows[0]
            .detail
            .contains("skills/cook/SKILL.md:1: docs/secret-plan.md"),
        "{}",
        rows[0].detail
    );
}

#[test]
fn a_reserved_path_alone_warns_without_failing() {
    let dir = project_with_contract("docs/future-thing.md\n");
    let rows = check_docs_refs_contract(&claude(dir.path()));
    assert_eq!(rows[0].status, Status::Warn);
    assert_eq!(rows[0].detail, "Scanned 1 files — 0 error(s), 1 warning(s)");
}

#[test]
fn the_skill_that_defines_the_bans_is_exempt() {
    let dir = project_with_contract("docs/project-context.md\n");
    let references = claude(dir.path())
        .join("skills")
        .join("skill-creator")
        .join("references");
    fs::create_dir_all(&references).expect("create the references dir");
    fs::write(
        references.join("skill-authoring-rules.md"),
        "never write docs/not-a-real-doc.md\n",
    )
    .expect("write the rules");
    let result = check_docs_references(&claude(dir.path()));
    // Scanned (it is counted) but not judged.
    assert_eq!(result.scanned_files, 2);
    assert!(result.findings.is_empty(), "{:?}", result.findings);
}

#[test]
fn a_test_fixture_directory_is_not_scanned() {
    let dir = project_with_contract("docs/project-context.md\n");
    let tests = claude(dir.path()).join("skills").join("cook").join("tests");
    fs::create_dir_all(&tests).expect("create the tests dir");
    fs::write(tests.join("case.md"), "docs/whatever-fixture.md\n").expect("write the fixture");
    let result = check_docs_references(&claude(dir.path()));
    assert_eq!(result.scanned_files, 1);
    assert!(result.findings.is_empty(), "{:?}", result.findings);
}
