use std::collections::BTreeMap;

use proptest::prelude::*;

use super::*;

fn rel(s: &str) -> RelPath {
    RelPath::new(s).unwrap()
}

/// Every directory and file under `root`, with file bytes, for exact comparison.
fn snapshot(root: &Path) -> BTreeMap<String, Option<Vec<u8>>> {
    let mut out = BTreeMap::new();
    let mut stack = vec![root.to_path_buf()];
    while let Some(dir) = stack.pop() {
        for entry in std::fs::read_dir(&dir).unwrap() {
            let path = entry.unwrap().path();
            let key = path
                .strip_prefix(root)
                .unwrap()
                .to_string_lossy()
                .replace('\\', "/");
            if path.is_dir() {
                out.insert(key, None);
                stack.push(path);
            } else {
                out.insert(key, Some(std::fs::read(&path).unwrap()));
            }
        }
    }
    out
}

fn seeded() -> tempfile::TempDir {
    let dir = tempfile::tempdir().unwrap();
    std::fs::create_dir_all(dir.path().join("a")).unwrap();
    std::fs::write(dir.path().join("a/keep.txt"), b"original").unwrap();
    std::fs::write(dir.path().join("top.txt"), b"top").unwrap();
    dir
}

#[test]
fn commit_keeps_changes() {
    let dir = seeded();
    let mut j = Journal::new(&Layout::at(dir.path()));
    j.write(&rel("a/keep.txt"), b"changed", None).unwrap();
    j.write(&rel("new/deep/file.txt"), b"new", None).unwrap();
    j.remove(&rel("top.txt")).unwrap();
    j.commit();
    assert_eq!(
        std::fs::read(dir.path().join("a/keep.txt")).unwrap(),
        b"changed"
    );
    assert!(dir.path().join("new/deep/file.txt").exists());
    assert!(!dir.path().join("top.txt").exists());
}

#[test]
fn rollback_restores_files_and_removes_created_dirs() {
    let dir = seeded();
    let before = snapshot(dir.path());
    let mut j = Journal::new(&Layout::at(dir.path()));
    j.write(&rel("a/keep.txt"), b"changed", None).unwrap();
    j.write(&rel("a/keep.txt"), b"changed twice", None).unwrap();
    j.write(&rel("new/deep/file.txt"), b"new", None).unwrap();
    j.remove(&rel("top.txt")).unwrap();
    j.remove(&rel("never-existed.txt")).unwrap();
    j.rollback().unwrap();
    assert_eq!(snapshot(dir.path()), before);
}

#[test]
fn drop_without_commit_rolls_back() {
    let dir = seeded();
    let before = snapshot(dir.path());
    {
        let mut j = Journal::new(&Layout::at(dir.path()));
        j.write(&rel("x/y.txt"), b"tmp", None).unwrap();
        j.remove(&rel("a/keep.txt")).unwrap();
    }
    assert_eq!(snapshot(dir.path()), before);
}

#[test]
fn rollback_keeps_a_created_dir_the_user_filled_meanwhile() {
    let dir = seeded();
    let mut j = Journal::new(&Layout::at(dir.path()));
    j.write(&rel("made/file.txt"), b"kit", None).unwrap();
    std::fs::write(dir.path().join("made/user.txt"), b"user").unwrap();
    j.rollback().unwrap();
    assert!(!dir.path().join("made/file.txt").exists());
    assert_eq!(
        std::fs::read(dir.path().join("made/user.txt")).unwrap(),
        b"user"
    );
}

#[cfg(unix)]
#[test]
fn rollback_restores_file_mode() {
    use std::os::unix::fs::PermissionsExt;
    let dir = seeded();
    let path = dir.path().join("a/keep.txt");
    std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755)).unwrap();
    let mut j = Journal::new(&Layout::at(dir.path()));
    j.write(&rel("a/keep.txt"), b"x", Some(0o600)).unwrap();
    j.rollback().unwrap();
    assert_eq!(
        std::fs::metadata(&path).unwrap().permissions().mode() & 0o777,
        0o755
    );
}

#[derive(Clone, Debug)]
enum TestOp {
    Write(usize, Vec<u8>),
    Remove(usize),
}

const PATHS: [&str; 6] = [
    "a/keep.txt",
    "top.txt",
    "a/new.txt",
    "b/c/d.txt",
    "b/e.txt",
    "f.txt",
];

fn op() -> impl Strategy<Value = TestOp> {
    prop_oneof![
        (0..PATHS.len(), proptest::collection::vec(any::<u8>(), 0..8))
            .prop_map(|(i, b)| TestOp::Write(i, b)),
        (0..PATHS.len()).prop_map(TestOp::Remove),
    ]
}

proptest! {
    /// Crash simulation: apply a random op sequence, abort after any number of
    /// ops, and the tree must be exactly what it was before the journal began.
    #[test]
    fn abort_after_any_op_restores_the_tree(
        ops in proptest::collection::vec(op(), 0..12),
        cut in 0usize..12,
    ) {
        let dir = seeded();
        let before = snapshot(dir.path());
        {
            let mut j = Journal::new(&Layout::at(dir.path()));
            for op in ops.iter().take(cut) {
                match op {
                    TestOp::Write(i, b) => j.write(&rel(PATHS[*i]), b, None).unwrap(),
                    TestOp::Remove(i) => j.remove(&rel(PATHS[*i])).unwrap(),
                }
            }
            // Dropped here without commit: the simulated failure.
        }
        prop_assert_eq!(snapshot(dir.path()), before);
    }
}
