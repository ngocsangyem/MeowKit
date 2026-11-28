//! The supervisor's output side: each stream copied into the log as whole,
//! scrubbed lines, and the drain after the command exits, which keeps
//! honouring a cancel and stops whatever the command left holding its output.
use std::io::Read;
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

use super::joblog::{CappedLog, Lines};
use super::jobs::JobDir;
use super::supervisor::note;

/// After the command itself exits, how long processes it left behind may
/// keep its output open before they are stopped and the slot is freed.
pub const DRAIN_GRACE: Duration = Duration::from_secs(10);

/// Copy one output stream into the log as whole, scrubbed lines.
pub fn pump(
    mut from: impl Read + Send + 'static,
    log: Arc<Mutex<CappedLog>>,
) -> std::thread::JoinHandle<()> {
    std::thread::spawn(move || {
        let mut buf = [0u8; 8192];
        let mut lines = Lines::default();
        let store = |bytes: Vec<u8>| {
            if !bytes.is_empty()
                && let Ok(mut log) = log.lock()
            {
                let _ = log.write(&bytes);
            }
        };
        while let Ok(n) = from.read(&mut buf) {
            if n == 0 {
                break;
            }
            store(lines.push(&buf[..n]));
        }
        store(lines.finish());
    })
}

/// Stop every process left in the command's group, after the command itself
/// has been reaped (its pid is the group id).
fn stop_group(leader: u32) {
    #[cfg(unix)]
    let _ = std::process::Command::new("/bin/kill")
        .args(["-KILL", "--", &format!("-{leader}")])
        .stderr(std::process::Stdio::null())
        .status();
    #[cfg(windows)]
    let _ = std::process::Command::new("taskkill")
        .args(["/T", "/F", "/PID", &leader.to_string()])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status();
}

/// Wait for the output pumps after the command exited. A cancel seen now
/// stops the group and counts; past [`DRAIN_GRACE`] the leftovers are
/// stopped. Returns whether the job was cancelled.
pub fn drain(
    pumps: Vec<JoinHandle<()>>,
    job: &JobDir,
    leader: u32,
    log: &Mutex<CappedLog>,
    mut cancelled: bool,
) -> bool {
    let until = Instant::now() + DRAIN_GRACE;
    while pumps.iter().any(|p| !p.is_finished()) {
        if !cancelled && job.cancel().exists() {
            cancelled = true;
            stop_group(leader);
        } else if Instant::now() >= until {
            note(
                log,
                "processes the command left behind still held its output; stopped them",
            );
            stop_group(leader);
            break;
        }
        std::thread::sleep(Duration::from_millis(100));
    }
    // Stopped processes close their output at once: give the pumps a moment
    // to store the last lines.
    let flush_until = Instant::now() + Duration::from_secs(1);
    while pumps.iter().any(|p| !p.is_finished()) && Instant::now() < flush_until {
        std::thread::sleep(Duration::from_millis(20));
    }
    for p in pumps {
        if p.is_finished() {
            let _ = p.join();
        }
    }
    cancelled
}
