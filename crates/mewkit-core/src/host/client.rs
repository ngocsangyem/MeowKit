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
    /// Held from the duplicate search until the new job's supervisor is up
    /// (drop it then), so concurrent callers of one command make one job.
    pub key_lock: Option<std::fs::File>,
}

/// How long a caller waits for another caller of the same command to finish
/// creating its job before going ahead on its own (fail open).
const KEY_LOCK_WAIT: Duration = Duration::from_secs(10);

/// Variables that differ between two shells, or two agent sessions, running
/// the same command and never change what it does; everything else in the
/// environment is part of the command's identity.
const VOLATILE_ENV: &[&str] = &[
    "PWD", "OLDPWD", "SHLVL", "_", "WINDOWID", "COLUMNS", "LINES", "TMPDIR", "TMP", "TEMP",
];
/// Prefixes of variables an agent runtime, terminal or multiplexer sets per
/// session or pane (herdr gives each pane its own `HERDR_PANE_ID`).
const VOLATILE_PREFIXES: &[&str] = &[
    "CLAUDE",
    "CODEX",
    "CURSOR",
    "GEMINI",
    "VSCODE_",
    "TERM_",
    "ITERM_",
    "HERDR_",
    "MEOWKIT_SESSION",
];
/// Name parts that mark a per-session or per-process value.
const VOLATILE_PARTS: &[&str] = &["SESSION", "TOKEN", "_PID", "SOCK", "NONCE"];

fn volatile(name: &str) -> bool {
    let upper = name.to_ascii_uppercase();
    VOLATILE_ENV.contains(&upper.as_str())
        || VOLATILE_PREFIXES.iter().any(|p| upper.starts_with(p))
        || VOLATILE_PARTS.iter().any(|p| upper.contains(p))
}

/// Hash of the environment the command runs with, minus volatile variables:
/// a build with another `GOOS`, toolchain or feature flag is another command.
pub fn env_hash(vars: impl Iterator<Item = (std::ffi::OsString, std::ffi::OsString)>) -> String {
    let mut pairs: Vec<(std::ffi::OsString, std::ffi::OsString)> = vars
        .filter(|(k, _)| !k.to_str().is_some_and(volatile))
        .collect();
    pairs.sort();
    let mut input = Vec::new();
    for (k, v) in pairs {
        input.extend_from_slice(k.as_encoded_bytes());
        input.push(b'=');
        input.extend_from_slice(v.as_encoded_bytes());
        input.push(0);
    }
    crate::fsx::sha256_hex(&input)[..16].to_string()
}

/// Hash of the full argv, of the directory it runs in (relative to the
/// worktree root) and of its environment: identifies "the same command"
/// without storing it. `cargo test` in two member crates of one tree, or with
/// two values of one variable, is never the same command.
pub fn cmd_hash(argv: &[String], rel_cwd: &str, env_hash: &str) -> String {
    let mut input = rel_cwd.as_bytes().to_vec();
    input.extend_from_slice(b"\0\0");
    input.extend_from_slice(env_hash.as_bytes());
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
        cmd_hash: cmd_hash(
            argv,
            &rel_cwd(cwd, toplevel.as_deref()),
            &env_hash(std::env::vars_os()),
        ),
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
    let key = paths.dir("keys").join(format!("{}.lock", meta.cmd_hash));
    let key_lock = locks::hold_within(&key, KEY_LOCK_WAIT).ok().flatten();
    if let Some(job) = jobs::find_duplicate(paths, &meta) {
        return Ok(Prepared {
            job,
            attached: true,
            key_lock: None,
        });
    }
    let job = JobDir::new(paths, &id);
    super::paths::create_private_dir(&job.dir)?;
    job.write_meta(&meta)?;
    Ok(Prepared {
        job,
        attached: false,
        key_lock,
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
    let mut cursor = joblog::Cursor::default();
    let mut lines = joblog::Lines::default();
    loop {
        let state = job.state();
        let mut text = lines.push(&joblog::read_new(&job.log(), &mut cursor));
        let finished = !state.is_live();
        if finished {
            text.extend(lines.finish());
        }
        if !text.is_empty() {
            let _ = out.write_all(&text);
            let _ = out.flush();
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
