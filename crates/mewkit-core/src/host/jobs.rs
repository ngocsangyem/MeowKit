//! A heavy job on disk: `jobs/<id>/` holds `meta.json` (who and what, never
//! the full command line), `alive.lock` (held by the supervisor for its whole
//! life), `admitted` once the command starts, `exit` when it ends, `cancel`
//! when someone asks it to stop and `cancelled` when it did, plus the log.
//! A job whose supervisor is gone without an `exit` file is `lost`: never a
//! pass.
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use super::locks;
use super::paths::HostPaths;

/// Finished and lost job directories older than this are swept.
pub const RETENTION_MS: i64 = 7 * 24 * 3600 * 1000;

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct Meta {
    pub id: String,
    pub worktree: Option<String>,
    pub tree_digest: Option<String>,
    pub cmd_class: Option<String>,
    pub cmd_hash: String,
    pub exe_base: String,
    pub priority: super::queue::Priority,
    pub enqueued_at_ms: i64,
    pub child_pid: Option<u32>,
    pub child_start_ms: Option<i64>,
    pub session_hint: Option<String>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum JobState {
    Queued,
    Running,
    Done(i32),
    Cancelled,
    Lost,
}

impl JobState {
    pub fn label(self) -> String {
        match self {
            Self::Queued => "queued".into(),
            Self::Running => "running".into(),
            Self::Done(code) => format!("done({code})"),
            Self::Cancelled => "cancelled".into(),
            Self::Lost => "lost".into(),
        }
    }
    pub fn is_live(self) -> bool {
        matches!(self, Self::Queued | Self::Running)
    }
}

#[derive(Clone, Debug)]
pub struct JobDir {
    pub id: String,
    pub dir: PathBuf,
}

impl JobDir {
    pub fn new(paths: &HostPaths, id: &str) -> Self {
        Self {
            id: id.to_string(),
            dir: paths.dir("jobs").join(id),
        }
    }
    pub fn alive(&self) -> PathBuf {
        self.dir.join("alive.lock")
    }
    pub fn meta(&self) -> PathBuf {
        self.dir.join("meta.json")
    }
    pub fn admitted(&self) -> PathBuf {
        self.dir.join("admitted")
    }
    pub fn exit(&self) -> PathBuf {
        self.dir.join("exit")
    }
    pub fn cancel(&self) -> PathBuf {
        self.dir.join("cancel")
    }
    pub fn cancelled(&self) -> PathBuf {
        self.dir.join("cancelled")
    }
    pub fn log(&self) -> PathBuf {
        self.dir.join("log")
    }

    pub fn read_meta(&self) -> Option<Meta> {
        serde_json::from_slice(&std::fs::read(self.meta()).ok()?).ok()
    }
    pub fn write_meta(&self, meta: &Meta) -> std::io::Result<()> {
        let bytes = serde_json::to_vec_pretty(meta).map_err(std::io::Error::other)?;
        crate::fsx::atomic_write(&self.meta(), &bytes, Some(0o600))
    }

    fn finished(&self) -> Option<JobState> {
        let code = std::fs::read_to_string(self.exit())
            .ok()?
            .trim()
            .parse::<i32>()
            .ok()?;
        Some(if self.cancelled().exists() {
            JobState::Cancelled
        } else {
            JobState::Done(code)
        })
    }

    /// Exit file first, then the liveness lock, then the exit file again: a
    /// supervisor that writes `exit` and dies between the two reads is still
    /// seen as finished, never as lost.
    pub fn state(&self) -> JobState {
        if let Some(done) = self.finished() {
            return done;
        }
        if locks::is_held(&self.alive()) {
            return if self.admitted().exists() {
                JobState::Running
            } else {
                JobState::Queued
            };
        }
        self.finished().unwrap_or(JobState::Lost)
    }

    /// When the command started, for elapsed-time display.
    pub fn admitted_at_ms(&self) -> Option<i64> {
        std::fs::read_to_string(self.admitted())
            .ok()?
            .trim()
            .parse()
            .ok()
    }
}

/// A fresh id: UTC stamp plus a short hash of pid and clock, unique enough
/// for one machine and readable in a listing.
pub fn new_id(now_ms: i64) -> String {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or_default();
    let seed = format!("{}:{nanos}:{now_ms}", std::process::id());
    let stamp = crate::time_utc::iso_seconds(now_ms).replace(['-', ':'], "");
    let stamp = stamp.trim_end_matches('Z').replace('T', "-");
    format!(
        "{}-{}",
        stamp.get(2..).unwrap_or(&stamp),
        &crate::fsx::sha256_hex(seed.as_bytes())[..6]
    )
}

/// Every job directory, newest id first.
pub fn all(paths: &HostPaths) -> Vec<JobDir> {
    let root = paths.dir("jobs");
    let Ok(entries) = std::fs::read_dir(&root) else {
        return Vec::new();
    };
    let mut ids: Vec<String> = entries
        .flatten()
        .filter(|e| e.file_type().is_ok_and(|t| t.is_dir()))
        .filter_map(|e| e.file_name().into_string().ok())
        .collect();
    ids.sort_unstable_by(|a, b| b.cmp(a));
    ids.into_iter()
        .map(|id| JobDir {
            dir: root.join(&id),
            id,
        })
        .collect()
}

/// A live job running the same command on the same tree, to attach to
/// instead of starting a second copy.
pub fn find_duplicate(paths: &HostPaths, meta: &Meta) -> Option<JobDir> {
    meta.tree_digest.as_ref()?;
    all(paths).into_iter().find(|job| {
        job.read_meta().is_some_and(|m| {
            m.worktree == meta.worktree
                && m.cmd_hash == meta.cmd_hash
                && m.tree_digest == meta.tree_digest
        }) && job.state().is_live()
    })
}

/// Remove finished and lost job directories older than the retention. Only
/// real directories directly under `jobs/`; a symlink is never followed.
pub fn sweep(paths: &HostPaths, now_ms: i64) -> usize {
    let mut removed = 0;
    for job in all(paths) {
        if job.state().is_live() {
            continue;
        }
        let modified = std::fs::symlink_metadata(&job.dir)
            .ok()
            .filter(|m| m.is_dir())
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as i64);
        if modified.is_some_and(|m| now_ms - m > RETENTION_MS) && remove_flat_dir(&job.dir) {
            removed += 1;
        }
    }
    removed
}

/// Delete a job directory's plain files, then the directory. Anything else
/// inside (a symlink, a subdirectory) leaves the directory in place.
fn remove_flat_dir(dir: &Path) -> bool {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return false;
    };
    for entry in entries.flatten() {
        if entry.file_type().is_ok_and(|t| t.is_file()) {
            let _ = std::fs::remove_file(entry.path());
        }
    }
    std::fs::remove_dir(dir).is_ok()
}
