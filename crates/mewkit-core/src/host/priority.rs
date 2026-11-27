//! Start a job's command at low priority in a process group of its own, and
//! stop that whole group on cancel. No shell: argv runs as given.
//!
//! macOS: `taskpolicy -d throttle` (disk I/O only: the CPU background band
//! made a test run 4-5x slower when probed). Linux: `nice -n 10`, plus
//! `ionice -c3` where present (ignored by the `none` scheduler, harmless).
//! Windows: BELOW_NORMAL_PRIORITY_CLASS, inherited by the command's children.
use std::path::Path;
use std::process::{Child, Command, Stdio};

#[cfg(target_os = "macos")]
const WRAPPERS: &[&[&str]] = &[&["/usr/sbin/taskpolicy", "-d", "throttle"]];
#[cfg(target_os = "linux")]
const WRAPPERS: &[&[&str]] = &[&["/usr/bin/ionice", "-c3"], &["/usr/bin/nice", "-n", "10"]];
#[cfg(not(any(target_os = "macos", target_os = "linux")))]
const WRAPPERS: &[&[&str]] = &[];

/// The argv actually executed: the wrappers present on this machine, then
/// the command. `lower` false (`--priority high`) runs the command as is.
pub fn wrapped_argv(argv: &[String], lower: bool) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    if lower {
        for wrapper in WRAPPERS {
            if Path::new(wrapper[0]).exists() {
                out.extend(wrapper.iter().map(|s| (*s).to_string()));
            }
        }
    }
    out.extend(argv.iter().cloned());
    out
}

/// Spawn with piped output, null stdin, own process group.
pub fn spawn(argv: &[String], lower: bool) -> std::io::Result<Child> {
    let full = wrapped_argv(argv, lower);
    let (program, rest) = full
        .split_first()
        .ok_or_else(|| std::io::Error::other("empty command"))?;
    let mut cmd = Command::new(program);
    cmd.args(rest)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        cmd.process_group(0);
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const BELOW_NORMAL_PRIORITY_CLASS: u32 = 0x0000_4000;
        const CREATE_NEW_PROCESS_GROUP: u32 = 0x0000_0200;
        let flags = if lower {
            BELOW_NORMAL_PRIORITY_CLASS
        } else {
            0
        };
        cmd.creation_flags(flags | CREATE_NEW_PROCESS_GROUP);
    }
    cmd.spawn()
}

/// Stop the command and everything it started: SIGTERM to the group, then
/// SIGKILL after `grace`; on Windows `taskkill /T /F` on the tree.
pub fn stop_tree(child: &mut Child, grace: std::time::Duration) {
    let pid = child.id().to_string();
    #[cfg(unix)]
    {
        let group = format!("-{pid}");
        let _ = Command::new("/bin/kill")
            .args(["-TERM", "--", &group])
            .stderr(Stdio::null())
            .status();
        let started = std::time::Instant::now();
        while started.elapsed() < grace {
            if matches!(child.try_wait(), Ok(Some(_))) {
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(100));
        }
        let _ = Command::new("/bin/kill")
            .args(["-KILL", "--", &group])
            .stderr(Stdio::null())
            .status();
    }
    #[cfg(windows)]
    {
        let _ = grace;
        let _ = Command::new("taskkill")
            .args(["/T", "/F", "/PID", &pid])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
    let _ = child.kill();
}

/// Exit code of a finished command; a Unix signal maps to 128 + signal.
pub fn exit_code(status: std::process::ExitStatus) -> i32 {
    if let Some(code) = status.code() {
        return code;
    }
    #[cfg(unix)]
    {
        use std::os::unix::process::ExitStatusExt;
        if let Some(signal) = status.signal() {
            return 128 + signal;
        }
    }
    1
}
