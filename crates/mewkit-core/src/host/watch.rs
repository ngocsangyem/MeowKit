//! The machine-wide watcher: one process (held `watch.lock`) samples every
//! few seconds, stores the snapshot and writes each loaded worktree's inbox.
//! It exits on a fresh stop file or after a long stretch with no agent
//! runtime alive. A sampling error is logged and the loop goes on.
use std::io;
use std::path::PathBuf;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};

use super::collect::Collector;
use super::joblog::CappedLog;
use super::paths::HostPaths;
use super::snapshot::{self, Envelope};
use super::{inbox, locks, procs, time_now_ms};

/// Sampling interval (fixed for the beta).
pub const INTERVAL: Duration = Duration::from_secs(5);
/// Exit after this long with no agent runtime process alive.
pub const IDLE_EXIT_MS: i64 = 30 * 60 * 1000;
/// A stop file or no-autostart marker older than this is ignored.
pub const MARKER_TTL_MS: i64 = 60_000;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct PidFile {
    pub pid: u32,
    pub binary_path: String,
    pub version: String,
    /// Changes on every start, so a stop never kills a later watcher that
    /// reused the pid.
    pub lock_epoch: i64,
}

pub struct Files {
    pub lock: PathBuf,
    pub pid: PathBuf,
    pub stop: PathBuf,
    pub no_autostart: PathBuf,
    pub log: PathBuf,
}

pub fn files(paths: &HostPaths) -> Files {
    Files {
        lock: paths.dir("watch.lock"),
        pid: paths.dir("watch.pid"),
        stop: paths.dir("watch.stop"),
        no_autostart: paths.dir("no-autostart"),
        log: paths.dir("watch.log"),
    }
}

pub fn read_pid(paths: &HostPaths) -> Option<PidFile> {
    serde_json::from_slice(&std::fs::read(files(paths).pid).ok()?).ok()
}

pub fn is_running(paths: &HostPaths) -> bool {
    locks::is_held(&files(paths).lock)
}

/// Write a timestamped marker (stop file, no-autostart).
pub fn mark(path: &std::path::Path) -> io::Result<()> {
    crate::fsx::atomic_write(path, time_now_ms().to_string().as_bytes(), Some(0o600))
}

/// True while a marker exists and is younger than its TTL.
pub fn marker_fresh(path: &std::path::Path, now_ms: i64) -> bool {
    std::fs::read_to_string(path)
        .ok()
        .and_then(|t| t.trim().parse::<i64>().ok())
        .is_some_and(|at| (0..MARKER_TTL_MS).contains(&(now_ms - at)))
}

pub struct Options {
    pub interval: Duration,
    pub idle_exit_ms: i64,
    pub binary_path: String,
    pub version: String,
    /// Stop after this many ticks (tests); `None` runs until stop or idle.
    pub max_ticks: Option<u64>,
}

#[derive(Debug, PartialEq, Eq)]
pub enum Outcome {
    AlreadyRunning(Option<u32>),
    Stopped,
    Idle,
    TickLimit,
}

fn log_line(log: &mut Option<CappedLog>, line: &str) {
    if let Some(log) = log {
        let stamp = crate::time_utc::iso_seconds(time_now_ms());
        let _ = log.write(format!("{stamp} {line}\n").as_bytes());
    }
}

/// Sleep up to `d`, returning early (true) when a fresh stop file appears.
fn nap(stop: &std::path::Path, d: Duration) -> bool {
    let until = Instant::now() + d;
    while Instant::now() < until {
        if marker_fresh(stop, time_now_ms()) {
            return true;
        }
        std::thread::sleep(Duration::from_millis(200).min(d));
    }
    false
}

/// Run the watcher in this process until stopped, idle or the tick limit.
pub fn run(paths: &HostPaths, opts: &Options) -> io::Result<Outcome> {
    paths.ensure()?;
    let f = files(paths);
    let Some(_lock) = locks::try_hold(&f.lock)? else {
        return Ok(Outcome::AlreadyRunning(read_pid(paths).map(|p| p.pid)));
    };
    let pid = PidFile {
        pid: std::process::id(),
        binary_path: opts.binary_path.clone(),
        version: opts.version.clone(),
        lock_epoch: time_now_ms(),
    };
    crate::fsx::atomic_write(
        &f.pid,
        &serde_json::to_vec(&pid).map_err(io::Error::other)?,
        Some(0o600),
    )?;
    let mut log = CappedLog::open(&f.log).ok();
    log_line(&mut log, &format!("watcher started pid {}", pid.pid));
    let outcome = tick_loop(paths, opts, &f, &mut log);
    log_line(&mut log, &format!("watcher exiting: {outcome:?}"));
    let _ = std::fs::remove_file(&f.pid);
    Ok(outcome)
}

fn tick_loop(paths: &HostPaths, opts: &Options, f: &Files, log: &mut Option<CappedLog>) -> Outcome {
    let Some(mut collector) = Collector::new() else {
        log_line(log, "cannot sample this platform");
        return Outcome::Stopped;
    };
    let space: Vec<PathBuf> = crate::config::home_dir().into_iter().collect();
    collector.prime(None);
    let mut last_runtime_ms = time_now_ms();
    let mut ticks = 0u64;
    loop {
        if nap(&f.stop, opts.interval) {
            return Outcome::Stopped;
        }
        let (report, counters) = collector.sample(&space);
        let now = time_now_ms();
        if procs::any_runtime_alive(collector.system()) {
            last_runtime_ms = now;
        } else if now - last_runtime_ms >= opts.idle_exit_ms {
            return Outcome::Idle;
        }
        if let Err(e) = snapshot::write(
            &paths.status(),
            &Envelope::new(report.clone(), Some(counters)),
        ) {
            log_line(log, &format!("snapshot write failed: {e}"));
        }
        inbox::publish(paths, &inbox::entries(paths, &report, now), now);
        ticks += 1;
        if opts.max_ticks.is_some_and(|max| ticks >= max) {
            return Outcome::TickLimit;
        }
    }
}
