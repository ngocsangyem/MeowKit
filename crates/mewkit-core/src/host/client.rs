//! The waiting side of `host run`: describe the job, attach to a live
//! duplicate or hand a new one to a detached supervisor, then follow its log
//! until it ends or the wait runs out.
use std::io::{self, Write};
use std::path::Path;
use std::time::{Duration, Instant};

use super::jobs::{self, JobDir, JobState, Meta};
use super::paths::HostPaths;
use super::queue::Priority;
use super::{cmd_class, joblog, locks, procs, time_now_ms, tree_digest, worktree};

pub struct Prepared {
    pub job: JobDir,
    /// True when an identical live job was found and is being followed.
    pub attached: bool,
}

/// Hash of the full argv and of the directory it runs in, relative to the
/// worktree root: identifies "the same command" without storing it. The
/// directory matters because `cargo test` in two member crates of one tree
/// runs different tests, so one must never attach to the other.
pub fn cmd_hash(argv: &[String], rel_cwd: &str) -> String {
    let mut input = rel_cwd.as_bytes().to_vec();
    input.extend_from_slice(b"\0\0");
    input.extend_from_slice(argv.join("\0").as_bytes());
    crate::fsx::sha256_hex(&input)[..16].to_string()
}

/// `cwd` relative to its worktree root ("" at the root, or when outside one).
fn rel_cwd(cwd: &Path, toplevel: Option<&Path>) -> String {
    toplevel
        .and_then(|t| cwd.strip_prefix(t).ok())
        .map(|r| r.to_string_lossy().replace('\\', "/"))
        .unwrap_or_default()
}

/// What the job records about itself: basenames, class and hashes only.
pub fn describe(argv: &[String], cwd: &Path, priority: Priority, id: &str) -> Meta {
    let toplevel = worktree::git_toplevel(cwd);
    Meta {
        id: id.to_string(),
        worktree: toplevel
            .as_deref()
            .map(|t| worktree::normalize(&t.to_string_lossy())),
        tree_digest: tree_digest::tree_digest(cwd),
        cmd_class: cmd_class::classify(&argv.join(" ")).map(str::to_string),
        cmd_hash: cmd_hash(argv, &rel_cwd(cwd, toplevel.as_deref())),
        exe_base: argv
            .first()
            .map_or_else(|| "?".into(), |a| procs::basename(Path::new(a))),
        priority,
        enqueued_at_ms: time_now_ms(),
        ..Meta::default()
    }
}

/// Attach to a live identical job, or create the job directory and meta.
pub fn prepare(
    paths: &HostPaths,
    argv: &[String],
    cwd: &Path,
    priority: Priority,
) -> io::Result<Prepared> {
    paths.ensure()?;
    let id = jobs::new_id(time_now_ms());
    let meta = describe(argv, cwd, priority, &id);
    if let Some(job) = jobs::find_duplicate(paths, &meta) {
        return Ok(Prepared {
            job,
            attached: true,
        });
    }
    let job = JobDir::new(paths, &id);
    super::paths::create_private_dir(&job.dir)?;
    job.write_meta(&meta)?;
    Ok(Prepared {
        job,
        attached: false,
    })
}

/// After spawning the supervisor: true once it holds the job (or finished).
pub fn wait_for_supervisor(job: &JobDir, timeout: Duration) -> bool {
    let started = Instant::now();
    while started.elapsed() < timeout {
        if locks::is_held(&job.alive()) || job.exit().exists() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(20));
    }
    false
}

/// Stream the job's log (redacted, whole lines) to `out` until the job ends,
/// `deadline` passes or `stop` says so (a signal); return the last state seen.
pub fn follow(
    job: &JobDir,
    deadline: Instant,
    out: &mut dyn Write,
    stop: &dyn Fn() -> bool,
) -> JobState {
    let mut offset = 0u64;
    let mut pending: Vec<u8> = Vec::new();
    loop {
        let state = job.state();
        let (bytes, next) = joblog::read_from(&job.log(), offset);
        offset = next;
        pending.extend(bytes);
        let finished = !state.is_live();
        let cut = if finished {
            pending.len()
        } else {
            pending
                .iter()
                .rposition(|b| *b == b'\n')
                .map_or(0, |i| i + 1)
        };
        if cut > 0 {
            let _ = out.write_all(joblog::redact(&pending[..cut]).as_bytes());
            let _ = out.flush();
            pending.drain(..cut);
        }
        if finished || Instant::now() >= deadline || stop() {
            return state;
        }
        std::thread::sleep(Duration::from_millis(100));
    }
}

/// Wait without streaming until the job ends, `deadline` passes or `stop`
/// says so.
pub fn wait_quietly(job: &JobDir, deadline: Instant, stop: &dyn Fn() -> bool) -> JobState {
    loop {
        let state = job.state();
        if !state.is_live() || Instant::now() >= deadline || stop() {
            return state;
        }
        std::thread::sleep(Duration::from_millis(200));
    }
}

/// 0-based place in the admission queue, while queued.
pub fn queue_position(paths: &HostPaths, job: &JobDir) -> Option<usize> {
    let queue = super::queue::Queue::new(&paths.dir("queue"));
    queue
        .ordered(time_now_ms())
        .iter()
        .position(|t| t.job_id == job.id)
}
