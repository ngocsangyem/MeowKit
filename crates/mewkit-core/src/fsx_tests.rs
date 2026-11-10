use super::*;

fn rel(s: &str) -> RelPath {
    RelPath::new(s).expect(s)
}

#[test]
fn accepts_plain_relative_paths() {
    assert_eq!(
        rel(".claude/skills/x/SKILL.md").as_str(),
        ".claude/skills/x/SKILL.md"
    );
    assert_eq!(rel("AGENTS.md").as_str(), "AGENTS.md");
}

#[test]
fn refuses_escapes_and_ambiguous_forms() {
    assert_eq!(RelPath::new(""), Err(PathError::Empty));
    for bad in ["/etc/passwd", "/"] {
        assert!(
            matches!(RelPath::new(bad), Err(PathError::Absolute(_))),
            "{bad}"
        );
    }
    for bad in ["../x", "a/../b", "a/./b", "a//b", "a/", "."] {
        assert!(
            matches!(RelPath::new(bad), Err(PathError::Traversal(_))),
            "{bad}"
        );
    }
    for bad in ["C:/x", "a\\b", "file.txt:stream"] {
        assert!(
            matches!(RelPath::new(bad), Err(PathError::Ambiguous(_))),
            "{bad}"
        );
    }
}

#[test]
fn is_within_compares_whole_components() {
    assert!(rel(".cursor/hooks.json").is_within(&rel(".cursor")));
    assert!(rel(".cursor").is_within(&rel(".cursor")));
    assert!(!rel(".cursorrules").is_within(&rel(".cursor")));
    assert!(!rel(".cursor").is_within(&rel(".cursor/hooks")));
}

#[test]
fn never_delete_set_matches_npm_cli() {
    assert!(is_never_delete(&rel(".meowkit/memory/decisions.md")));
    assert!(is_never_delete(&rel(".meowkit/.env")));
    assert!(is_never_delete(&rel(".meowkit/backups")));
    assert!(!is_never_delete(&rel(".meowkit/.env.example")));
    assert!(!is_never_delete(&rel(".meowkit/config.yaml")));
}

#[test]
fn check_within_refuses_paths_outside_roots() {
    let roots = [rel(".codex"), rel("AGENTS.md")];
    assert!(check_within(&rel(".codex/hooks.json"), &roots).is_ok());
    assert!(check_within(&rel("AGENTS.md"), &roots).is_ok());
    assert_eq!(
        check_within(&rel(".claude/settings.json"), &roots),
        Err(PathError::OutsideRoots(".claude/settings.json".into()))
    );
}

#[cfg(unix)]
#[test]
fn check_parents_refuses_a_symlinked_directory() {
    let dir = tempfile::tempdir().unwrap();
    let outside = tempfile::tempdir().unwrap();
    std::os::unix::fs::symlink(outside.path(), dir.path().join(".claude")).unwrap();
    let err = check_parents(dir.path(), &rel(".claude/skills/x.md")).unwrap_err();
    assert_eq!(
        err,
        PathError::SymlinkedParent {
            path: ".claude/skills/x.md".into(),
            link: ".claude".into()
        }
    );
    // A link as the final component is acted on as a link, so it is allowed.
    std::os::unix::fs::symlink(outside.path(), dir.path().join("final")).unwrap();
    assert!(check_parents(dir.path(), &rel("final")).is_ok());
}

#[test]
fn check_parents_accepts_missing_and_real_directories() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::create_dir_all(dir.path().join("a/b")).unwrap();
    assert!(check_parents(dir.path(), &rel("a/b/c/d.txt")).is_ok());
    assert!(check_parents(dir.path(), &rel("new/file")).is_ok());
}

#[test]
fn atomic_write_creates_parents_replaces_and_leaves_no_temp() {
    let dir = tempfile::tempdir().unwrap();
    let dest = rel("x/y/file.txt").under(dir.path());
    atomic_write(&dest, b"one", None).unwrap();
    atomic_write(&dest, b"two", None).unwrap();
    assert_eq!(std::fs::read(&dest).unwrap(), b"two");
    let names: Vec<_> = std::fs::read_dir(dest.parent().unwrap())
        .unwrap()
        .map(|e| e.unwrap().file_name())
        .collect();
    assert_eq!(names, vec![std::ffi::OsString::from("file.txt")]);
}

#[cfg(unix)]
#[test]
fn atomic_write_sets_mode_defaulting_to_0644() {
    use std::os::unix::fs::PermissionsExt;
    let dir = tempfile::tempdir().unwrap();
    let plain = dir.path().join("plain");
    let exec = dir.path().join("exec");
    atomic_write(&plain, b"", None).unwrap();
    atomic_write(&exec, b"", Some(0o755)).unwrap();
    let mode = |p: &Path| std::fs::metadata(p).unwrap().permissions().mode() & 0o777;
    assert_eq!(mode(&plain), 0o644);
    assert_eq!(mode(&exec), 0o755);
}

proptest::proptest! {
    /// Whatever string comes in, an accepted path never escapes its root.
    #[test]
    fn accepted_paths_stay_under_root(raw in "[a-z./\\\\:]{0,12}") {
        if let Ok(p) = RelPath::new(&raw) {
            let root = Path::new("/root");
            let joined = p.under(root);
            proptest::prop_assert!(joined.starts_with(root));
            proptest::prop_assert!(joined.components().all(|c| !matches!(c, std::path::Component::ParentDir)));
        }
    }
}
