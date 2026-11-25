use super::*;

#[cfg(unix)]
fn link(target: &Path, at: &Path) {
    std::os::unix::fs::symlink(target, at).unwrap();
}

#[test]
fn writes_appends_and_reads_real_paths_under_the_root() {
    let dir = tempfile::tempdir().unwrap();
    let file = dir.path().join("a/b/c.txt");
    write_in(dir.path(), &file, "one").unwrap();
    std::io::Write::write_all(&mut append_in(dir.path(), &file).unwrap(), b"two").unwrap();
    assert_eq!(read_to_string_in(dir.path(), &file).unwrap(), "onetwo");
    atomic_write_in(dir.path(), &file, b"three", None).unwrap();
    assert_eq!(read_in(dir.path(), &file).unwrap(), b"three");
    let missing = read_in(dir.path(), &dir.path().join("none")).unwrap_err();
    assert_eq!(missing.kind(), io::ErrorKind::NotFound);
}

#[test]
fn a_path_outside_the_root_is_refused() {
    let dir = tempfile::tempdir().unwrap();
    let other = tempfile::tempdir().unwrap();
    let err = write_in(dir.path(), &other.path().join("x"), "x").unwrap_err();
    assert!(matches!(
        no_follow_error(&err),
        Some(NoFollowError::Outside { .. })
    ));
    assert!(!other.path().join("x").exists());
}

#[cfg(unix)]
#[test]
fn a_symlinked_final_component_is_never_written_appended_or_read() {
    let dir = tempfile::tempdir().unwrap();
    let outside = tempfile::tempdir().unwrap();
    let victim = outside.path().join("rc");
    std::fs::write(&victim, "secret\n").unwrap();
    let file = dir.path().join("notes.md");
    link(&victim, &file);

    let errors = [
        write_in(dir.path(), &file, "attacker").unwrap_err(),
        append_in(dir.path(), &file).unwrap_err(),
        atomic_write_in(dir.path(), &file, b"attacker", None).unwrap_err(),
        read_to_string_in(dir.path(), &file).unwrap_err(),
    ];
    for err in &errors {
        assert!(
            matches!(no_follow_error(err), Some(NoFollowError::Symlink { .. })),
            "{err}"
        );
        assert!(err.to_string().contains("notes.md"), "{err}");
        assert!(err.to_string().contains("is a symlink"), "{err}");
    }
    assert_eq!(std::fs::read_to_string(&victim).unwrap(), "secret\n");
}

#[cfg(unix)]
#[test]
fn a_dangling_link_is_refused_and_nothing_is_created_at_its_target() {
    let dir = tempfile::tempdir().unwrap();
    let outside = tempfile::tempdir().unwrap();
    let victim = outside.path().join("created-by-the-link");
    let file = dir.path().join("task.md");
    link(&victim, &file);
    assert!(write_in(dir.path(), &file, "x").is_err());
    assert!(append_in(dir.path(), &file).is_err());
    assert!(!victim.exists());
}

#[cfg(unix)]
#[test]
fn a_symlinked_directory_on_the_way_is_refused() {
    let dir = tempfile::tempdir().unwrap();
    let outside = tempfile::tempdir().unwrap();
    link(outside.path(), &dir.path().join(".meowkit"));
    let file = dir.path().join(".meowkit/cache/kits/x");
    assert!(create_dir_all_in(dir.path(), &file).is_err());
    assert!(write_in(dir.path(), &file, "x").is_err());
    assert!(std::fs::read_dir(outside.path()).unwrap().next().is_none());
}
