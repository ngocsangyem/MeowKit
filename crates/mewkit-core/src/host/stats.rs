//! Local beta counters in `~/.meowkit/host/stats.json`: how often the runner
//! queued, ran long, lost or cancelled a job. Never sent anywhere; updated
//! under `stats.lock` with an atomic write; a failed update is skipped.
use std::collections::BTreeMap;
use std::time::Duration;

use super::locks;
use super::paths::{HostPaths, read_json};

pub const COUNTERS: &[&str] = &[
    "runs",
    "exit75_queued",
    "exit75_running",
    "lost",
    "cancelled",
    "fail_open_30min",
    "admitted_under_throttle",
];

pub fn read(paths: &HostPaths) -> BTreeMap<String, u64> {
    read_json(&paths.stats()).unwrap_or_default()
}

pub fn bump(paths: &HostPaths, counter: &str) {
    if paths.ensure().is_err() {
        return;
    }
    let Ok(Some(_guard)) = locks::hold_within(&paths.dir("stats.lock"), Duration::from_secs(2))
    else {
        return;
    };
    let mut counts = read(paths);
    *counts.entry(counter.to_string()).or_insert(0) += 1;
    if let Ok(bytes) = serde_json::to_vec_pretty(&counts) {
        let _ = crate::fsx::atomic_write(&paths.stats(), &bytes, Some(0o600));
    }
}
