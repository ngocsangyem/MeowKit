use std::cell::RefCell;
use std::path::{Path, PathBuf};

use super::super::exec::{Exec, ExecResult};
use super::{CleanupOptions, cleanup, default_worktree_script};

/// Records every argv it is handed and answers with a canned result, so a test
/// can assert what WOULD have run without anything running.
struct Recorder {
    calls: RefCell<Vec<Vec<String>>>,
    answer: ExecResult,
}

impl Recorder {
    fn new(answer: ExecResult) -> Self {
        Self {
            calls: RefCell::new(Vec::new()),
            answer,
        }
    }
    fn refusing() -> Self {
        Self::new(ExecResult {
            ok: false,
            out: String::new(),
            err: "Refusing to remove worktree: nonce mismatch (worktree is not owned by this manifest)".into(),
        })
    }
}

impl Exec for Recorder {
    fn run(&self, file: &str, args: &[String], _cwd: &Path) -> ExecResult {
        let mut call = vec![file.to_string()];
        call.extend_from_slice(args);
        self.calls.borrow_mut().push(call);
        self.answer.clone()
    }
}

/// A session whose worktree exists on disk, so a stray delete would be visible.
fn seed(session: &str) -> (tempfile::TempDir, PathBuf) {
    let dir = tempfile::tempdir().expect("a temp dir");
    let session_dir = dir.path().join("tasks").join("reviews").join(session);
    std::fs::create_dir_all(&session_dir).expect("create the session dir");
    std::fs::write(session_dir.join("manifest.json"), "{}").expect("write the manifest");
    let worktree = dir
        .path()
        .join(".worktrees")
        .join(format!("review-pr-7-{session}"));
    std::fs::create_dir_all(&worktree).expect("create the worktree");
    std::fs::write(worktree.join("file.txt"), "pr code").expect("write into the worktree");
    (dir, worktree)
}

#[test]
fn a_refused_cleanup_removes_nothing() {
    let (project, worktree) = seed("s1");
    let exec = Recorder::refusing();
    let result = cleanup(
        &CleanupOptions {
            session: "s1",
            cwd: project.path(),
            worktree_script: None,
        },
        &exec,
    );
    assert!(!result.ok);
    assert_eq!(result.removed_worktree, None);
    assert!(
        result
            .error
            .as_deref()
            .is_some_and(|e| e.contains("nonce mismatch")),
        "{result:?}"
    );
    // The point of the test: a refusal leaves the worktree, its contents AND
    // the session's audit trail exactly where they were.
    assert!(
        worktree.join("file.txt").exists(),
        "the worktree was removed"
    );
    assert!(
        project
            .path()
            .join("tasks/reviews/s1/manifest.json")
            .exists()
    );
}

#[test]
fn the_worktree_action_is_called_with_array_argv_and_a_relative_manifest() {
    let (project, _) = seed("s2");
    let exec = Recorder::new(ExecResult {
        ok: true,
        out: "{}".into(),
        err: String::new(),
    });
    let result = cleanup(
        &CleanupOptions {
            session: "s2",
            cwd: project.path(),
            worktree_script: None,
        },
        &exec,
    );
    assert_eq!(result.removed_worktree, Some(true));
    let calls = exec.calls.borrow();
    assert_eq!(calls.len(), 1, "cleanup ran more than one command");
    let expected_manifest =
        ["tasks", "reviews", "s2", "manifest.json"].join(std::path::MAIN_SEPARATOR_STR);
    assert_eq!(
        calls[0],
        vec![
            "node".to_string(),
            default_worktree_script(project.path())
                .to_string_lossy()
                .into_owned(),
            "review-pr-cleanup".into(),
            "--manifest".into(),
            expected_manifest,
            "--json".into(),
        ]
    );
}

#[test]
fn a_session_without_a_manifest_is_refused_before_anything_runs() {
    let project = tempfile::tempdir().expect("a temp dir");
    let exec = Recorder::new(ExecResult {
        ok: true,
        out: String::new(),
        err: String::new(),
    });
    let result = cleanup(
        &CleanupOptions {
            session: "ghost",
            cwd: project.path(),
            worktree_script: None,
        },
        &exec,
    );
    assert_eq!(
        result.error.as_deref(),
        Some(
            format!(
                "no review session at {}",
                ["tasks", "reviews", "ghost"].join(std::path::MAIN_SEPARATOR_STR)
            )
            .as_str()
        )
    );
    assert!(exec.calls.borrow().is_empty(), "a command ran anyway");
}

#[test]
fn a_failure_with_no_stderr_falls_back_to_stdout() {
    let (project, _) = seed("s3");
    let exec = Recorder::new(ExecResult {
        ok: false,
        out: "{\"error\":\"CLEANUP_REFUSED\"}".into(),
        err: String::new(),
    });
    let result = cleanup(
        &CleanupOptions {
            session: "s3",
            cwd: project.path(),
            worktree_script: None,
        },
        &exec,
    );
    assert_eq!(
        result.error.as_deref(),
        Some("worktree cleanup refused/failed: {\"error\":\"CLEANUP_REFUSED\"}")
    );
}
