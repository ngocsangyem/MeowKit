//! The admission queue: one ticket per waiting job, as a pair of files.
//! `queue/<seq>.json` holds the data (written atomically, never locked);
//! `queue/<seq>.lock` is held by the owning supervisor for as long as the
//! ticket is live. A ticket whose lock is free belongs to a dead supervisor and
//! is swept by whoever reads the queue next.
use std::fs::File;
use std::io;
use std::path::{Path, PathBuf};
use std::time::Duration;

use serde::{Deserialize, Serialize};

use super::locks;

/// Waiting this long raises a ticket one priority level (anti-starvation).
pub const AGING_MS: i64 = 10 * 60 * 1000;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Priority {
    Low,
    #[default]
    Normal,
    High,
}

impl Priority {
    pub fn parse(text: &str) -> Option<Self> {
        match text {
            "low" => Some(Self::Low),
            "normal" => Some(Self::Normal),
            "high" => Some(Self::High),
            _ => None,
        }
    }

    pub fn level(self) -> i64 {
        match self {
            Self::Low => 0,
            Self::Normal => 1,
            Self::High => 2,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Ticket {
    pub seq: u64,
    pub priority: Priority,
    pub enqueued_at_ms: i64,
    pub pid: u32,
    pub job_id: String,
    pub worktree: String,
    pub exe_base: String,
    pub cmd_class: Option<String>,
    pub cmd_hash: String,
}

impl Ticket {
    pub fn effective(&self, now_ms: i64) -> i64 {
        self.priority.level() + (now_ms - self.enqueued_at_ms).max(0) / AGING_MS
    }
}

pub struct Queue {
    dir: PathBuf,
}

/// Held by the supervisor while its ticket is live; dropping it ends the claim.
pub struct TicketGuard {
    pub ticket: Ticket,
    _lock: File,
    json: PathBuf,
    lock_path: PathBuf,
}

impl TicketGuard {
    /// Leave the queue: data first, so no reader sees a live lock without data.
    pub fn leave(self) {
        let _ = std::fs::remove_file(&self.json);
        let lock_path = self.lock_path.clone();
        drop(self);
        let _ = std::fs::remove_file(lock_path);
    }
}

impl Queue {
    pub fn new(dir: &Path) -> Self {
        Self {
            dir: dir.to_path_buf(),
        }
    }

    fn json(&self, seq: u64) -> PathBuf {
        self.dir.join(format!("{seq:012}.json"))
    }
    fn lock(&self, seq: u64) -> PathBuf {
        self.dir.join(format!("{seq:012}.lock"))
    }

    /// Add `ticket` with the next sequence number. Under the counter lock,
    /// seq = max(counter, highest live seq) + 1, so a crash between writing
    /// a ticket and the counter can never hand out a live number twice.
    pub fn enqueue(&self, mut ticket: Ticket) -> io::Result<TicketGuard> {
        super::paths::create_private_dir(&self.dir)?;
        let _counter_lock =
            locks::hold_within(&self.dir.join("seq.lock"), Duration::from_secs(10))?
                .ok_or_else(|| io::Error::other("queue counter lock busy"))?;
        let counter_file = self.dir.join("seq");
        let counter = std::fs::read_to_string(&counter_file)
            .ok()
            .and_then(|t| t.trim().parse::<u64>().ok())
            .unwrap_or(0);
        let highest = self.live().iter().map(|t| t.seq).max().unwrap_or(0);
        ticket.seq = counter.max(highest) + 1;
        // Lock before data: a data file without a held lock reads as dead.
        let lock = locks::try_hold(&self.lock(ticket.seq))?
            .ok_or_else(|| io::Error::other("ticket lock taken"))?;
        let json = serde_json::to_vec(&ticket).map_err(io::Error::other)?;
        crate::fsx::atomic_write(&self.json(ticket.seq), &json, Some(0o600))?;
        crate::fsx::atomic_write(
            &counter_file,
            ticket.seq.to_string().as_bytes(),
            Some(0o600),
        )?;
        Ok(TicketGuard {
            json: self.json(ticket.seq),
            lock_path: self.lock(ticket.seq),
            ticket,
            _lock: lock,
        })
    }

    /// Live tickets in file order; dead ones are swept as they are found.
    pub fn live(&self) -> Vec<Ticket> {
        let Ok(entries) = std::fs::read_dir(&self.dir) else {
            return Vec::new();
        };
        let mut out = Vec::new();
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().is_none_or(|e| e != "json") {
                continue;
            }
            let Some(ticket) = std::fs::read(&path)
                .ok()
                .and_then(|b| serde_json::from_slice::<Ticket>(&b).ok())
            else {
                continue;
            };
            if locks::is_held(&self.lock(ticket.seq)) {
                out.push(ticket);
            } else {
                let _ = std::fs::remove_file(&path);
                let _ = std::fs::remove_file(self.lock(ticket.seq));
            }
        }
        out
    }

    /// Admission order: effective priority (aged), then seq, enqueue time, pid.
    pub fn ordered(&self, now_ms: i64) -> Vec<Ticket> {
        let mut tickets = self.live();
        tickets.sort_by(|a, b| {
            b.effective(now_ms)
                .cmp(&a.effective(now_ms))
                .then(a.seq.cmp(&b.seq))
                .then(a.enqueued_at_ms.cmp(&b.enqueued_at_ms))
                .then(a.pid.cmp(&b.pid))
        });
        tickets
    }

    /// 0-based position of `seq` in admission order, `None` when not queued.
    pub fn position(&self, seq: u64, now_ms: i64) -> Option<usize> {
        self.ordered(now_ms).iter().position(|t| t.seq == seq)
    }
}
