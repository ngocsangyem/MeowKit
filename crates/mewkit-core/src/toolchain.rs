//! The one place this crate starts a Python, pip or OS package-manager process.
//!
//! Everything that provisions an interpreter environment or installs a system
//! dependency reaches a subprocess through the functions here, so a test (or a
//! parity case) can put stub executables first on `PATH` and observe what would
//! have run without a real venv, a real pip or a real installer.
//!
//! Presence probes shell out to `which` (`where` on Windows) rather than walking
//! `PATH` natively, matching the npm CLI: the answer then follows whatever that
//! program resolves, including a stubbed one.
use std::io::Read;
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::time::{Duration, Instant};

use crate::js_regex::is_js_whitespace;

/// How long one `pip install` may run before it is killed.
const PIP_TIMEOUT: Duration = Duration::from_secs(120);

/// One package's install outcome.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InstallResult {
    pub name: String,
    pub success: bool,
    pub error: Option<String>,
}

/// Whether `cmd` resolves on `PATH` (`where` on Windows, `which` elsewhere).
pub fn command_available(cmd: &str) -> bool {
    let finder = if cfg!(windows) { "where" } else { "which" };
    Command::new(finder)
        .arg(cmd)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .is_ok_and(|status| status.success())
}

/// The first Python launcher on `PATH`: `py` then `python` on Windows,
/// `python3` then `python` elsewhere.
pub fn find_python() -> Option<&'static str> {
    let candidates: &[&str] = if cfg!(windows) {
        &["py", "python"]
    } else {
        &["python3", "python"]
    };
    candidates.iter().copied().find(|c| command_available(c))
}

/// Run `program args…` with captured output; `Err` carries the message Node's
/// `execFileSync` would have thrown (`Command failed: …` plus stderr).
pub fn run_checked(program: &str, args: &[&str]) -> Result<(), String> {
    let output = Command::new(program)
        .args(args)
        .stdin(Stdio::null())
        .output()
        .map_err(|e| spawn_message("spawnSync", program, &e))?;
    if output.status.success() {
        return Ok(());
    }
    let mut message = format!("Command failed: {program} {}", args.join(" "));
    if !output.stderr.is_empty() {
        message.push('\n');
        message.push_str(&String::from_utf8_lossy(&output.stderr));
    }
    Err(message)
}

/// Create a virtual environment at `env_dir` with `python -m venv`.
pub fn create_venv(python: &str, env_dir: &Path) -> Result<(), String> {
    run_checked(python, &["-m", "venv", &env_dir.to_string_lossy()])
}

/// Whether `program args…` exits 0, output discarded.
pub fn probe(program: &Path, args: &[&str]) -> bool {
    Command::new(program)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .is_ok_and(|status| status.success())
}

/// Run a shell command line with the terminal attached, as `execSync` does.
/// `Err` is the message Node would have thrown.
pub fn run_shell_inherit(command: &str, cwd: Option<&Path>) -> Result<(), String> {
    let mut cmd = if cfg!(windows) {
        let mut c = Command::new("cmd");
        c.args(["/d", "/s", "/c", command]);
        c
    } else {
        let mut c = Command::new("/bin/sh");
        c.args(["-c", command]);
        c
    };
    if let Some(dir) = cwd {
        cmd.current_dir(dir);
    }
    match cmd.status() {
        Ok(status) if status.success() => Ok(()),
        Ok(_) => Err(format!("Command failed: {command}")),
        Err(e) => Err(e.to_string()),
    }
}

/// `pip install <package>` with a timeout; each chunk pip writes on stdout goes
/// to `on_stdout` as it arrives.
pub fn pip_install(pip: &Path, package: &str, on_stdout: &mut dyn FnMut(&str)) -> InstallResult {
    pip_install_within(pip, package, PIP_TIMEOUT, on_stdout)
}

enum Chunk {
    Out(String),
    Err(String),
}

fn pump(mut stream: impl Read + Send + 'static, tx: mpsc::Sender<Chunk>, out: bool) {
    std::thread::spawn(move || {
        let mut buf = [0u8; 8192];
        while let Ok(n) = stream.read(&mut buf) {
            if n == 0 {
                break;
            }
            let text = String::from_utf8_lossy(&buf[..n]).into_owned();
            let chunk = if out {
                Chunk::Out(text)
            } else {
                Chunk::Err(text)
            };
            if tx.send(chunk).is_err() {
                break;
            }
        }
    });
}

pub(crate) fn pip_install_within(
    pip: &Path,
    package: &str,
    timeout: Duration,
    on_stdout: &mut dyn FnMut(&str),
) -> InstallResult {
    let fail = |error: String| InstallResult {
        name: package.to_string(),
        success: false,
        error: Some(error),
    };
    let mut child = match Command::new(pip)
        .args(["install", package])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(child) => child,
        Err(e) => return fail(spawn_message("spawn", &pip.to_string_lossy(), &e)),
    };
    let (tx, rx) = mpsc::channel();
    if let Some(out) = child.stdout.take() {
        pump(out, tx.clone(), true);
    }
    if let Some(err) = child.stderr.take() {
        pump(err, tx.clone(), false);
    }
    drop(tx);

    let started = Instant::now();
    let mut stderr = String::new();
    let mut timed_out = false;
    let status = loop {
        match rx.recv_timeout(Duration::from_millis(25)) {
            Ok(Chunk::Out(text)) => on_stdout(text.trim_matches(is_js_whitespace)),
            Ok(Chunk::Err(text)) => stderr.push_str(&text),
            Err(mpsc::RecvTimeoutError::Timeout) => {}
            // Both readers hit EOF: only the exit status is left to wait for.
            Err(mpsc::RecvTimeoutError::Disconnected) => {
                std::thread::sleep(Duration::from_millis(10))
            }
        }
        if let Ok(Some(status)) = child.try_wait() {
            break status;
        }
        if !timed_out && started.elapsed() >= timeout {
            timed_out = true;
            let _ = child.kill();
        }
    };
    // The readers end at EOF; anything still queued belongs to this run.
    while let Ok(chunk) = rx.recv() {
        match chunk {
            Chunk::Out(text) => on_stdout(text.trim_matches(is_js_whitespace)),
            Chunk::Err(text) => stderr.push_str(&text),
        }
    }
    if timed_out {
        stderr.push_str("\nTimeout: exceeded 120s");
    }
    if status.success() {
        return InstallResult {
            name: package.to_string(),
            success: true,
            error: None,
        };
    }
    let last = stderr
        .trim_matches(is_js_whitespace)
        .split('\n')
        .next_back()
        .filter(|line| !line.is_empty())
        .unwrap_or("Unknown error")
        .to_string();
    fail(last)
}

/// Node's wording for a process that could not start.
fn spawn_message(syscall: &str, program: &str, error: &std::io::Error) -> String {
    if error.kind() == std::io::ErrorKind::NotFound {
        format!("{syscall} {program} ENOENT")
    } else {
        format!("{syscall} {program} {error}")
    }
}

#[cfg(test)]
#[path = "toolchain_tests.rs"]
mod tests;
