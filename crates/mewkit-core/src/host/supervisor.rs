//! The detached process that owns one job from enqueue to exit, so a client
//! that stops waiting (or is killed) never drops the job. It holds the job's
//! `alive.lock`, waits its turn in the queue, takes a slot, runs the command
//! at low priority with output in a capped log, and records the exit code.
use std::sync::{Arc, Mutex};
use std::time::Duration;

use super::joblog::CappedLog;
use super::jobs::JobDir;
use super::model::Verdict;
use super::paths::HostPaths;
use super::queue::{Queue, Ticket};
use super::slots::Slots;
use super::supervisor_drain::{self as drain, pump};
use super::{locks, priority, stats, time_now_ms};

/// After this long in the queue the job runs anyway, with a warning: the
/// queue must never block work forever.
pub const MAX_WAIT_MS: i64 = 30 * 60 * 1000;
/// Exit code recorded for a job cancelled before or while running.
pub const CANCELLED_EXIT: i32 = 130;
pub struct Options {
    /// Lower the command's priority (`--priority high` turns this off).
    pub lower: bool,
    pub max_wait_ms: i64,
    pub poll: Duration,
    /// The directory the command runs in, whose tree is recorded at start
    /// and exit; `None` records nothing (no credit for a pass).
    pub tree_root: Option<std::path::PathBuf>,
}

impl Default for Options {
    fn default() -> Self {
        Self {
            lower: true,
            max_wait_ms: MAX_WAIT_MS,
            poll: Duration::from_millis(250),
            tree_root: None,
        }
    }
}

pub(super) fn note(log: &Mutex<CappedLog>, line: &str) {
    if let Ok(mut log) = log.lock() {
        let _ = log.write(format!("mewkit host: {line}\n").as_bytes());
    }
}

/// The tree under `root`, for the record of what the command ran on.
fn tree_now(root: Option<&std::path::Path>) -> Option<String> {
    root.and_then(super::tree_digest::tree_digest)
}

fn finish(job: &JobDir, code: i32, cancelled: bool) {
    if cancelled {
        let _ = crate::fsx::atomic_write(&job.cancelled(), b"1", Some(0o600));
    }
    let _ = crate::fsx::atomic_write(&job.exit(), code.to_string().as_bytes(), Some(0o600));
}

/// Run job `job` to completion and return its exit code. `admission` says
/// how many heavy jobs may run right now and under which verdict; it is
/// asked only while this job is at the head of the queue. Errors fail open:
/// a queue or slot error runs the command rather than blocking it.
pub fn run(
    paths: &HostPaths,
    job: &JobDir,
    argv: &[String],
    opts: &Options,
    admission: &dyn Fn() -> (usize, Verdict),
) -> i32 {
    let Ok(Some(_alive)) = locks::try_hold(&job.alive()) else {
        return 1; // another supervisor already owns this job
    };
    if !paths.version_readable() {
        return 1; // a newer mewkit owns the state layout now
    }
    if !job.claim_run() {
        // The client gave up waiting for this supervisor and runs the
        // command itself: running it here too would run it twice.
        return 1;
    }
    let Some(mut meta) = job.read_meta() else {
        finish(job, 1, false);
        return 1;
    };
    stats::bump(paths, "runs");
    let log = Arc::new(Mutex::new(match CappedLog::open(&job.log()) {
        Ok(log) => log,
        Err(_) => {
            finish(job, 1, false);
            return 1;
        }
    }));
    let queue = Queue::new(&paths.dir("queue"));
    let slots = Slots::new(&paths.dir("slots"));
    let ticket = queue.enqueue(Ticket {
        seq: 0,
        priority: meta.priority,
        enqueued_at_ms: meta.enqueued_at_ms,
        pid: std::process::id(),
        job_id: job.id.clone(),
        worktree: meta.worktree.clone().unwrap_or_default(),
        exe_base: meta.exe_base.clone(),
        cmd_class: meta.cmd_class.clone(),
        cmd_hash: meta.cmd_hash.clone(),
    });
    let mut slot = None;
    if let Ok(ticket) = ticket {
        let seq = ticket.ticket.seq;
        loop {
            if job.cancel().exists() {
                ticket.leave();
                finish(job, CANCELLED_EXIT, true);
                stats::bump(paths, "cancelled");
                return CANCELLED_EXIT;
            }
            let now = time_now_ms();
            if now - meta.enqueued_at_ms >= opts.max_wait_ms {
                note(
                    &log,
                    "waited the maximum queue time; running anyway (fail open)",
                );
                stats::bump(paths, "fail_open_30min");
                break;
            }
            if queue.position(seq, now) == Some(0) {
                let (k, verdict) = admission();
                match slots.try_admit(k, now) {
                    Ok(Some(guard)) => {
                        if verdict == Verdict::Throttle {
                            stats::bump(paths, "admitted_under_throttle");
                        }
                        slot = Some(guard);
                        break;
                    }
                    Ok(None) => {}
                    Err(_) => break,
                }
            }
            std::thread::sleep(opts.poll);
        }
        ticket.leave();
    }
    let started = time_now_ms();
    let tree_at_start = tree_now(opts.tree_root.as_deref());
    let _ = crate::fsx::atomic_write(&job.admitted(), started.to_string().as_bytes(), Some(0o600));
    let mut child = match priority::spawn(argv, opts.lower) {
        Ok(child) => child,
        Err(e) => {
            note(&log, &format!("could not start the command: {e}"));
            finish(job, 127, false);
            return 127;
        }
    };
    let leader = child.id();
    meta.child_pid = Some(leader);
    meta.child_start_ms = Some(started);
    let _ = job.write_meta(&meta);
    let pumps: Vec<_> = [
        child.stdout.take().map(|o| pump(o, log.clone())),
        child.stderr.take().map(|e| pump(e, log.clone())),
    ]
    .into_iter()
    .flatten()
    .collect();
    let mut cancelled = false;
    let code = loop {
        match child.try_wait() {
            Ok(Some(status)) => break priority::exit_code(status),
            Ok(None) => {}
            Err(_) => break 1,
        }
        if !cancelled && job.cancel().exists() {
            cancelled = true;
            priority::stop_tree(&mut child, Duration::from_secs(5));
        }
        std::thread::sleep(Duration::from_millis(100));
    };
    let cancelled = drain::drain(pumps, job, leader, &log, cancelled);
    drop(slot);
    // A cancel that arrived any time before the exit file is written wins.
    let cancelled = cancelled || job.cancel().exists();
    if !cancelled
        && let Some(tree) = tree_at_start
        && tree_now(opts.tree_root.as_deref()).as_ref() == Some(&tree)
    {
        meta.ran_tree_digest = Some(tree);
        let _ = job.write_meta(&meta);
    }
    let code = if cancelled { CANCELLED_EXIT } else { code };
    finish(job, code, cancelled);
    if cancelled {
        stats::bump(paths, "cancelled");
    }
    code
}
