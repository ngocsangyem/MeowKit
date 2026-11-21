//! A family of copies is clean only while every member matches the canonical.
use std::fs;
use std::path::Path;

use super::super::result::Status;
use super::check_shared_families;

fn kit(manifest: &str, files: &[(&str, &str)]) -> tempfile::TempDir {
    let dir = tempfile::tempdir().expect("a temp dir");
    let claude = dir.path().join(".claude");
    fs::create_dir_all(&claude).expect("create .claude");
    fs::write(claude.join("shared-families.json"), manifest).expect("write the manifest");
    for (rel, body) in files {
        let path = claude.join(rel);
        fs::create_dir_all(path.parent().expect("a parent")).expect("create the dir");
        fs::write(path, body).expect("write a member");
    }
    dir
}

fn statuses(dir: &Path) -> Vec<Status> {
    check_shared_families(&dir.join(".claude"), Status::Warn)
        .iter()
        .map(|r| r.status)
        .collect()
}

const MANIFEST: &str = r#"{"families":[{"name":"protocols","canonical":"skills/a/p.md",
  "members":["skills/a/p.md","skills/b/p.md","skills/c/p.md"]}]}"#;

#[test]
fn identical_members_pass() {
    let dir = kit(
        MANIFEST,
        &[
            ("skills/a/p.md", "x"),
            ("skills/b/p.md", "x"),
            ("skills/c/p.md", "x"),
        ],
    );
    assert_eq!(statuses(dir.path()), vec![Status::Pass]);
}

#[test]
fn a_member_that_differs_is_reported_at_the_given_severity() {
    let dir = kit(
        MANIFEST,
        &[
            ("skills/a/p.md", "x"),
            ("skills/b/p.md", "y"),
            ("skills/c/p.md", "x"),
        ],
    );
    let rows = check_shared_families(&dir.path().join(".claude"), Status::Warn);
    assert_eq!(rows[0].status, Status::Warn);
    assert!(
        rows[0]
            .detail
            .contains("skills/b/p.md differs from skills/a/p.md")
    );
    assert!(!rows[0].detail.contains("skills/c/p.md"));
}

#[test]
fn a_missing_member_counts_as_drift() {
    let dir = kit(MANIFEST, &[("skills/a/p.md", "x"), ("skills/b/p.md", "x")]);
    let rows = check_shared_families(&dir.path().join(".claude"), Status::Warn);
    assert!(rows[0].detail.contains("skills/c/p.md is missing"));
}

#[test]
fn a_missing_canonical_or_escaping_path_fails() {
    let dir = kit(MANIFEST, &[("skills/b/p.md", "x")]);
    assert_eq!(statuses(dir.path()), vec![Status::Fail]);
    let escaping = r#"{"families":[{"name":"n","canonical":"../x","members":[]}]}"#;
    assert_eq!(statuses(kit(escaping, &[]).path()), vec![Status::Fail]);
}

#[test]
fn an_absent_manifest_is_not_applicable_and_bad_json_fails() {
    let dir = tempfile::tempdir().expect("a temp dir");
    fs::create_dir_all(dir.path().join(".claude")).expect("create .claude");
    assert_eq!(statuses(dir.path()), vec![Status::Na]);
    assert_eq!(statuses(kit("{", &[]).path()), vec![Status::Fail]);
}
