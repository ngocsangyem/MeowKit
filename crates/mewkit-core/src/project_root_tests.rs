//! Unit tests for `project_root` — the project root rules.
use super::*;

#[test]
fn a_git_worktree_file_marks_a_root_like_a_directory_does() {
    let scratch = tempfile::tempdir().expect("a temp dir");
    let nested = scratch.path().join("packages").join("inner");
    std::fs::create_dir_all(&nested).expect("create the tree");
    std::fs::write(scratch.path().join(".git"), "gitdir: /elsewhere\n")
        .expect("write the worktree pointer");
    assert_eq!(
        resolve_project_root(&nested).map(|p| p.canonicalize().unwrap()),
        Some(scratch.path().canonicalize().unwrap())
    );
}

#[test]
fn a_manifest_alone_is_not_a_root() {
    let scratch = tempfile::tempdir().expect("a temp dir");
    let inner = scratch.path().join("inner");
    std::fs::create_dir_all(&inner).expect("create the tree");
    std::fs::write(inner.join("package.json"), "{}\n").expect("write the manifest");
    // No `.meowkit/` beside it, and no `.git` anywhere under the temp dir,
    // so the walk must not claim `inner`.
    assert_ne!(
        resolve_project_root(&inner).map(|p| p.canonicalize().unwrap()),
        Some(inner.canonicalize().unwrap())
    );
}

#[test]
fn the_nearest_root_wins_over_its_parent() {
    let scratch = tempfile::tempdir().expect("a temp dir");
    let inner = scratch.path().join("packages").join("inner");
    std::fs::create_dir_all(inner.join(".meowkit")).expect("create the state dir");
    std::fs::write(inner.join("package.json"), "{}\n").expect("write the manifest");
    std::fs::create_dir_all(scratch.path().join(".git")).expect("create the git dir");
    assert_eq!(
        resolve_project_root(&inner).map(|p| p.canonicalize().unwrap()),
        Some(inner.canonicalize().unwrap())
    );
}
