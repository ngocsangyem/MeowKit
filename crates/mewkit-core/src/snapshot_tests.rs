use super::*;

fn project() -> tempfile::TempDir {
    let root = tempfile::tempdir().unwrap();
    std::fs::create_dir_all(root.path().join(".claude")).unwrap();
    std::fs::write(root.path().join(".claude/a.md"), "one").unwrap();
    root
}

#[test]
fn a_snapshot_records_only_files_that_exist() {
    let root = project();
    let paths = [".claude/a.md".to_string(), ".claude/missing.md".to_string()];
    let manifest = create_snapshot(root.path(), "upgrade", &paths)
        .unwrap()
        .unwrap();
    assert_eq!(manifest.files.len(), 1);
    assert!(manifest.id.ends_with("-upgrade"));
    assert_eq!(list_snapshots(root.path()), [manifest]);
}

#[test]
fn nothing_to_record_creates_nothing() {
    let root = project();
    let paths = [
        ".claude/missing.md".to_string(),
        ".meowkit/cache/kit.tgz".to_string(),
    ];
    assert!(
        create_snapshot(root.path(), "init", &paths)
            .unwrap()
            .is_none()
    );
    assert!(!root.path().join(BACKUPS_REL).exists());
}

#[test]
fn a_restore_snapshots_what_it_overwrites_first() {
    let root = project();
    let manifest = create_snapshot(root.path(), "upgrade", &[".claude/a.md".to_string()])
        .unwrap()
        .unwrap();
    std::fs::write(root.path().join(".claude/a.md"), "two").unwrap();
    let restored = restore_snapshot(root.path(), &manifest.id, &manifest).unwrap();
    assert_eq!(
        std::fs::read_to_string(root.path().join(".claude/a.md")).unwrap(),
        "one"
    );
    let undo = restored.undo_id.expect("the overwritten file is recorded");
    assert!(undo.ends_with("-backups-restore"));
    let kept = read_snapshot(root.path(), &undo).unwrap();
    assert_eq!(kept.files.len(), 1);
}

#[test]
fn identical_files_are_left_alone() {
    let root = project();
    let manifest = create_snapshot(root.path(), "upgrade", &[".claude/a.md".to_string()])
        .unwrap()
        .unwrap();
    let (write, unchanged) = plan_restore(root.path(), &manifest);
    assert!(write.is_empty());
    assert_eq!(unchanged, [".claude/a.md"]);
}

#[test]
fn a_manifest_path_that_leaves_the_project_is_refused_and_nothing_is_written() {
    let root = project();
    let mut manifest = create_snapshot(root.path(), "upgrade", &[".claude/a.md".to_string()])
        .unwrap()
        .unwrap();
    std::fs::write(root.path().join(".claude/a.md"), "changed").unwrap();
    for bad in ["../outside.txt", "/etc/hosts", ".claude/../../x", ""] {
        manifest.files[0].path = bad.to_string();
        assert_eq!(outside_path(&manifest), Some(bad));
        let err = restore_snapshot(root.path(), &manifest.id, &manifest).err();
        assert!(err.is_some(), "{bad} must be refused");
    }
    assert_eq!(
        std::fs::read_to_string(root.path().join(".claude/a.md")).unwrap(),
        "changed"
    );
    manifest.files[0].path = "./.claude/a.md".to_string();
    assert_eq!(outside_path(&manifest), None);
}

#[test]
fn an_id_that_is_not_one_directory_name_reads_as_unknown() {
    let root = project();
    let manifest = create_snapshot(root.path(), "upgrade", &[".claude/a.md".to_string()])
        .unwrap()
        .unwrap();
    assert!(read_snapshot(root.path(), &manifest.id).is_some());
    for bad in ["..", "../backups", "a/b", "/tmp", ""] {
        assert!(read_snapshot(root.path(), bad).is_none(), "{bad}");
    }
}

#[test]
fn plain_copies_are_the_backup_dirs_without_a_manifest() {
    let root = project();
    let manifest = create_snapshot(root.path(), "upgrade", &[".claude/a.md".to_string()])
        .unwrap()
        .unwrap();
    std::fs::create_dir_all(root.path().join(BACKUPS_REL).join("1763000000-42")).unwrap();
    assert_eq!(plain_copies(root.path()), ["1763000000-42"]);
    assert_eq!(list_snapshots(root.path()), [manifest]);
}
