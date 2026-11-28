//! `host run [--priority] [--wait] [--background] -- <cmd>`: hand a heavy
//! command to a detached supervisor and follow it for a bounded time.
use std::process::Command;
use std::time::{Duration, Instant};

use clap::Args;
use mewkit_core::host::client::{follow, prepare, wait_for_supervisor, wait_quietly};
use mewkit_core::host::config::HostConfig;
use mewkit_core::host::jobs::{self, JobState};
use mewkit_core::host::paths::HostPaths;
use mewkit_core::host::queue::Priority;
use mewkit_core::host::{detach, stats, time_now_ms};

use super::block;
use super::signals::{CANCEL_GRACE, Signals};
use crate::failure::{FAILED, Failure};

#[derive(Args, Debug)]
pub struct RunArgs {
    /// Queue level. high also runs the command at normal OS priority; low
    /// waits behind other levels (a long wait still ages it forward).
    #[arg(long, default_value = "normal", value_parser = ["high", "normal", "low"])]
    pub priority: String,
    /// Return after this long (e.g. 90s, 2m) with exit 75 if not finished.
    /// Default: under the calling agent runtime's tool timeout.
    #[arg(long)]
    pub wait: Option<String>,
    /// Return at once with the job id (exit 75).
    #[arg(long)]
    pub background: bool,
    /// The command and its arguments, run without a shell.
    #[arg(required = true, last = true)]
    pub command: Vec<String>,
}

/// Run the command in the foreground, unqueued: admission disabled or broken.
fn run_directly(argv: &[String]) -> Result<u8, Failure> {
    let status = Command::new(&argv[0])
        .args(&argv[1..])
        .status()
        .map_err(|e| Failure::failed(format!("cannot run {}: {e}", argv[0])))?;
    Ok(status
        .code()
        .and_then(|c| u8::try_from(c).ok())
        .unwrap_or(FAILED))
}

pub fn run(args: &RunArgs) -> Result<u8, Failure> {
    let wait = block::wait_for("--wait", args.wait.as_deref())?;
    let Some(paths) = HostPaths::resolve() else {
        return run_directly(&args.command);
    };
    if !HostConfig::for_paths(&paths).enabled {
        return run_directly(&args.command);
    }
    jobs::sweep(&paths, time_now_ms());
    let priority = Priority::parse(&args.priority).unwrap_or_default();
    let cwd = std::env::current_dir()?;
    let started = Instant::now();
    let Ok(prepared) = prepare(&paths, &args.command, &cwd, priority) else {
        return run_directly(&args.command);
    };
    let job = prepared.job;
    if prepared.attached {
        eprintln!(
            "mewkit host: attached to running job {} (same command, same tree)",
            job.id
        );
    } else {
        let mut sup = vec!["host".to_string(), "__supervise".into(), job.id.clone()];
        if priority == Priority::High {
            sup.push("--no-lower".into());
        }
        sup.push("--".into());
        sup.extend(args.command.iter().cloned());
        let spawned = std::env::current_exe().and_then(|exe| detach::spawn_detached(&exe, &sup));
        if spawned.is_err() || !wait_for_supervisor(&job, Duration::from_secs(5)) {
            eprintln!("mewkit host: could not start the job supervisor; running directly");
            return run_directly(&args.command);
        }
        eprintln!("mewkit host: job {} queued", job.id);
    }
    let deadline = if args.background {
        started
    } else {
        started + wait
    };
    let signals = Signals::install();
    let mut state = follow(&job, deadline, &mut std::io::stdout(), &|| {
        signals.arrived()
    });
    if state.is_live() && signals.cancel_if_interactive(&job) {
        state = wait_quietly(&job, Instant::now() + CANCEL_GRACE, &|| false);
    }
    match state {
        JobState::Queued | JobState::Running => {
            stats::bump(
                &paths,
                if state == JobState::Queued {
                    "exit75_queued"
                } else {
                    "exit75_running"
                },
            );
            block::print(&paths, &job, state, started.elapsed());
        }
        JobState::Lost | JobState::Cancelled => {
            block::report_lost_or_cancelled(&paths, &job, state)
        }
        JobState::Done(_) => {}
    }
    Ok(block::code_for(state))
}
