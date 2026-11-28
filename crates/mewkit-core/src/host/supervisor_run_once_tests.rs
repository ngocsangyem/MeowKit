//! What the supervisor records and when it runs at all: exactly one of it and
//! a client that gave up on it runs the command, the tree is credited only
//! when unchanged from start to exit, the log on disk is scrubbed, and a
//! cancel while leftovers hold the output still ends the job as cancelled.
#[cfg(unix)]
use std::path::Path;
#[cfg(unix)]
use std::process::Command;
#[cfg(unix)]
use std::time::{Duration, Instant};

use super::model::Verdict;
use super::paths::HostPaths;
#[cfg(unix)]
use super::supervisor::Options;
use super::supervisor::run;
use super::supervisor_tests::{argv, fast, new_job};

#[cfg(unix)]
fn repo() -> Option<tempfile::TempDir> {
    let dir = tempfile::tempdir().unwrap();
    let git = |args: &[&str]| {
        Command::new("git")
            .args(args)
            .current_dir(dir.path())
            .output()
            .is_ok_and(|o| o.status.success())
    };
    std::fs::write(dir.path().join("f.txt"), "a\n").unwrap();
    let ok = git(&["init", "-q"])
        && git(&["add", "."])
        && git(&[
            "-c",
            "user.name=t",
            "-c",
            "user.email=t@t",
            "commit",
            "-qm",
            "c",
        ]);
    ok.then_some(dir)
}

#[cfg(unix)]
fn in_tree(root: &Path) -> Options {
    Options {
        tree_root: Some(root.to_path_buf()),
        ..fast()
    }
}

#[test]
fn a_job_the_client_already_claimed_is_never_run_by_the_supervisor() {
    let home = tempfile::tempdir().unwrap();
    let paths = HostPaths::under_home(home.path());
    let job = new_job(&paths, 0);
    assert!(job.claim_run(), "the client claims first");
    let marker = home.path().join("ran");
    #[cfg(unix)]
    let cmd = argv(&["touch", &marker.to_string_lossy()]);
    #[cfg(windows)]
    let cmd = argv(&["cmd", "/C", &format!("type nul > {}", marker.display())]);
    assert_eq!(run(&paths, &job, &cmd, &fast(), &|| (1, Verdict::Go)), 1);
    assert!(!marker.exists(), "the command ran a second time");
    assert!(!job.exit().exists());
    assert!(!job.claim_run(), "a claim is taken once");
}

#[cfg(unix)]
#[test]
fn the_tree_is_credited_only_when_the_command_left_it_unchanged() {
    let Some(tree) = repo() else {
        eprintln!("skipped: git missing");
        return;
    };
    let home = tempfile::tempdir().unwrap();
    let paths = HostPaths::under_home(home.path());
    let clean = new_job(&paths, 0);
    run(
        &paths,
        &clean,
        &argv(&["true"]),
        &in_tree(tree.path()),
        &|| (1, Verdict::Go),
    );
    let meta = clean.read_meta().unwrap();
    assert!(meta.ran_tree_digest.is_some());
    assert_eq!(
        meta.ran_tree_digest,
        super::tree_digest::tree_digest(tree.path())
    );

    let edits = new_job(&paths, 1);
    let file = tree.path().join("f.txt");
    let cmd = argv(&["sh", "-c", &format!("echo b > '{}'", file.display())]);
    assert_eq!(
        run(&paths, &edits, &cmd, &in_tree(tree.path()), &|| (
            1,
            Verdict::Go
        )),
        0
    );
    assert_eq!(edits.read_meta().unwrap().ran_tree_digest, None);
}

#[cfg(unix)]
#[test]
fn the_log_on_disk_is_scrubbed() {
    let home = tempfile::tempdir().unwrap();
    let paths = HostPaths::under_home(home.path());
    let job = new_job(&paths, 0);
    let cmd = argv(&["sh", "-c", "echo contact ada@example.com; printf tail"]);
    run(&paths, &job, &cmd, &fast(), &|| (1, Verdict::Go));
    let log = std::fs::read_to_string(job.log()).unwrap();
    assert!(!log.contains("ada@example.com"), "{log}");
    assert!(log.contains("contact") && log.ends_with("tail"), "{log}");
}

#[cfg(unix)]
#[test]
fn a_cancel_while_a_leftover_holds_the_output_ends_cancelled() {
    let home = tempfile::tempdir().unwrap();
    let paths = HostPaths::under_home(home.path());
    let job = new_job(&paths, 0);
    let cancel = job.cancel();
    let canceller = std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(600));
        std::fs::write(cancel, "1").unwrap();
    });
    let started = Instant::now();
    let cmd = argv(&["sh", "-c", "sleep 30 & echo started"]);
    let code = run(&paths, &job, &cmd, &fast(), &|| (1, Verdict::Go));
    canceller.join().unwrap();
    assert_eq!(code, super::supervisor::CANCELLED_EXIT);
    assert_eq!(job.state(), super::jobs::JobState::Cancelled);
    assert!(
        started.elapsed() < Duration::from_secs(8),
        "{:?}",
        started.elapsed()
    );
}
