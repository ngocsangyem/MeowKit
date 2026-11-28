//! `host run` and `host jobs wait` exit codes at the CLI: an unfinished job is
//! 75 with a NOT VERIFIED headline (also when the caller is sent SIGTERM), and
//! a cancelled job is 70. Each test uses its own home, so it never touches the
//! machine's real queue. The machine's verdict decides whether a job runs or
//! stays queued, so the tests accept either headline.
#![cfg(unix)]

use std::path::Path;
use std::process::{Command, Output, Stdio};
use std::time::{Duration, Instant};

const NOT_FINISHED: i32 = 75;
const LOST_OR_CANCELLED: i32 = 70;

fn mewkit(home: &Path, args: &[&str]) -> Command {
    let mut cmd = Command::new(env!("CARGO_BIN_EXE_mewkit"));
    cmd.args(args).env("HOME", home).current_dir(home);
    cmd
}

fn run(home: &Path, args: &[&str]) -> Output {
    mewkit(home, args).output().expect("run mewkit")
}

fn not_verified(stdout: &[u8]) -> bool {
    String::from_utf8_lossy(stdout)
        .lines()
        .any(|l| l == "STILL RUNNING — NOT VERIFIED" || l == "QUEUED — NOT STARTED — NOT VERIFIED")
}

/// The job id `host run` names on stderr ("mewkit host: job <id> queued").
fn job_id(stderr: &[u8]) -> String {
    let text = String::from_utf8_lossy(stderr);
    text.split_whitespace()
        .skip_while(|w| *w != "job")
        .nth(1)
        .unwrap_or_else(|| panic!("no job id in: {text}"))
        .to_string()
}

fn cancel(home: &Path, id: &str) {
    let _ = run(home, &["host", "jobs", "cancel", id]);
}

#[test]
fn an_unfinished_job_is_75_with_a_not_verified_headline() {
    let home = tempfile::tempdir().unwrap();
    let out = run(
        home.path(),
        &["host", "run", "--wait", "1s", "--", "sleep", "30"],
    );
    let id = job_id(&out.stderr);
    cancel(home.path(), &id);
    assert_eq!(out.status.code(), Some(NOT_FINISHED));
    assert!(
        not_verified(&out.stdout),
        "{}",
        String::from_utf8_lossy(&out.stdout)
    );
}

#[test]
fn a_cancelled_job_waits_out_as_70() {
    let home = tempfile::tempdir().unwrap();
    let out = run(
        home.path(),
        &["host", "run", "--background", "--", "sleep", "30"],
    );
    assert_eq!(out.status.code(), Some(NOT_FINISHED));
    let id = job_id(&out.stderr);
    cancel(home.path(), &id);
    let waited = run(
        home.path(),
        &["host", "jobs", "wait", &id, "--timeout", "30s"],
    );
    assert_eq!(waited.status.code(), Some(LOST_OR_CANCELLED));
    assert!(String::from_utf8_lossy(&waited.stderr).contains("NOT VERIFIED"));
}

#[test]
fn sigterm_detaches_the_caller_with_75_and_leaves_the_job() {
    let home = tempfile::tempdir().unwrap();
    let child = mewkit(
        home.path(),
        &["host", "run", "--wait", "60s", "--", "sleep", "30"],
    )
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .spawn()
    .unwrap();
    // Let it get past setup and into the wait before the signal lands.
    std::thread::sleep(Duration::from_millis(1500));
    let sent = Command::new("/bin/kill")
        .args(["-TERM", &child.id().to_string()])
        .status()
        .unwrap();
    assert!(sent.success());
    let started = Instant::now();
    let out = child.wait_with_output().unwrap();
    let id = job_id(&out.stderr);
    let state = run(home.path(), &["host", "jobs", "list"]);
    cancel(home.path(), &id);
    assert!(
        started.elapsed() < Duration::from_secs(10),
        "detach took too long"
    );
    assert_eq!(out.status.code(), Some(NOT_FINISHED));
    assert!(
        not_verified(&out.stdout),
        "{}",
        String::from_utf8_lossy(&out.stdout)
    );
    let listed = String::from_utf8_lossy(&state.stdout);
    assert!(
        listed
            .lines()
            .any(|l| l.starts_with(&id) && (l.contains("running") || l.contains("queued"))),
        "job not live after detach: {listed}"
    );
}
