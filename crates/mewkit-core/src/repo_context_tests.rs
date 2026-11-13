use super::*;

fn write(root: &Path, rel: &str, text: &str) {
    let path = root.join(rel);
    std::fs::create_dir_all(path.parent().unwrap()).unwrap();
    std::fs::write(path, text).unwrap();
}

const SHA: &str = "0123456789abcdef0123456789abcdef01234567";

#[test]
fn containment_is_component_wise_not_a_string_prefix() {
    let root = Path::new("/project");
    assert!(is_within_boundary(root, Path::new("/project")));
    assert!(is_within_boundary(root, Path::new("/project/src/a.rs")));
    assert!(!is_within_boundary(root, Path::new("/project-other/a.rs")));
    assert!(!is_within_boundary(root, Path::new("/elsewhere")));
    // `..` is collapsed before the comparison, so an escape is caught.
    assert!(!is_within_boundary(
        root,
        Path::new("/project/../elsewhere")
    ));
    assert!(is_within_boundary(root, Path::new("/project/src/../lib")));
}

#[test]
fn resolve_collapses_dot_segments_without_touching_the_disk() {
    assert_eq!(
        lexical_resolve(Path::new("/a/b"), Path::new("./c/../d")),
        Path::new("/a/b/d")
    );
    assert_eq!(
        lexical_resolve(Path::new("/a/b"), Path::new("/x/y")),
        Path::new("/x/y")
    );
    // Popping past the root stays at the root.
    assert_eq!(
        lexical_resolve(Path::new("/a"), Path::new("../../..")),
        Path::new("/")
    );
}

#[test]
fn a_git_root_yields_its_head_revision_through_the_branch_ref() {
    let dir = tempfile::tempdir().unwrap();
    let root = dir.path();
    write(root, ".git/HEAD", "ref: refs/heads/main\n");
    write(root, ".git/refs/heads/main", &format!("{SHA}\n"));
    write(root, "src/lib.rs", "");

    let owner = resolve_owning_repo(&root.join("src/lib.rs"), None);
    assert!(owner.is_git);
    assert_eq!(owner.identity, root);
    assert_eq!(owner.revision.as_deref(), Some(SHA));
}

#[test]
fn a_detached_head_is_read_and_a_packed_ref_is_the_fallback() {
    let dir = tempfile::tempdir().unwrap();
    let root = dir.path();
    write(root, ".git/HEAD", &format!("{SHA}\n"));
    assert_eq!(
        resolve_owning_repo(root, None).revision.as_deref(),
        Some(SHA)
    );

    write(root, ".git/HEAD", "ref: refs/heads/main\n");
    write(
        root,
        ".git/packed-refs",
        &format!("# pack-refs with: peeled\n{SHA} refs/heads/main\n"),
    );
    assert_eq!(
        resolve_owning_repo(root, None).revision.as_deref(),
        Some(SHA)
    );
}

/// HEAD is repository DATA: a ref that escapes the metadata dir, or a ref whose
/// content is not a hex object id, must never become the revision.
#[test]
fn a_crafted_head_never_reads_arbitrary_file_content() {
    let dir = tempfile::tempdir().unwrap();
    let root = dir.path();
    write(root, "secret.txt", "hunter2\n");
    write(root, ".git/HEAD", "ref: ../secret.txt\n");
    assert_eq!(resolve_owning_repo(root, None).revision, None);

    write(root, ".git/HEAD", "ref: refs/heads/main\n");
    write(root, ".git/refs/heads/main", "not-a-sha\n");
    assert_eq!(resolve_owning_repo(root, None).revision, None);
}

#[test]
fn a_git_file_pointer_is_followed_to_the_real_metadata_dir() {
    let dir = tempfile::tempdir().unwrap();
    let root = dir.path();
    write(root, "worktree/.git", "gitdir: ../real-git\n");
    write(root, "real-git/HEAD", &format!("{SHA}\n"));
    let owner = resolve_owning_repo(&root.join("worktree"), None);
    assert_eq!(owner.identity, root.join("worktree"));
    assert_eq!(owner.revision.as_deref(), Some(SHA));
}

#[test]
fn a_non_git_tree_reports_the_boundary_with_no_revision() {
    let dir = tempfile::tempdir().unwrap();
    let root = dir.path().join("plain");
    std::fs::create_dir_all(root.join("nested")).unwrap();
    let owner = resolve_owning_repo(&root.join("nested"), Some(&root));
    assert!(!owner.is_git);
    assert_eq!(owner.identity, root);
    assert_eq!(owner.revision, None);
}

/// The walk stops at the boundary, so a nested project under a git parent is
/// not reported as owned by that parent.
#[test]
fn the_walk_never_crosses_the_boundary() {
    let dir = tempfile::tempdir().unwrap();
    let root = dir.path();
    write(root, ".git/HEAD", &format!("{SHA}\n"));
    let inner = root.join("inner");
    std::fs::create_dir_all(&inner).unwrap();
    assert_eq!(resolve_owning_repo(&inner, Some(&inner)).identity, inner);
    assert_eq!(resolve_owning_repo(&inner, None).identity, root);
}
