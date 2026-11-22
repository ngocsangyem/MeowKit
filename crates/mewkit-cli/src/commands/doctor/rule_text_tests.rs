use std::fs;
use std::path::Path;

use super::*;

/// A project holding the kit's registry and the six rules, each `"rule <name>\n"`.
fn kit_project() -> tempfile::TempDir {
    let dir = tempfile::tempdir().expect("tempdir");
    let root = dir.path();
    fs::create_dir_all(root.join(".claude/hooks")).unwrap();
    fs::write(root.join(REGISTRY), "{\"handlers\":[]}").unwrap();
    fs::create_dir_all(root.join(".claude/rules")).unwrap();
    for file in ALWAYS_ON_RULES {
        fs::write(
            root.join(".claude/rules").join(file),
            format!("rule {file}\n"),
        )
        .unwrap();
    }
    dir
}

fn write_log(root: &Path, lines: &[String]) {
    fs::create_dir_all(root.join(".meowkit/state")).unwrap();
    fs::write(
        root.join(".meowkit/state").join(SENTINEL_LOG),
        lines.join("\n") + "\n",
    )
    .unwrap();
}

fn run(root: &Path) -> Check {
    let place = Place::project(root);
    check(&[&place], &[Runtime::ClaudeCode])
}

#[test]
fn the_digest_is_the_one_the_hooks_record() {
    // Pinned against `.claude/hooks/lib/always-on-rules.cjs` run over the same
    // six files: a change to either side's format breaks this before it lets a
    // marker vouch for text the other side would not recognise.
    let dir = kit_project();
    assert_eq!(
        rules_digest(dir.path()).as_deref(),
        Some("418e0874a7cefcdf1b76ded57a694e4e449e5c27d00bbecfeb04bfa06712184c")
    );
}

#[test]
fn a_complete_rule_set_and_no_marker_is_ok() {
    let dir = kit_project();
    let c = run(dir.path());
    assert_eq!(c.status, Status::Ok, "{}", c.detail);
    assert!(
        c.detail.starts_with("6 always-on rule files"),
        "{}",
        c.detail
    );
}

#[test]
fn a_missing_or_blank_rule_fails() {
    let dir = kit_project();
    fs::remove_file(dir.path().join(".claude/rules/injection-rules.md")).unwrap();
    fs::write(dir.path().join(".claude/rules/security-rules.md"), "  \n").unwrap();
    let c = run(dir.path());
    assert_eq!(c.status, Status::Fail, "{}", c.detail);
    assert!(
        c.detail
            .contains("1 missing (project .claude/rules/injection-rules.md)"),
        "{}",
        c.detail
    );
    assert!(
        c.detail
            .contains("1 empty (project .claude/rules/security-rules.md)"),
        "{}",
        c.detail
    );
}

#[test]
fn a_marker_matching_the_rules_is_ok() {
    let dir = kit_project();
    let digest = rules_digest(dir.path()).unwrap();
    write_log(
        dir.path(),
        &[format!(
            r#"{{"session_id":"s","safety":true,"rules_sha256":"{digest}"}}"#
        )],
    );
    assert_eq!(run(dir.path()).status, Status::Ok);
}

#[test]
fn a_marker_for_changed_rules_warns() {
    let dir = kit_project();
    let digest = rules_digest(dir.path()).unwrap();
    write_log(
        dir.path(),
        &[format!(
            r#"{{"session_id":"s","safety":true,"rules_sha256":"{digest}"}}"#
        )],
    );
    fs::write(
        dir.path().join(".claude/rules/core-behaviors.md"),
        "edited\n",
    )
    .unwrap();
    let c = run(dir.path());
    assert_eq!(c.status, Status::Warn, "{}", c.detail);
    assert!(
        c.detail.contains("no longer match the digest"),
        "{}",
        c.detail
    );
}

#[test]
fn an_unchecked_marker_warns() {
    let dir = kit_project();
    write_log(
        dir.path(),
        &[r#"{"session_id":"s","safety":true,"phase_zero":true,"ts":"x"}"#.to_owned()],
    );
    let c = run(dir.path());
    assert_eq!(c.status, Status::Warn, "{}", c.detail);
    assert!(c.detail.contains("checked nothing"), "{}", c.detail);
}

#[test]
fn only_the_latest_verification_counts_and_baselines_are_not_one() {
    let dir = kit_project();
    let digest = rules_digest(dir.path()).unwrap();
    write_log(
        dir.path(),
        &[
            r#"{"session_id":"s","safety":true}"#.to_owned(),
            format!(r#"{{"session_id":"s","safety":true,"rules_sha256":"{digest}"}}"#),
            r#"{"session_id":"s","event":"rules_loaded","rules_sha256":"other"}"#.to_owned(),
            r#"{"session_id":"s","event":"precompact_rearm"}"#.to_owned(),
        ],
    );
    assert_eq!(run(dir.path()).status, Status::Ok);
}

#[test]
fn a_project_without_the_kit_has_nothing_to_read() {
    let dir = tempfile::tempdir().unwrap();
    let c = run(dir.path());
    assert_eq!(c.status, Status::Ok);
    assert!(c.detail.starts_with("no install"), "{}", c.detail);
}
