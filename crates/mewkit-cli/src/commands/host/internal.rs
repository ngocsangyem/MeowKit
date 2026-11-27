//! Hidden verbs the runner starts itself; not for people or agents.
//! `__spawn` only ever starts this same `mewkit` binary, so nothing else can
//! be launched detached through it.
use clap::Args;
use mewkit_core::host::config::HostConfig;
use mewkit_core::host::jobs::JobDir;
use mewkit_core::host::paths::HostPaths;
use mewkit_core::host::slots::k_for;
use mewkit_core::host::supervisor::{self, Options};
use mewkit_core::host::{detach, status};

use crate::failure::{FAILED, Failure, OK};

#[derive(Args, Debug)]
pub struct SpawnArgs {
    /// Arguments for the detached `mewkit` process.
    #[arg(required = true, last = true)]
    pub args: Vec<String>,
}

#[derive(Args, Debug)]
pub struct SuperviseArgs {
    pub id: String,
    /// Run the command at normal priority (`--priority high`).
    #[arg(long)]
    pub no_lower: bool,
    #[arg(required = true, last = true)]
    pub command: Vec<String>,
}

pub fn spawn(args: &SpawnArgs) -> Result<u8, Failure> {
    let exe = std::env::current_exe()?;
    let pid = detach::spawn_grandchild(&exe, &args.args)?;
    println!("{pid}");
    Ok(OK)
}

pub fn supervise(args: &SuperviseArgs) -> Result<u8, Failure> {
    let paths = HostPaths::resolve().ok_or_else(|| Failure::failed("HOME is not set"))?;
    let job = JobDir::new(&paths, &args.id);
    let max_heavy = usize::from(HostConfig::for_paths(&paths).max_heavy);
    let space: Vec<std::path::PathBuf> = std::env::current_dir().into_iter().collect();
    let admission = || {
        let verdict = status(&paths, false, &space).data.verdict;
        (k_for(verdict, max_heavy), verdict)
    };
    let opts = Options {
        lower: !args.no_lower,
        ..Options::default()
    };
    let code = supervisor::run(&paths, &job, &args.command, &opts, &admission);
    Ok(if code == 0 { OK } else { FAILED })
}
