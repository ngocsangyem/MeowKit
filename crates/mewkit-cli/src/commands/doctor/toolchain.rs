//! Is `node` there (kit hooks run on it), and which CLIs are on `PATH`.
use std::path::{Path, PathBuf};
use std::process::Command;

use super::{Check, Status};

pub fn checks() -> Vec<Check> {
    let mut out = vec![node()];
    // `mk` and `mewkit-next` are the names the installer links to this binary. A `mewkit`
    // that resolves elsewhere may be the npm CLI's shim, which this report makes visible.
    for name in ["mewkit", "mk", "mewkit-next"] {
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

/// The first `PATH` entry holding an executable `name`.
pub fn which(name: &str) -> Option<PathBuf> {
    let exts: &[&str] = if cfg!(windows) {
        &[".exe", ".cmd", ".bat", ""]
    } else {
        &[""]
    };
    std::env::split_paths(&std::env::var_os("PATH")?).find_map(|dir| {
        exts.iter()
            .map(|e| dir.join(format!("{name}{e}")))
            .find(|p| is_executable(p))
    })
}

#[cfg(unix)]
fn is_executable(p: &Path) -> bool {
    use std::os::unix::fs::PermissionsExt;
    p.metadata()
        .is_ok_and(|m| m.is_file() && m.permissions().mode() & 0o111 != 0)
}

#[cfg(not(unix))]
fn is_executable(p: &Path) -> bool {
    p.is_file()
}
