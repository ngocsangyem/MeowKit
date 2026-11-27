//! The fixed block `host run` and `host jobs wait` print when they hand
//! control back before the job has finished. Its first line is the whole
//! message for an agent that reads nothing else: the check has NOT passed.
use std::time::Duration;

use mewkit_core::host::client::queue_position;
use mewkit_core::host::jobs::{JobDir, JobState};
use mewkit_core::host::paths::HostPaths;
use mewkit_core::host::snapshot;

/// Exit code: queued or still running, not verified (EX_TEMPFAIL).
pub const NOT_DONE: u8 = 75;
/// Exit code: the job was lost or cancelled; never a pass.
pub const LOST_OR_CANCELLED: u8 = 70;

pub fn headline(state: JobState) -> &'static str {
    match state {
        JobState::Queued => "QUEUED — NOT STARTED — NOT VERIFIED",
        _ => "STILL RUNNING — NOT VERIFIED",
    }
}

fn secs(d: Duration) -> String {
    let s = d.as_secs();
    if s >= 60 {
        format!("{}m{:02}s", s / 60, s % 60)
    } else {
        format!("{s}s")
    }
}

/// Print the block to stdout.
pub fn print(paths: &HostPaths, job: &JobDir, state: JobState, elapsed: Duration) {
    println!("{}", headline(state));
    println!("  job       {}", job.id);
    println!("  elapsed   {}", secs(elapsed));
    if let Some(env) = snapshot::read(&paths.status()) {
        let r = &env.data;
        let cpu = r
            .cpu
            .as_ref()
            .and_then(|c| c.busy_pct)
            .map_or("n/a".into(), |v| format!("{v:.0}%"));
        let thermal = r.thermal.map_or("n/a".into(), |t| t.to_string());
        println!(
            "  host      {} · cpu {cpu} · thermal {thermal}",
            r.verdict.as_str().to_uppercase()
        );
    }
    if state == JobState::Queued
        && let Some(pos) = queue_position(paths, job)
    {
        println!("  queue     position {}", pos + 1);
    }
    println!(
        "  next      mewkit host jobs wait {}   (the result, when it ends)",
        job.id
    );
    println!("            meanwhile: a narrower related check, or other work");
    println!("            do not re-run the same command: it attaches to this job");
}

/// Exit code for a job state reached at the end of a wait.
pub fn code_for(state: JobState) -> u8 {
    match state {
        JobState::Done(code) => u8::try_from(code).unwrap_or(1),
        JobState::Queued | JobState::Running => NOT_DONE,
        JobState::Lost | JobState::Cancelled => LOST_OR_CANCELLED,
    }
}
