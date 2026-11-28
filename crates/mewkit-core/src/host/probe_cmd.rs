//! Run one system probe (`ioreg`, `sysctl`, `notifyutil`) by absolute path with
//! a deadline. Never through `PATH`, so a project-local binary named `ioreg`
//! cannot answer for the system; never through a shell.
use std::io::Read;
use std::path::Path;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

/// The command's stdout when it exits 0 within `timeout`; `None` otherwise
/// (missing binary, non-zero exit, timeout — the caller reports "unavailable").
pub fn run(program: &str, args: &[&str], timeout: Duration) -> Option<String> {
    if !Path::new(program).is_absolute() {
        return None;
    }
    let mut child = Command::new(program)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .ok()?;
    // Read on a thread: a probe that fills the pipe would otherwise never exit.
    let mut out = child.stdout.take()?;
    let reader = std::thread::spawn(move || {
        let mut text = String::new();
        out.read_to_string(&mut text).map(|_| text)
    });
    let started = Instant::now();
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) if started.elapsed() >= timeout => {
                let _ = child.kill();
                let _ = child.wait();
                return None;
            }
            Ok(None) => std::thread::sleep(Duration::from_millis(5)),
            Err(_) => return None,
        }
    };
    let text = reader.join().ok()?.ok()?;
    status.success().then_some(text)
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;

    #[test]
    fn a_relative_program_is_refused() {
        assert_eq!(run("echo", &["hi"], Duration::from_secs(1)), None);
    }

    #[test]
    fn stdout_comes_back_and_a_slow_probe_times_out() {
        assert_eq!(
            run("/bin/echo", &["hi"], Duration::from_secs(5)).as_deref(),
            Some("hi\n")
        );
        let started = Instant::now();
        assert_eq!(run("/bin/sleep", &["5"], Duration::from_millis(100)), None);
        assert!(started.elapsed() < Duration::from_secs(2));
    }
}
