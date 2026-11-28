//! The `host watcher (beta)` row: is the machine-wide watcher running, from
//! which mewkit, and how much state it keeps. Reads only; never starts or
//! stops anything.
use mewkit_core::host::clean::size_of;
use mewkit_core::host::paths::HostPaths;
use mewkit_core::host::watch;

use super::{Check, Status};

const NAME: &str = "host watcher (beta)";

pub fn check() -> Check {
    let Some(paths) = HostPaths::resolve() else {
        return Check::new(NAME, Status::Ok, "no home directory: not used");
    };
    if !paths.root.exists() {
        return Check::new(NAME, Status::Ok, "not used on this machine");
    }
    let bytes = size_of(&paths.root);
    let size = if bytes < 1_048_576 {
        format!("{} KB", bytes.div_ceil(1024))
    } else {
        format!("{:.1} MB", bytes as f64 / 1_048_576.0)
    };
    let state = format!("state {size} at {}", paths.root.display());
    if !watch::is_running(&paths) {
        return Check::new(NAME, Status::Ok, format!("not running; {state}"));
    }
    let ours = env!("CARGO_PKG_VERSION");
    match watch::read_pid(&paths) {
        Some(p) if p.version != ours => Check::new(
            NAME,
            Status::Warn,
            format!(
                "pid {} runs mewkit {}, this binary is {ours}: it exits when its binary is \
                 replaced, or run `mewkit host watch --detach` to swap it now; {state}",
                p.pid, p.version
            ),
        ),
        Some(p) => Check::new(
            NAME,
            Status::Ok,
            format!("running, pid {}, mewkit {}; {state}", p.pid, p.version),
        ),
        None => Check::new(NAME, Status::Ok, format!("starting; {state}")),
    }
}
