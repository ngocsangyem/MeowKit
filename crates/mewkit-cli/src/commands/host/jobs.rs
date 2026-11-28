//! `host jobs list|wait|log|cancel`.
use std::time::{Duration, Instant};

use clap::{Args, Subcommand};
use mewkit_core::host::client::wait_quietly;
use mewkit_core::host::jobs::{self, JobDir, JobState};
use mewkit_core::host::paths::HostPaths;
use mewkit_core::host::{joblog, time_now_ms, worktree};

use super::block;
use super::signals::{CANCEL_GRACE, Signals};
use crate::failure::{Failure, OK};

/// How much of a finished job's log `jobs wait` prints.
const WAIT_TAIL: usize = 64 * 1024;

#[derive(Args, Debug)]
pub struct JobsArgs {
    #[command(subcommand)]
    pub command: JobsCommand,
}

#[derive(Subcommand, Debug)]
pub enum JobsCommand {
    /// List this worktree's jobs, newest first.
    List {
        /// Every worktree's jobs on this machine, with the worktree path.
        #[arg(long)]
        all: bool,
    },
    /// Wait for a job: its exit code when done, 75 while queued or running,
    /// 70 when lost or cancelled.
    Wait {
        id: String,
        /// Give up after this long (default: under the agent's tool timeout).
        #[arg(long)]
        timeout: Option<String>,
    },
    /// Print a job's log (secrets masked, last 2 MB at most).
    Log { id: String },
    /// Ask a job's supervisor to stop it.
    Cancel {
        id: String,
        /// Also stop a job started from another worktree.
        #[arg(long)]
        any_worktree: bool,
    },
}

/// The worktree this command runs in, spelled as jobs record it.
fn here() -> Option<String> {
    let cwd = std::env::current_dir().ok()?;
    worktree::git_toplevel(&cwd).map(|t| worktree::normalize(&t.to_string_lossy()))
}

/// The recorded worktree of `job` when it is not this one.
fn foreign(job: &JobDir) -> Option<String> {
    let theirs = job.read_meta().and_then(|m| m.worktree);
    (theirs != here()).then(|| theirs.unwrap_or_else(|| "no worktree".into()))
}

/// Say on stderr that `job` belongs to another worktree, so its result is
/// never mistaken for this project's.
fn note_foreign(job: &JobDir) {
    if let Some(theirs) = foreign(job) {
        eprintln!(
            "mewkit host: job {} ran in another worktree ({theirs}), not this one",
            job.id
        );
    }
}

fn find(paths: &HostPaths, id: &str) -> Result<JobDir, Failure> {
    if jobs::valid_id(id) && JobDir::new(paths, id).meta().exists() {
        Ok(JobDir::new(paths, id))
    } else {
        Err(Failure::failed(format!(
            "no job {id}; see `mewkit host jobs list`"
        )))
    }
}

pub fn run(args: &JobsArgs) -> Result<u8, Failure> {
    let paths = super::host_paths()?;
    match &args.command {
        JobsCommand::List { all } => {
            let here = here();
            for job in jobs::all(&paths) {
                let meta = job.read_meta().unwrap_or_default();
                if !all && meta.worktree != here {
                    continue;
                }
                let place = if *all {
                    meta.worktree.as_deref().unwrap_or("-")
                } else {
                    meta.worktree
                        .as_deref()
                        .and_then(|w| w.rsplit('/').next())
                        .unwrap_or("-")
                };
                let class = meta.cmd_class.as_deref().unwrap_or("-");
                println!(
                    "{}  {:<10} {:<10} {:<9} {place}",
                    job.id,
                    job.state().label(),
                    meta.exe_base,
                    class
                );
            }
            Ok(OK)
        }
        JobsCommand::Wait { id, timeout } => {
            let job = find(&paths, id)?;
            note_foreign(&job);
            let wait = block::wait_for("--timeout", timeout.as_deref())?;
            let signals = Signals::install();
            let mut state = wait_quietly(&job, Instant::now() + wait, &|| signals.arrived());
            if state.is_live() && signals.cancel_if_interactive(&job) {
                state = wait_quietly(&job, Instant::now() + CANCEL_GRACE, &|| false);
            }
            match state {
                JobState::Done(_) => print!("{}", joblog::tail(&job.log(), WAIT_TAIL)),
                JobState::Queued | JobState::Running => {
                    let since = job
                        .admitted_at_ms()
                        .or(job.read_meta().map(|m| m.enqueued_at_ms))
                        .unwrap_or(time_now_ms());
                    let elapsed =
                        Duration::from_millis(u64::try_from(time_now_ms() - since).unwrap_or(0));
                    block::print(&paths, &job, state, elapsed);
                }
                JobState::Lost | JobState::Cancelled => {
                    block::report_lost_or_cancelled(&paths, &job, state);
                }
            }
            Ok(block::code_for(state))
        }
        JobsCommand::Log { id } => {
            let job = find(&paths, id)?;
            note_foreign(&job);
            print!("{}", joblog::tail(&job.log(), joblog::LOG_CAP as usize));
            Ok(OK)
        }
        JobsCommand::Cancel { id, any_worktree } => {
            let job = find(&paths, id)?;
            if let Some(theirs) = foreign(&job)
                && !any_worktree
            {
                return Err(Failure::failed(format!(
                    "job {id} belongs to another worktree ({theirs}); pass --any-worktree to stop it anyway"
                )));
            }
            if !job.state().is_live() {
                println!("job {id} already ended: {}", job.state().label());
                return Ok(OK);
            }
            mewkit_core::fsx::atomic_write(&job.cancel(), b"1", Some(0o600))?;
            println!("asked job {id} to stop");
            Ok(OK)
        }
    }
}
