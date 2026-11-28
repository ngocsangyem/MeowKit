//! Watcher lifecycle (singleton, stop, killed holder) and the inbox (entries,
//! read-not-consume, prune, key spelling shared with the hook).
use std::time::Duration;

use super::inbox::{self, Action};
use super::model::{ProcIo, Verdict};
use super::paths::HostPaths;
use super::queue::{Priority, Queue, Ticket};
use super::watch::{self, Options, Outcome};
use super::worktree::{inbox_key, normalize};
use super::{time_now_ms, unknown_report};

fn opts(ticks: u64) -> Options {
    Options {
        interval: Duration::from_millis(20),
        idle_exit_ms: i64::MAX,
        binary_path: "/test/mewkit".into(),
        version: "test".into(),
        auto_clean: false,
        max_ticks: Some(ticks),
    }
}

#[test]
fn a_replaced_binary_ends_the_watcher() {
    let home = tempfile::tempdir().unwrap();
    let paths = HostPaths::under_home(home.path());
    let bin = home.path().join("mewkit");
    std::fs::write(&bin, b"old").unwrap();
    let mut o = opts(10_000);
    o.binary_path = bin.to_string_lossy().into_owned();
    let p = paths.clone();
    let watcher = std::thread::spawn(move || watch::run(&p, &o).unwrap());
    while watch::read_pid(&paths).is_none() {
        std::thread::sleep(Duration::from_millis(10));
    }
    // A self-update writes a new file at the same path.
    std::fs::write(&bin, b"new binary").unwrap();
    assert_eq!(watcher.join().unwrap(), Outcome::BinaryReplaced);
}

#[test]
fn one_watcher_at_a_time_and_a_stop_file_ends_it() {
    let home = tempfile::tempdir().unwrap();
    let paths = HostPaths::under_home(home.path());
    let p = paths.clone();
    let first = std::thread::spawn(move || watch::run(&p, &opts(10_000)).unwrap());
    let pid = loop {
        if let Some(pid) = watch::read_pid(&paths) {
            break pid;
        }
        std::thread::sleep(Duration::from_millis(10));
    };
    assert_eq!(
        watch::run(&paths, &opts(1)).unwrap(),
        Outcome::AlreadyRunning(Some(pid.pid))
    );
    watch::mark(&watch::files(&paths).stop).unwrap();
    assert_eq!(first.join().unwrap(), Outcome::Stopped);
    assert!(super::locks::eventually(|| !watch::is_running(&paths)));
    assert!(watch::read_pid(&paths).is_none());
}

#[test]
fn a_stale_stop_file_is_ignored() {
    let home = tempfile::tempdir().unwrap();
    let paths = HostPaths::under_home(home.path());
    paths.ensure().unwrap();
    let old = time_now_ms() - watch::MARKER_TTL_MS - 1;
    std::fs::write(watch::files(&paths).stop, old.to_string()).unwrap();
    assert_eq!(watch::run(&paths, &opts(2)).unwrap(), Outcome::TickLimit);
    assert!(paths.status().exists());
}

#[cfg(unix)]
#[test]
fn a_killed_holder_releases_the_watch_lock() {
    let home = tempfile::tempdir().unwrap();
    let paths = HostPaths::under_home(home.path());
    paths.ensure().unwrap();
    let lock = watch::files(&paths).lock;
    let script = "use Fcntl qw(:flock); open(F, '>>', $ARGV[0]) or die; flock(F, LOCK_EX) or die; print qq(held\\n); $|=1; sleep 30";
    let Ok(mut child) = std::process::Command::new("perl")
        .args(["-e", script, &lock.to_string_lossy()])
        .stdout(std::process::Stdio::piped())
        .spawn()
    else {
        eprintln!("skipped: perl missing");
        return;
    };
    let mut line = String::new();
    std::io::BufRead::read_line(
        &mut std::io::BufReader::new(child.stdout.take().unwrap()),
        &mut line,
    )
    .unwrap();
    assert_eq!(line.trim(), "held");
    assert!(watch::is_running(&paths));
    child.kill().unwrap();
    child.wait().unwrap();
    assert!(super::locks::eventually(|| !watch::is_running(&paths)));
    assert_eq!(watch::run(&paths, &opts(1)).unwrap(), Outcome::TickLimit);
}

