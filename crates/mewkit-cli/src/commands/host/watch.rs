//! `host watch [--detach | --stop]`: the machine-wide watcher.
use std::time::{Duration, Instant};

use clap::Args;
use mewkit_core::host::paths::HostPaths;
use mewkit_core::host::watch::{self, Options, Outcome};
use mewkit_core::host::{detach, worktree};

use crate::failure::{Failure, OK};

#[derive(Args, Debug)]
pub struct WatchArgs {
    /// Start the watcher in the background and print its pid.
    #[arg(long, conflicts_with = "stop")]
    pub detach: bool,
    /// Stop the running watcher.
    #[arg(long)]
    pub stop: bool,
    /// Allow a binary inside a git checkout (developing the kit itself).
    #[arg(long, hide = true)]
    pub dev_binary: bool,
}

/// The watcher runs with the user's rights for hours, so it starts only from
/// an installed `mewkit`, never from a binary inside a project checkout.
fn installed_exe(dev: bool) -> Result<std::path::PathBuf, Failure> {
    let exe = std::env::current_exe()?;
    let exe = exe.canonicalize().unwrap_or(exe);
    let in_checkout = exe.parent().and_then(worktree::git_toplevel).is_some();
    if in_checkout && !dev {
        return Err(Failure::failed(format!(
            "refusing to start the watcher from {}: it is inside a git checkout; use the installed mewkit",
            exe.display()
        )));
    }
    Ok(exe)
}

fn wait_until(timeout: Duration, cond: impl Fn() -> bool) -> bool {
    let started = Instant::now();
    while started.elapsed() < timeout {
        if cond() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(100));
    }
    cond()
}

fn terminate(pid: u32) {
    #[cfg(unix)]
    let _ = std::process::Command::new("/bin/kill")
        .args(["-TERM", &pid.to_string()])
        .status();
    #[cfg(windows)]
    let _ = std::process::Command::new("taskkill")
        .args(["/F", "/PID", &pid.to_string()])
        .status();
}

fn stop(paths: &HostPaths) -> Result<u8, Failure> {
    let f = watch::files(paths);
    if !watch::is_running(paths) {
        println!("watcher not running");
        return Ok(OK);
    }
    let before = watch::read_pid(paths);
    watch::mark(&f.no_autostart)?;
    watch::mark(&f.stop)?;
    if !wait_until(Duration::from_secs(20), || !watch::is_running(paths)) {
        // Kill only the watcher we asked to stop: same pid, same lock epoch,
        // lock still held. A pid reused by another process is left alone.
        if let (Some(b), Some(now)) = (&before, watch::read_pid(paths))
            && b == &now
            && watch::is_running(paths)
        {
            terminate(now.pid);
        }
    }
    let _ = std::fs::remove_file(&f.stop);
    println!("watcher stopped");
    Ok(OK)
}

pub fn run(args: &WatchArgs) -> Result<u8, Failure> {
    let paths = HostPaths::resolve().ok_or_else(|| Failure::failed("HOME is not set"))?;
    if args.stop {
        return stop(&paths);
    }
    let exe = installed_exe(args.dev_binary)?;
    if watch::is_running(&paths) {
        let pid = watch::read_pid(&paths).map_or("?".into(), |p| p.pid.to_string());
        println!("watcher already running, pid {pid}");
        return Ok(OK);
    }
    if args.detach {
        let mut child_args = vec!["host".to_string(), "watch".into()];
        if args.dev_binary {
            child_args.push("--dev-binary".into());
        }
        detach::spawn_detached(&exe, &child_args)?;
        if wait_until(Duration::from_secs(10), || {
            watch::read_pid(&paths).is_some()
        }) {
            let pid = watch::read_pid(&paths).map_or(0, |p| p.pid);
            println!("watcher running, pid {pid}");
            return Ok(OK);
        }
        return Err(Failure::failed("the watcher did not start within 10 s"));
    }
    let opts = Options {
        interval: watch::INTERVAL,
        idle_exit_ms: watch::IDLE_EXIT_MS,
        binary_path: exe.to_string_lossy().into_owned(),
        version: env!("CARGO_PKG_VERSION").into(),
        max_ticks: None,
    };
    match watch::run(&paths, &opts)? {
        Outcome::AlreadyRunning(pid) => println!(
            "watcher already running, pid {}",
            pid.map_or("?".into(), |p| p.to_string())
        ),
        other => println!("watcher exited: {other:?}"),
    }
    Ok(OK)
}
