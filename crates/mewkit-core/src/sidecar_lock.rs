//! Mutual exclusion on a file shared with a writer in another language.
//!
//! Port of `core/file-lock.ts` (and the `.cjs` sidecar lock the hooks use). The
//! lock is a SEPARATE file holding `<pid>\n<ms-epoch>\n`, published by hard-link
//! so it is never observable half-written. That shape and the reclaim rule are a
//! cross-language contract: a bash writer, the npm CLI and this crate contend on
//! the same path with the same protocol, so they mutually exclude. Locking a
//! file descriptor instead ([`crate::lock`]) locks a different object, and the
//! two writers would not see each other at all.
//!
//! ## The one divergence from the TypeScript rule
//!
//! TypeScript reclaims a lock whose owner PID is dead OR whose stamp is older
//! than [`STALE_MS`]; this reclaims on the STAMP ONLY. Asking whether a PID is
//! alive needs `kill(pid, 0)`, i.e. `libc`, and this workspace forbids `unsafe`;
//! a `/proc` probe would answer on Linux and nowhere else, which is worse than
//! one rule everywhere. The divergence is fail-closed — a lock a live process
//! holds is never taken from it — and its cost is bounded: for up to a minute
//! after a crash this writer waits (and then gives up) where the npm CLI would
//! reclaim at once. Every caller here treats a failed append as advisory.
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

use crate::time_utc::now_millis;

/// A lock older than this is abandoned (its owner crashed).
pub const STALE_MS: i64 = 60_000;
/// How long a waiter spins before giving up on the lock.
pub const ACQUIRE_TIMEOUT_MS: i64 = 10_000;
const RETRY_MS: u64 = 100;

/// A per-attempt counter, so two attempts from this process in the same
/// millisecond cannot collide on the scratch name they publish through.
static ATTEMPT: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, thiserror::Error)]
pub enum SidecarLockError {
    #[error("could not acquire lock {path} within {}s", ACQUIRE_TIMEOUT_MS / 1000)]
    Timeout { path: String },
    #[error("cannot use lock file {path}: {source}")]
    Io { path: String, source: io::Error },
}

/// Held for the life of the value; dropping it releases the lock.
pub struct SidecarLock {
    path: PathBuf,
}

impl SidecarLock {
    /// Take the lock at `path`, waiting up to [`ACQUIRE_TIMEOUT_MS`].
    pub fn acquire(path: &Path) -> Result<Self, SidecarLockError> {
        let io_err = |source| SidecarLockError::Io {
            path: path.display().to_string(),
            source,
        };
        if let Some(dir) = path.parent() {
            fs::create_dir_all(dir).map_err(io_err)?;
        }
        let started = now_millis();
        loop {
            match publish(path) {
                Ok(true) => {
                    return Ok(Self {
                        path: path.to_path_buf(),
                    });
                }
                Ok(false) => {}
                Err(e) => return Err(io_err(e)),
            }
            // A reclaim frees the lock right now, so it retries without backing
            // off; a lock someone holds waits. The timeout is checked on EVERY
            // pass, reclaim included, or a waiter hot-spins without bound.
            let reclaimed = match fs::read_to_string(path) {
                Ok(content) if is_reclaimable(&content) => {
                    reclaim(path, &content);
                    true
                }
                // Vanished or unreadable between the link and the read: retry.
                _ => false,
            };
            if now_millis() - started > ACQUIRE_TIMEOUT_MS {
                return Err(SidecarLockError::Timeout {
                    path: path.display().to_string(),
                });
            }
            if !reclaimed {
                std::thread::sleep(std::time::Duration::from_millis(RETRY_MS));
            }
        }
    }
}

impl Drop for SidecarLock {
    fn drop(&mut self) {
        // Best effort: the lock may already be gone (reclaimed as stale).
        let _ = fs::remove_file(&self.path);
    }
}

fn lock_content() -> String {
    format!("{}\n{}\n", std::process::id(), now_millis())
}

/// Write the full content to a private name, then hard-link it into place.
/// `link` is the only step that can win the lock, and it fails rather than
/// clobbering, so a waiter never reads a partially-written lock file.
fn publish(path: &Path) -> io::Result<bool> {
    let attempt = ATTEMPT.fetch_add(1, Ordering::Relaxed);
    let scratch = sibling(path, &format!("{}.{attempt}.pub", std::process::id()));
    fs::write(&scratch, lock_content())?;
    let won = match fs::hard_link(&scratch, path) {
        Ok(()) => true,
        Err(e) if e.kind() == io::ErrorKind::AlreadyExists => false,
        Err(e) => {
            let _ = fs::remove_file(&scratch);
            return Err(e);
        }
    };
    let _ = fs::remove_file(&scratch);
    Ok(won)
}

/// An UNPARSEABLE lock counts as HELD, not as reclaimable: fail closed, since a
/// lock we cannot read is a lock someone may hold.
fn is_reclaimable(content: &str) -> bool {
    let mut lines = content.split('\n');
    let _pid = lines.next();
    let Some(stamp) = lines.next().and_then(|s| s.trim().parse::<i64>().ok()) else {
        return false;
    };
    now_millis() - stamp > STALE_MS
}

/// Reclaim a lock judged stale WITHOUT ever deleting one we did not verify:
/// rename it to a private name (only one racer can move a given entry), re-read
/// it, and unlink only when it is byte-for-byte the stale snapshot inspected. A
/// file that changed under us belongs to a fresh owner, so it is put back with a
/// link — which fails rather than clobbering a still-newer lock.
fn reclaim(path: &Path, snapshot: &str) {
    let owned = sibling(
        path,
        &format!("{}.{}.reclaim", std::process::id(), now_millis()),
    );
    if fs::rename(path, &owned).is_err() {
        return; // another waiter moved it already — just retry the acquire loop
    }
    if fs::read_to_string(&owned).is_ok_and(|found| found == snapshot) {
        let _ = fs::remove_file(&owned);
        return;
    }
    let _ = fs::hard_link(&owned, path);
    let _ = fs::remove_file(&owned);
}

/// `<lock path>.<suffix>`, kept in the lock's own directory so the rename that
/// claims a stale lock stays on one filesystem.
fn sibling(path: &Path, suffix: &str) -> PathBuf {
    let mut name = path.as_os_str().to_os_string();
    name.push(".");
    name.push(suffix);
    PathBuf::from(name)
}

#[cfg(test)]
#[path = "sidecar_lock_tests.rs"]
mod tests;
