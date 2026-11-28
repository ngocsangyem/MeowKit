//! Tier 1 cleanup: only mewkit's own state under `~/.meowkit/host/`, owned
//! by the user who owns that directory. Ended job dirs, dead queue tickets,
//! stale inbox files, orphaned temp entries and rotated logs; never
//! `stats.json` or `VERSION`. Each item is renamed to a trash name in its own
//! directory, then deleted; a symlink anywhere on the way aborts that item.
//! The allowlist is code: no config widens it.
use std::io::Write;
use std::path::{Path, PathBuf};

use super::jobs;
use super::locks;
use super::model::Verdict;
use super::paths::{HostPaths, read_parsed};

pub use super::clean_remove::remove;

/// Ended jobs older than this go under a `clean` verdict.
pub const JOB_AGE_MS: i64 = 24 * 3600 * 1000;
/// False where file owners cannot be checked yet (Windows): there cleanup,
/// the retention sweep and the automatic tier list items but remove none.
pub const REMOVES: bool = cfg!(unix);
/// Automatic runs are at least this far apart.
pub const COOLDOWN_MS: i64 = 30 * 60 * 1000;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Item {
    pub path: PathBuf,
    pub bytes: u64,
    pub kind: &'static str,
}

pub(super) fn mtime_ms(meta: &std::fs::Metadata) -> Option<i64> {
    let d = meta
        .modified()
        .ok()?
        .duration_since(std::time::UNIX_EPOCH)
        .ok()?;
    i64::try_from(d.as_millis()).ok()
}

/// Bytes under `path`, not following symlinks.
pub fn size_of(path: &Path) -> u64 {
    let Ok(meta) = std::fs::symlink_metadata(path) else {
        return 0;
    };
    if !meta.is_dir() {
        return if meta.is_file() { meta.len() } else { 0 };
    }
    std::fs::read_dir(path)
        .map(|rd| rd.flatten().map(|e| size_of(&e.path())).sum())
        .unwrap_or(0)
}

pub(super) fn entries(dir: &Path) -> Vec<PathBuf> {
    std::fs::read_dir(dir)
        .map(|rd| rd.flatten().map(|e| e.path()).collect())
        .unwrap_or_default()
}

fn older_than(path: &Path, now_ms: i64, age_ms: i64) -> bool {
    std::fs::symlink_metadata(path)
        .ok()
        .and_then(|m| mtime_ms(&m))
        .is_some_and(|m| now_ms - m > age_ms)
}

fn item(path: PathBuf, kind: &'static str) -> Item {
    Item {
        bytes: size_of(&path),
        path,
        kind,
    }
}

/// Ended jobs older than `age_ms`.
pub fn ended_jobs(paths: &HostPaths, now_ms: i64, age_ms: i64) -> Vec<Item> {
    jobs::all(paths)
        .into_iter()
        .filter(|job| !job.state().is_live() && older_than(&job.dir, now_ms, age_ms))
        .map(|job| item(job.dir, "job"))
        .collect()
}

/// Everything tier 1 would remove now.
pub fn plan(paths: &HostPaths, now_ms: i64) -> Vec<Item> {
    let mut items = ended_jobs(paths, now_ms, JOB_AGE_MS);
    let queue = paths.dir("queue");
    for p in entries(&queue) {
        if p.extension().is_some_and(|e| e == "json") && !locks::is_held(&p.with_extension("lock"))
        {
            items.push(item(p, "ticket"));
        }
    }
    for p in entries(&paths.dir("inbox")) {
        if older_than(&p, now_ms, super::inbox::PRUNE_MS) {
            items.push(item(p, "inbox"));
        }
    }
    let tmp = paths.dir("tmp");
    for p in entries(&tmp) {
        let is_lock = p.extension().is_some_and(|e| e == "lock");
        let owner = PathBuf::from(format!("{}.lock", p.display()));
        if !is_lock && !locks::is_held(&owner) {
            items.push(item(p, "tmp"));
        }
    }
    for p in entries(&paths.root) {
        if p.extension().is_some_and(|e| e == "1") {
            items.push(item(p, "rotated-log"));
        }
    }
    items
}

/// Remove `items`, appending one `clean.log` line per action. Returns the
/// number removed.
pub fn execute(paths: &HostPaths, items: &[Item]) -> usize {
    if items.is_empty() || !REMOVES {
        return 0;
    }
    let mut log = super::joblog::CappedLog::open(&paths.dir("clean.log")).ok();
    let mut removed = 0;
    for it in items {
        let stamp = crate::time_utc::iso_seconds(super::time_now_ms());
        let line = match remove(paths, it) {
            Ok(bytes) => {
                removed += 1;
                format!(
                    "{stamp} removed {} {} bytes={bytes}\n",
                    it.kind,
                    it.path.display()
                )
            }
            Err(e) => format!("{stamp} skipped {} {} ({e})\n", it.kind, it.path.display()),
        };
        if let Some(log) = &mut log {
            let _ = log.write(line.as_bytes());
        }
    }
    removed
}

/// The watcher's trigger: only under `clean`, only when enabled, at most
/// once per cooldown. Returns the number removed when it ran.
pub fn run_auto(paths: &HostPaths, verdict: Verdict, enabled: bool, now_ms: i64) -> Option<usize> {
    if verdict != Verdict::Clean || !enabled {
        return None;
    }
    let marker = paths.dir("clean.last");
    let last: Option<i64> = read_parsed(&marker);
    if last.is_some_and(|at| (0..COOLDOWN_MS).contains(&(now_ms - at))) {
        return None;
    }
    let _ = crate::fsx::atomic_write(&marker, now_ms.to_string().as_bytes(), Some(0o600));
    Some(execute(paths, &plan(paths, now_ms)))
}

/// One-line summary for the dry run.
pub fn describe(items: &[Item], out: &mut dyn Write) {
    for it in items {
        let _ = writeln!(
            out,
            "{:<12} {:>10} B  {}",
            it.kind,
            it.bytes,
            it.path.display()
        );
    }
}
