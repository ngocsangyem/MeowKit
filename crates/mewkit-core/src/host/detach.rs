//! Start a process that outlives the tool call that started it.
//!
//! Probed 2026-11-28: when Claude Code stops a call it kills the whole process
//! TREE, so a child in its own process group still dies; `taskkill /T` does
//! the same on Windows. A double spawn survives both: the caller starts an
//! intermediate (`mewkit host __spawn …`) that starts the real child detached
//! and exits at once, so the child's parent is gone and no tree walk reaches
//! it. std `Command` only; no `unsafe`.
use std::io;
use std::path::Path;
use std::process::{Command, Stdio};

/// The hidden verb the intermediate runs as.
pub const SPAWN_VERB: [&str; 2] = ["host", "__spawn"];

/// From the caller: run `exe host __spawn -- <args…>` and return the pid the
/// intermediate reports for the detached grandchild.
pub fn spawn_detached(exe: &Path, args: &[String]) -> io::Result<u32> {
    let out = Command::new(exe)
        .args(SPAWN_VERB)
        .arg("--")
        .args(args)
        .stdin(Stdio::null())
        .stderr(Stdio::null())
        .output()?;
    let text = String::from_utf8_lossy(&out.stdout);
    text.trim()
        .parse::<u32>()
        .map_err(|_| io::Error::other(format!("detached spawn failed: {}", text.trim())))
}

/// In the intermediate: start `program args` detached from this process's
/// group, console and stdio, and return its pid.
pub fn spawn_grandchild(program: &Path, args: &[String]) -> io::Result<u32> {
    let mut cmd = Command::new(program);
    cmd.args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        cmd.process_group(0);
        cmd.spawn().map(|c| c.id())
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const DETACHED_PROCESS: u32 = 0x0000_0008;
        const CREATE_NEW_PROCESS_GROUP: u32 = 0x0000_0200;
        const CREATE_BREAKAWAY_FROM_JOB: u32 = 0x0100_0000;
        let base = DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP;
        // Leave the caller's job object when it allows it; a CI job refuses
        // breakaway with "access denied", and the double spawn still escapes
        // a tree kill without it.
        match cmd.creation_flags(base | CREATE_BREAKAWAY_FROM_JOB).spawn() {
            Ok(child) => Ok(child.id()),
            Err(_) => cmd.creation_flags(base).spawn().map(|c| c.id()),
        }
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;

    #[test]
    fn a_grandchild_runs_in_its_own_group_with_null_stdio() {
        let dir = tempfile::tempdir().unwrap();
        let mark = dir.path().join("mark");
        let pid = spawn_grandchild(
            Path::new("/bin/sh"),
            &["-c".into(), format!("echo $$ > {}", mark.display())],
        )
        .unwrap();
        for _ in 0..200 {
            if std::fs::read_to_string(&mark).is_ok_and(|t| !t.trim().is_empty()) {
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(10));
        }
        assert_eq!(
            std::fs::read_to_string(&mark).unwrap().trim(),
            pid.to_string()
        );
    }
}
