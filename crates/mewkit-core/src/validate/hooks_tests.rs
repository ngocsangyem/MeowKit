//! What counts as a hook, and what the rows say about the ones that do.
use std::fs;
use std::path::Path;

use super::super::result::Status;
use super::{check_hooks_executable, is_hook_script};

#[cfg(unix)]
fn make_executable(path: &Path) {
    use std::os::unix::fs::PermissionsExt;
    let mut perms = fs::metadata(path).expect("stat the file").permissions();
    perms.set_mode(0o755);
    fs::set_permissions(path, perms).expect("set the mode");
}

#[cfg(not(unix))]
fn make_executable(_path: &Path) {}

fn hooks_dir() -> tempfile::TempDir {
    let dir = tempfile::tempdir().expect("a temp dir");
    fs::create_dir_all(dir.path().join("hooks")).expect("create the hooks dir");
    dir
}

#[test]
fn a_directory_is_never_a_hook_however_traversable() {
    // The bug this guards: the execute bit is set on a traversable directory,
    // so `lib/` used to report as an executable hook.
    let project = hooks_dir();
    let lib = project.path().join("hooks").join("lib");
    fs::create_dir_all(&lib).expect("create the lib dir");
    assert!(!is_hook_script(&lib));
}

#[test]
fn the_index_and_the_registry_are_not_hooks() {
    let project = hooks_dir();
    for name in ["HOOKS_INDEX.md", "handlers.json"] {
        let path = project.path().join("hooks").join(name);
        fs::write(&path, "x").expect("write the sidecar");
        make_executable(&path);
        assert!(!is_hook_script(&path), "{name} counted as a hook");
    }
}

#[test]
fn an_extensionless_file_is_a_hook_only_with_a_shebang_and_the_bit() {
    let project = hooks_dir();
    let plain = project.path().join("hooks").join("notes");
    fs::write(&plain, "#!/usr/bin/env bash\necho hi\n").expect("write the file");
    #[cfg(unix)]
    assert!(
        !is_hook_script(&plain),
        "a non-executable file is not a hook"
    );
    make_executable(&plain);
    assert!(is_hook_script(&plain));

    let no_shebang = project.path().join("hooks").join("readme");
    fs::write(&no_shebang, "just prose\n").expect("write the file");
    make_executable(&no_shebang);
    assert!(!is_hook_script(&no_shebang));
}

#[test]
fn a_non_script_extension_is_not_a_hook() {
    let project = hooks_dir();
    let doc = project.path().join("hooks").join("coverage.json");
    fs::write(&doc, "{}").expect("write the file");
    make_executable(&doc);
    assert!(!is_hook_script(&doc));
}

#[test]
fn an_absent_hooks_directory_is_one_failure_not_an_empty_pass() {
    let project = tempfile::tempdir().expect("a temp dir");
    let rows = check_hooks_executable(project.path());
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].status, Status::Fail);
    assert_eq!(rows[0].name, "Hooks directory");
}

#[test]
fn a_hooks_directory_with_no_scripts_fails() {
    let project = hooks_dir();
    fs::write(project.path().join("hooks").join("HOOKS_INDEX.md"), "x").expect("write the index");
    let rows = check_hooks_executable(project.path());
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].name, "Hooks present");
    assert_eq!(rows[0].status, Status::Fail);
}

#[test]
fn rows_are_in_name_order_with_the_skipped_count_last() {
    let project = hooks_dir();
    let hooks = project.path().join("hooks");
    for name in ["zebra.cjs", "alpha.cjs"] {
        let path = hooks.join(name);
        fs::write(&path, "//\n").expect("write the hook");
        make_executable(&path);
    }
    fs::create_dir_all(hooks.join("lib")).expect("create the lib dir");
    let rows = check_hooks_executable(project.path());
    let names: Vec<&str> = rows.iter().map(|r| r.name.as_str()).collect();
    assert_eq!(
        names,
        vec![
            "Hook executable: alpha.cjs",
            "Hook executable: zebra.cjs",
            "Hooks: non-script entries skipped",
        ]
    );
    assert!(
        rows.last()
            .expect("the summary row")
            .detail
            .starts_with("1 ")
    );
}

#[cfg(unix)]
#[test]
fn a_hook_without_the_execute_bit_fails_and_says_so() {
    let project = hooks_dir();
    let path = project.path().join("hooks").join("pre-ship.cjs");
    fs::write(&path, "//\n").expect("write the hook");
    let rows = check_hooks_executable(project.path());
    assert_eq!(rows[0].status, Status::Fail);
    assert!(
        rows[0].detail.starts_with("Not executable: "),
        "{}",
        rows[0].detail
    );
}
