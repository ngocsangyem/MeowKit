//! Is `node` there (kit hooks run on it), and which CLIs are on `PATH`.
use std::process::Command;

use super::{Check, Status};
use crate::path_lookup::which;

pub fn checks() -> Vec<Check> {
    let mut out = vec![node()];
    // `mk` is the name the installer links to this binary. A `mewkit` that resolves
    // elsewhere may be the npm CLI's shim, which this report makes visible.
    for name in ["mewkit", "mk"] {
        out.push(match which(name) {
            Some(path) => Check::new(
                format!("{name} on PATH"),
                Status::Ok,
                format!("`{name}` runs {}", path.display()),
            ),
            None => Check::new(
                format!("{name} on PATH"),
                Status::Ok,
                format!("`{name}` is not on PATH"),
            ),
        });
    }
    out
}

fn node() -> Check {
    match Command::new("node").arg("--version").output() {
        Ok(out) if out.status.success() => Check::new(
            "node",
            Status::Ok,
            String::from_utf8_lossy(&out.stdout).trim().to_owned(),
        ),
        _ => Check::new(
            "node",
            Status::Warn,
            "node was not found: the kit's hooks run on node, so none of them can run",
        ),
    }
}
