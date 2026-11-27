//! One inbox file per loaded worktree, `inbox/<key>.json`, written by the
//! watcher every tick and read (never consumed) by every agent session in
//! that worktree. Only numbers, pids, basenames and enum codes: nothing an
//! agent could mistake for an instruction.
use std::collections::BTreeMap;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use super::jobs::{self, JobState};
use super::model::{Report, Verdict};
use super::paths::HostPaths;
use super::queue::Queue;
use super::worktree::{inbox_key, normalize};

pub const SCHEMA_VERSION: u32 = 1;
/// Inbox files older than this are deleted by the watcher.
pub const PRUNE_MS: i64 = 10 * 60 * 1000;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Action {
    WaitQueue,
    NarrowCheck,
    DeferHeavy,
    FreeSpace,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Heavy {
    pub pid: u32,
    pub exe: String,
    pub io_mb_s: f64,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Entry {
    pub schema_version: u32,
    pub worktree: String,
    pub verdict: Verdict,
    pub severity: String,
    pub heavy: Vec<Heavy>,
    /// 1-based queue positions of this worktree's queued jobs.
    pub queued: Vec<usize>,
    pub held_slots: usize,
    pub action: Option<Action>,
    pub written_at_ms: i64,
}

fn severity(verdict: Verdict) -> &'static str {
    match verdict {
        Verdict::Go | Verdict::Unknown => "low",
        Verdict::Throttle | Verdict::Clean => "medium",
        Verdict::Hold => "high",
    }
}

fn action(verdict: Verdict, queued: bool) -> Option<Action> {
    match verdict {
        Verdict::Clean => Some(Action::FreeSpace),
        _ if queued => Some(Action::WaitQueue),
        Verdict::Hold => Some(Action::DeferHeavy),
        Verdict::Throttle => Some(Action::NarrowCheck),
        Verdict::Go | Verdict::Unknown => None,
    }
}

/// One entry per worktree with attributed I/O, a queued job or a held slot.
pub fn entries(paths: &HostPaths, report: &Report, now_ms: i64) -> Vec<Entry> {
    let mut by_tree: BTreeMap<String, Entry> = BTreeMap::new();
    fn slot<'a>(
        map: &'a mut BTreeMap<String, Entry>,
        report: &Report,
        now_ms: i64,
        tree: &str,
    ) -> &'a mut Entry {
        let tree = normalize(tree);
        map.entry(tree.clone()).or_insert_with(|| Entry {
            schema_version: SCHEMA_VERSION,
            worktree: tree,
            verdict: report.verdict,
            severity: severity(report.verdict).into(),
            heavy: Vec::new(),
            queued: Vec::new(),
            held_slots: 0,
            action: None,
            written_at_ms: now_ms,
        })
    }
    for p in &report.top_io {
        if let Some(tree) = &p.worktree {
            slot(&mut by_tree, report, now_ms, tree).heavy.push(Heavy {
                pid: p.pid,
                exe: p.exe.clone(),
                io_mb_s: p.io_mb_s,
            });
        }
    }
    for (i, t) in Queue::new(&paths.dir("queue"))
        .ordered(now_ms)
        .iter()
        .enumerate()
    {
        if !t.worktree.is_empty() {
            slot(&mut by_tree, report, now_ms, &t.worktree)
                .queued
                .push(i + 1);
        }
    }
    for job in jobs::all(paths) {
        if job.state() == JobState::Running
            && let Some(tree) = job.read_meta().and_then(|m| m.worktree)
        {
            slot(&mut by_tree, report, now_ms, &tree).held_slots += 1;
        }
    }
    by_tree
        .into_values()
        .map(|mut e| {
            e.action = action(e.verdict, !e.queued.is_empty());
            e
        })
        .collect()
}

fn file_for(paths: &HostPaths, worktree: &str) -> PathBuf {
    paths
        .dir("inbox")
        .join(format!("{}.json", inbox_key(worktree)))
}

/// Write every entry, then delete inbox files older than the prune age.
pub fn publish(paths: &HostPaths, entries: &[Entry], now_ms: i64) {
    if super::paths::create_private_dir(&paths.dir("inbox")).is_err() {
        return;
    }
    for e in entries {
        if let Ok(bytes) = serde_json::to_vec(e) {
            let _ = crate::fsx::atomic_write(&file_for(paths, &e.worktree), &bytes, Some(0o600));
        }
    }
    prune(paths, now_ms);
}

pub fn prune(paths: &HostPaths, now_ms: i64) {
    let Ok(dir) = std::fs::read_dir(paths.dir("inbox")) else {
        return;
    };
    for entry in dir.flatten() {
        let stale = entry
            .metadata()
            .ok()
            .filter(|m| m.is_file())
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .is_some_and(|d| now_ms - d.as_millis() as i64 > PRUNE_MS);
        if stale {
            let _ = std::fs::remove_file(entry.path());
        }
    }
}

/// The entry for `worktree`, left in place for the next reader.
pub fn read(paths: &HostPaths, worktree: &str) -> Option<Entry> {
    serde_json::from_slice(&std::fs::read(file_for(paths, &normalize(worktree))).ok()?).ok()
}
