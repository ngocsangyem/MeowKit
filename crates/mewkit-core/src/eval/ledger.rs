//! One cost ledger per project, so concurrent eval runs share one ceiling.
//!
//! Each `mewkit eval run` is a session in the ledger. Before every run it
//! reserves under the lock: the spend of all active sessions plus the expected
//! cost of the next run must stay within its ceiling, and its own run count
//! within `--max-runs`. A session older than a day that never ended (a killed
//! process) no longer counts.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::fsx::atomic_write;
use crate::sidecar_lock::SidecarLock;
use crate::time_utc::now_millis;

const STALE_SESSION_MS: i64 = 24 * 60 * 60 * 1000;

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub id: String,
    pub started_ms: i64,
    pub spent_usd: f64,
    pub runs: u32,
    pub active: bool,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LedgerFile {
    pub sessions: Vec<Session>,
}

impl LedgerFile {
    fn live_spend(&self, now: i64) -> f64 {
        self.sessions
            .iter()
            .filter(|s| s.active && now - s.started_ms < STALE_SESSION_MS)
            .map(|s| s.spent_usd)
            .sum()
    }

    /// May session `id` start one more run expected to cost `estimate`?
    pub fn may_run(&self, id: &str, now: i64, max_usd: f64, max_runs: u32, estimate: f64) -> bool {
        let own_runs = self
            .sessions
            .iter()
            .find(|s| s.id == id)
            .map_or(0, |s| s.runs);
        own_runs < max_runs && self.live_spend(now) + estimate <= max_usd
    }

    fn session(&mut self, id: &str) -> Option<&mut Session> {
        self.sessions.iter_mut().find(|s| s.id == id)
    }
}

#[derive(Debug, thiserror::Error)]
pub enum LedgerError {
    #[error("eval ledger lock: {0}")]
    Lock(#[from] crate::sidecar_lock::SidecarLockError),
    #[error("eval ledger {path}: {source}")]
    Io { path: String, source: io::Error },
    #[error("eval ledger {path} is not valid JSON; move it aside to start a new one")]
    Corrupt { path: String },
}

pub struct Ledger {
    path: PathBuf,
    lock: PathBuf,
    id: String,
}

impl Ledger {
    /// The ledger under `telemetry_dir`, for the session `id`.
    pub fn new(telemetry_dir: &Path, id: &str) -> Self {
        Self {
            path: telemetry_dir.join("eval-ledger.json"),
            lock: telemetry_dir.join("eval-ledger.lock"),
            id: id.to_owned(),
        }
    }

    fn with<T>(&self, f: impl FnOnce(&mut LedgerFile) -> T) -> Result<T, LedgerError> {
        let _guard = SidecarLock::acquire(&self.lock)?;
        let io_err = |source| LedgerError::Io {
            path: self.path.display().to_string(),
            source,
        };
        let mut file = match fs::read_to_string(&self.path) {
            Ok(text) => serde_json::from_str(&text).map_err(|_| LedgerError::Corrupt {
                path: self.path.display().to_string(),
            })?,
            Err(e) if e.kind() == io::ErrorKind::NotFound => LedgerFile::default(),
            Err(e) => return Err(io_err(e)),
        };
        let out = f(&mut file);
        let bytes = serde_json::to_vec_pretty(&file).expect("ledger serialises");
        atomic_write(&self.path, &bytes, None).map_err(io_err)?;
        Ok(out)
    }

    pub fn begin(&self) -> Result<(), LedgerError> {
        let id = self.id.clone();
        self.with(|f| {
            f.sessions.push(Session {
                id,
                started_ms: now_millis(),
                active: true,
                ..Session::default()
            })
        })
    }

    /// Reserve one run; false means the ceiling or the run cap stops here.
    pub fn reserve(&self, max_usd: f64, max_runs: u32, estimate: f64) -> Result<bool, LedgerError> {
        self.with(|f| f.may_run(&self.id, now_millis(), max_usd, max_runs, estimate))
    }

    pub fn record(&self, cost_usd: f64) -> Result<(), LedgerError> {
        self.with(|f| {
            if let Some(s) = f.session(&self.id) {
                s.spent_usd += cost_usd;
                s.runs += 1;
            }
        })
    }

    pub fn end(&self) -> Result<(), LedgerError> {
        self.with(|f| {
            if let Some(s) = f.session(&self.id) {
                s.active = false;
            }
        })
    }
}
