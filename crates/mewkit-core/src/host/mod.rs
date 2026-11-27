//! `mewkit host` (beta): how loaded this machine is, who loads it, and
//! whether a heavy command should start now.
//!
//! Fails open everywhere: a probe that cannot run makes its metric missing
//! (verdict `unknown`), a state file that cannot be written is skipped, and
//! nothing here ever blocks a command on its own error.
pub mod client;
pub mod cmd_class;
pub mod collect;
pub mod config;
pub mod detach;
pub mod inbox;
pub mod joblog;
pub mod jobs;
pub mod locks;
pub mod model;
pub mod paths;
pub mod priority;
pub mod probe_cmd;
pub mod procs;
pub mod queue;
pub mod sample;
pub mod slots;
pub mod snapshot;
pub mod stats;
pub mod supervisor;
pub mod tree_digest;
pub mod verdict;
pub mod wait_default;
pub mod watch;
pub mod worktree;

#[cfg(test)]
mod queue_slots_tests;
#[cfg(test)]
mod supervisor_tests;
#[cfg(test)]
mod tree_digest_tests;
#[cfg(test)]
mod verdict_tests;
#[cfg(test)]
mod watch_inbox_tests;

use std::path::PathBuf;

use collect::{COLD_WAIT, Collector, WARM_WAIT};
use model::{Os, Reason, Report, Verdict};
use paths::HostPaths;
use snapshot::Envelope;

/// A snapshot younger than this is served as is by `host status`.
pub const FRESH_MS: i64 = 10_000;

pub fn time_now() -> i64 {
    time_now_ms()
}

pub(crate) fn time_now_ms() -> i64 {
    crate::time_utc::now_millis()
}

/// A report that says only why nothing could be measured.
pub fn unknown_report(code: &str, detail: &str) -> Report {
    Report {
        beta: true,
        verdict: Verdict::Unknown,
        reasons: vec![Reason {
            code: code.into(),
            detail: detail.into(),
        }],
        sampled_at: crate::time_utc::iso_seconds(time_now_ms()),
        os: Os::current(),
        cpu: None,
        memory: None,
        disk: None,
        space: Vec::new(),
        thermal: None,
        top_io: Vec::new(),
        proc_scope: "host".into(),
    }
}

/// The current status: the stored snapshot when fresh (unless `fresh`), else
/// a new sample, stored for the next caller.
pub fn status(paths: &HostPaths, fresh: bool, space_paths: &[PathBuf]) -> Envelope {
    if !paths.version_readable() {
        let report = unknown_report(
            "state_newer",
            "host state was written by a newer mewkit; upgrade this binary",
        );
        return Envelope::new(report, None);
    }
    let now = time_now_ms();
    let stored = snapshot::read(&paths.status());
    if !fresh
        && let Some(env) = &stored
        && snapshot::age_ms(env, now).is_some_and(|age| (0..=FRESH_MS).contains(&age))
    {
        return env.clone();
    }
    let Some(mut collector) = Collector::new() else {
        return Envelope::new(
            unknown_report("sampler_unavailable", "cannot sample this platform"),
            None,
        );
    };
    let baseline = stored
        .as_ref()
        .and_then(|env| snapshot::usable_baseline(env, now));
    collector.prime(baseline);
    std::thread::sleep(if baseline.is_some() {
        WARM_WAIT
    } else {
        COLD_WAIT
    });
    let (report, counters) = collector.sample(space_paths);
    let env = Envelope::new(report, Some(counters));
    if paths.ensure().is_ok() {
        let _ = snapshot::write(&paths.status(), &env);
    }
    env
}
