//! Heavy-command slots. A running job holds `slots/<n>.lock`; admission
//! counts held locks under `slots/admit.lock`, so two supervisors can never
//! both see room for one. When K shrinks, running jobs keep their slots and
//! nobody new is admitted until the held count drops below K.
use std::fs::File;
use std::io;
use std::path::{Path, PathBuf};
use std::time::Duration;

use serde::{Deserialize, Serialize};

use super::locks;
use super::model::Verdict;

/// The most slot files ever probed; `host.max_heavy` is clamped to 8.
pub const MAX_SLOTS: usize = 8;
/// K moves at most once per this interval, so a flapping verdict cannot
/// admit and stall in turns.
pub const K_HYSTERESIS_MS: i64 = 30_000;

/// Target concurrency for a verdict.
pub fn k_for(verdict: Verdict, max_heavy: usize) -> usize {
    match verdict {
        Verdict::Go => max_heavy.clamp(1, MAX_SLOTS),
        Verdict::Throttle | Verdict::Unknown => 1,
        Verdict::Hold | Verdict::Clean => 0,
    }
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
struct KState {
    k: usize,
    changed_at_ms: i64,
}

pub struct Slots {
    dir: PathBuf,
}

/// A held slot; dropping it frees the slot.
pub struct SlotGuard {
    pub index: usize,
    _lock: File,
}

impl Slots {
    pub fn new(dir: &Path) -> Self {
        Self {
            dir: dir.to_path_buf(),
        }
    }

    fn slot(&self, n: usize) -> PathBuf {
        self.dir.join(format!("{n}.lock"))
    }

    pub fn held(&self) -> usize {
        (0..MAX_SLOTS)
            .filter(|n| locks::is_held(&self.slot(*n)))
            .count()
    }

    /// K after hysteresis: the stored K unless `target` differs and the last
    /// change is at least 30 s old. Call with the admit lock held.
    fn effective_k(&self, target: usize, now_ms: i64) -> usize {
        let file = self.dir.join("k.json");
        let stored = std::fs::read(&file)
            .ok()
            .and_then(|b| serde_json::from_slice::<KState>(&b).ok());
        let next = match stored {
            Some(s) if s.k == target => return s.k,
            Some(s) if now_ms - s.changed_at_ms < K_HYSTERESIS_MS && now_ms >= s.changed_at_ms => {
                return s.k;
            }
            _ => KState {
                k: target,
                changed_at_ms: now_ms,
            },
        };
        if let Ok(bytes) = serde_json::to_vec(&next) {
            let _ = crate::fsx::atomic_write(&file, &bytes, Some(0o600));
        }
        next.k
    }

    /// Take a slot when fewer than K are held. `Ok(None)` means "not now".
    pub fn try_admit(&self, target_k: usize, now_ms: i64) -> io::Result<Option<SlotGuard>> {
        super::paths::create_private_dir(&self.dir)?;
        let Some(_admit) =
            locks::hold_within(&self.dir.join("admit.lock"), Duration::from_secs(2))?
        else {
            return Ok(None);
        };
        let k = self.effective_k(target_k, now_ms);
        if self.held() >= k {
            return Ok(None);
        }
        for n in 0..MAX_SLOTS {
            if let Some(lock) = locks::try_hold(&self.slot(n))? {
                return Ok(Some(SlotGuard {
                    index: n,
                    _lock: lock,
                }));
            }
        }
        Ok(None)
    }
}