#[test]
fn inbox_entries_name_load_and_queue_and_survive_reading() {
    let home = tempfile::tempdir().unwrap();
    let paths = HostPaths::under_home(home.path());
    let mut report = unknown_report("x", "y");
    report.verdict = Verdict::Hold;
    report.top_io = vec![ProcIo {
        pid: 42,
        exe: "cargo".into(),
        io_mb_s: 120.5,
        worktree: Some("/w/a/".into()),
        runtime: Some("claude".into()),
    }];
    let queue = Queue::new(&paths.dir("queue"));
    let _t = queue
        .enqueue(Ticket {
            seq: 0,
            priority: Priority::Normal,
            enqueued_at_ms: time_now_ms(),
            pid: 1,
            job_id: "j".into(),
            worktree: "/w/b".into(),
            exe_base: "cargo".into(),
            cmd_class: None,
            cmd_hash: "h".into(),
        })
        .unwrap();
    let now = time_now_ms();
    let entries = inbox::entries(&paths, &report, now);
    assert_eq!(entries.len(), 2);
    inbox::publish(&paths, &entries, now);
    let a = inbox::read(&paths, "/w/a").unwrap();
    assert_eq!((a.heavy[0].pid, a.heavy[0].exe.as_str()), (42, "cargo"));
    assert_eq!(a.action, Some(Action::DeferHeavy));
    assert_eq!(a.severity, "high");
    let b = inbox::read(&paths, "/w/b").unwrap();
    assert_eq!(
        (b.queued.clone(), b.action),
        (vec![1], Some(Action::WaitQueue))
    );
    assert_eq!(
        inbox::read(&paths, "/w/b"),
        Some(b),
        "reading does not consume"
    );
    inbox::prune(&paths, now + inbox::PRUNE_MS + 60_000);
    assert!(inbox::read(&paths, "/w/a").is_none());
}

#[test]
fn inbox_keys_match_the_shared_fixture() {
    let fixture = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures/host/inbox-keys.json");
    let rows: Vec<serde_json::Value> =
        serde_json::from_slice(&std::fs::read(fixture).unwrap()).unwrap();
    assert!(rows.len() >= 5);
    for row in rows {
        let input = row["input"].as_str().unwrap();
        assert_eq!(
            normalize(input),
            row["normalized"].as_str().unwrap(),
            "{input}"
        );
        assert_eq!(inbox_key(input), row["key"].as_str().unwrap(), "{input}");
    }
}

#[test]
fn a_cached_report_gains_the_volume_of_the_command_directory() {
    let mut report = super::unknown_report("test", "test");
    let dir = tempfile::tempdir().unwrap();
    super::cover_space(&mut report, &[dir.path().to_path_buf()]);
    let rows = report.space.len();
    super::cover_space(&mut report, &[dir.path().to_path_buf()]);
    assert_eq!(
        report.space.len(),
        rows,
        "a covered volume is not added twice"
    );
    assert!(
        report
            .space
            .iter()
            .all(|s| s.low == (s.free_gb < super::verdict::MIN_FREE_GB))
    );
    if report.space.iter().any(|s| s.low) {
        assert_eq!(report.verdict, super::model::Verdict::Clean);
    }
}

#[test]
fn a_newer_state_layout_stops_the_watcher_before_it_writes() {
    let home = tempfile::tempdir().unwrap();
    let paths = HostPaths::under_home(home.path());
    paths.ensure().unwrap();
    std::fs::write(paths.version(), "99\n").unwrap();
    let outcome = watch::run(&paths, &opts(1)).unwrap();
    assert_eq!(outcome, Outcome::LayoutNewer);
    assert!(!paths.status().exists());
}
