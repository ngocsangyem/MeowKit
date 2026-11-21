use std::fs;
use std::path::Path;

use super::*;

fn write(root: &Path, rel: &str, body: &str) {
    let p = root.join(rel);
    fs::create_dir_all(p.parent().expect("parent")).expect("mkdir");
    fs::write(p, body).expect("write");
}

const COOK: &str = "cases:\n  - id: cook-t1\n    skill: cook\n    kind: trigger\n    prompt: build the feature\n    expectTrigger: true\n  - id: cook-p1\n    skill: cook\n    kind: paired\n    prompt: add a flag\n    fixture: fixtures/small\n    assertions:\n      - type: fileExists\n        path: src/flag.rs\n";

fn root_with_cook() -> tempfile::TempDir {
    let dir = tempfile::tempdir().expect("tempdir");
    write(dir.path(), "cook/eval/cases.yaml", COOK);
    write(
        dir.path(),
        "cook/eval/fixtures/small/.claude/settings.json",
        "{}",
    );
    write(dir.path(), "cook/SKILL.md", "---\nname: mk:cook\n---\n");
    dir
}

#[test]
fn loads_cases_with_fixtures_resolved_from_their_eval_folder() {
    let dir = root_with_cook();
    let set = load_cases(dir.path()).expect("loads");
    assert_eq!(set.cases.len(), 2);
    assert_eq!(set.cases[0].file.as_str(), "cook/eval/cases.yaml");
    assert_eq!(
        set.cases[1].fixture_dir.as_ref().map(|p| p.as_str()),
        Some("cook/eval/fixtures/small")
    );
    assert_eq!(set.hash.len(), 64);
}

#[test]
fn skills_without_an_eval_folder_and_non_yaml_files_are_ignored() {
    let dir = root_with_cook();
    write(dir.path(), "fix/SKILL.md", "x");
    write(dir.path(), "cook/eval/README.md", "notes");
    assert_eq!(load_cases(dir.path()).expect("loads").cases.len(), 2);
}

#[test]
fn hash_is_stable_and_changes_with_any_case_or_fixture_byte() {
    let dir = root_with_cook();
    let h1 = load_cases(dir.path()).expect("loads").hash;
    assert_eq!(h1, load_cases(dir.path()).expect("loads").hash);

    write(
        dir.path(),
        "cook/eval/fixtures/small/.claude/settings.json",
        "{ }",
    );
    let h2 = load_cases(dir.path()).expect("loads").hash;
    assert_ne!(h1, h2, "a fixture edit must change the case-set hash");

    write(
        dir.path(),
        "cook/eval/cases.yaml",
        &COOK.replace("add a flag", "add two flags"),
    );
    assert_ne!(h2, load_cases(dir.path()).expect("loads").hash);
}

#[test]
fn one_bad_case_refuses_the_whole_set() {
    let dir = root_with_cook();
    write(
        dir.path(),
        "cook/eval/more.yaml",
        "cases:\n  - id: cook-bad\n    skill: cook\n    kind: trigger\n    prompt: x\n",
    );
    let err = load_cases(dir.path()).expect_err("refused");
    assert!(matches!(err, LoadError::Invalid { .. }), "{err}");
}

#[test]
fn duplicate_ids_across_files_are_refused() {
    let dir = root_with_cook();
    write(
        dir.path(),
        "cook/eval/dup.yaml",
        "cases:\n  - id: cook-t1\n    skill: cook\n    kind: trigger\n    prompt: fix the bug\n    expectTrigger: false\n",
    );
    let r = load_cases(dir.path());
    assert!(matches!(r, Err(LoadError::DuplicateId { .. })), "{r:?}");
}

#[test]
fn case_skill_must_match_its_folder() {
    let dir = tempfile::tempdir().expect("tempdir");
    write(
        dir.path(),
        "fix/eval/c.yaml",
        &COOK.replace("fixture: fixtures/small\n    ", ""),
    );
    let err = load_cases(dir.path()).expect_err("refused").to_string();
    assert!(err.contains("does not match its folder"), "{err}");
}

#[test]
fn missing_fixture_is_an_error() {
    let dir = tempfile::tempdir().expect("tempdir");
    write(dir.path(), "cook/eval/cases.yaml", COOK);
    assert!(matches!(load_cases(dir.path()), Err(LoadError::Io { .. })));
}

#[test]
fn malformed_yaml_is_a_parse_error_naming_the_file() {
    let dir = tempfile::tempdir().expect("tempdir");
    write(dir.path(), "cook/eval/c.yaml", "cases: [unclosed\n");
    let err = load_cases(dir.path()).expect_err("refused").to_string();
    assert!(err.starts_with("cook/eval/c.yaml"), "{err}");
}

#[cfg(unix)]
#[test]
fn symlinked_fixture_files_are_refused() {
    let dir = root_with_cook();
    let outside = tempfile::NamedTempFile::new().expect("tmp");
    std::os::unix::fs::symlink(
        outside.path(),
        dir.path().join("cook/eval/fixtures/small/leak.txt"),
    )
    .expect("symlink");
    assert!(matches!(
        load_cases(dir.path()),
        Err(LoadError::Symlink { .. })
    ));
}

#[test]
fn a_yaml_1_1_boolean_prompt_is_refused_not_coerced() {
    // `y`, `yes`, `no`, `on` are booleans in YAML 1.1; a prompt must be quoted.
    let dir = tempfile::tempdir().expect("tempdir");
    write(
        dir.path(),
        "cook/eval/c.yaml",
        "cases:\n  - id: cook-t\n    skill: cook\n    kind: trigger\n    prompt: yes\n    expectTrigger: true\n",
    );
    let err = load_cases(dir.path()).expect_err("refused").to_string();
    assert!(err.contains("expected a string"), "{err}");
}

#[test]
fn an_empty_root_loads_an_empty_set() {
    let dir = tempfile::tempdir().expect("tempdir");
    let set = load_cases(dir.path()).expect("loads");
    assert!(set.cases.is_empty());
}

#[cfg(unix)]
#[test]
fn symlinked_folders_above_a_case_or_fixture_are_refused() {
    use std::os::unix::fs::symlink;
    let outside = tempfile::tempdir().expect("tmp");
    write(outside.path(), "small/secret.txt", "s");

    // A symlinked middle folder in the fixture path.
    let dir = tempfile::tempdir().expect("tempdir");
    write(dir.path(), "cook/eval/cases.yaml", COOK);
    symlink(outside.path(), dir.path().join("cook/eval/fixtures")).expect("symlink");
    assert!(matches!(
        load_cases(dir.path()),
        Err(LoadError::Symlink { .. })
    ));

    // A symlinked eval folder.
    let dir = tempfile::tempdir().expect("tempdir");
    write(
        outside.path(),
        "eval/cases.yaml",
        &COOK.replace("fixture: fixtures/small\n    ", ""),
    );
    fs::create_dir_all(dir.path().join("cook")).expect("mkdir");
    symlink(outside.path().join("eval"), dir.path().join("cook/eval")).expect("symlink");
    assert!(matches!(
        load_cases(dir.path()),
        Err(LoadError::Symlink { .. })
    ));
}

#[cfg(target_os = "linux")]
#[test]
fn a_non_utf8_fixture_name_is_an_error_not_skipped() {
    use std::os::unix::ffi::OsStrExt;
    let dir = root_with_cook();
    let name = std::ffi::OsStr::from_bytes(b"bad\xff.txt");
    fs::write(dir.path().join("cook/eval/fixtures/small").join(name), "x").expect("write");
    assert!(matches!(
        load_cases(dir.path()),
        Err(LoadError::BadName { .. })
    ));
}
