use super::*;

/// A canonical temp dir: `refresh` compares canonical paths, and macOS temp is a symlink.
fn tempdir() -> (tempfile::TempDir, std::path::PathBuf) {
    let dir = tempfile::tempdir().unwrap();
    let real = dir.path().canonicalize().unwrap();
    (dir, real)
}

fn exe_named(dir: &Path, name: &str, body: &[u8]) -> std::path::PathBuf {
    let exe = dir.join(file(name));
    std::fs::write(&exe, body).unwrap();
    exe
}

fn file(name: &str) -> String {
    format!("{name}{}", std::env::consts::EXE_SUFFIX)
}

/// An executable script answering `--version` with `banner`.
#[cfg(unix)]
fn script(path: &Path, banner: &str) {
    use std::os::unix::fs::PermissionsExt;
    std::fs::write(path, format!("#!/bin/sh\necho '{banner}'\n")).unwrap();
    std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o755)).unwrap();
}

#[test]
fn a_mewkit_install_with_no_other_names_gets_none_added() {
    let (_keep, dir) = tempdir();
    let exe = exe_named(&dir, "mewkit", b"new");
    assert_eq!(refresh(&exe), Refreshed::default());
    assert!(!dir.join(file("mk")).exists());
}

#[test]
fn a_pre_rename_install_lands_on_the_new_names() {
    let (_keep, dir) = tempdir();
    let exe = exe_named(&dir, "mewkit-next", b"new");
    let done = refresh(&exe);
    assert_eq!(done.placed, vec![file("mewkit"), file("mk")]);
    for name in ["mewkit", "mk"] {
        assert_eq!(std::fs::read(dir.join(file(name))).unwrap(), b"new");
    }
}

#[test]
fn a_directory_under_an_alias_name_is_reported_not_replaced() {
    let (_keep, dir) = tempdir();
    let exe = exe_named(&dir, "mewkit-next", b"new");
    std::fs::create_dir(dir.join(file("mk"))).unwrap();
    let done = refresh(&exe);
    assert_eq!(done.placed, vec![file("mewkit")]);
    assert_eq!(done.problems.len(), 1, "{:?}", done.problems);
    assert!(dir.join(file("mk")).is_dir());
}

#[cfg(unix)]
#[test]
fn an_older_mewkit_copy_becomes_a_link_to_the_new_binary() {
    let (_keep, dir) = tempdir();
    let exe = exe_named(&dir, "mewkit", b"new");
    script(&dir.join("mk"), "mewkit-next 0.0.1");
    let done = refresh(&exe);
    assert_eq!(done.placed, vec!["mk".to_owned()]);
    assert!(done.problems.is_empty(), "{:?}", done.problems);
    assert_eq!(dir.join("mk").canonicalize().unwrap(), exe);
}

#[cfg(unix)]
#[test]
fn a_foreign_mk_is_left_alone_and_reported() {
    let (_keep, dir) = tempdir();
    let exe = exe_named(&dir, "mewkit", b"new");
    // The npm CLI prints a bare version, as does any unrelated tool.
    script(&dir.join("mk"), "1.2.3");
    let before = std::fs::read(dir.join("mk")).unwrap();
    let done = refresh(&exe);
    assert!(done.placed.is_empty());
    assert_eq!(done.problems.len(), 1, "{:?}", done.problems);
    assert_eq!(std::fs::read(dir.join("mk")).unwrap(), before);
}

#[cfg(unix)]
#[test]
fn called_through_the_mk_link_it_still_works_from_the_real_binary() {
    let (_keep, dir) = tempdir();
    let real = exe_named(&dir, "mewkit", b"new");
    std::os::unix::fs::symlink("mewkit", dir.join("mk")).unwrap();
    std::os::unix::fs::symlink("mewkit", dir.join("mewkit-next")).unwrap();
    assert_eq!(refresh(&dir.join("mk")), Refreshed::default());
    for name in ["mk", "mewkit-next"] {
        assert_eq!(dir.join(name).canonicalize().unwrap(), real);
    }
    assert_eq!(std::fs::read(&real).unwrap(), b"new");
}

#[cfg(unix)]
#[test]
fn an_existing_link_already_follows_the_binary_and_is_left_alone() {
    let (_keep, dir) = tempdir();
    let exe = exe_named(&dir, "mewkit", b"new");
    std::os::unix::fs::symlink("mewkit", dir.join("mk")).unwrap();
    assert_eq!(refresh(&exe), Refreshed::default());
    assert!(
        dir.join("mk")
            .symlink_metadata()
            .unwrap()
            .file_type()
            .is_symlink()
    );
}
