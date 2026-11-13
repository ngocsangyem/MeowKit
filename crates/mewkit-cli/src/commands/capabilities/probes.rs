//! The real host-availability probes for `capabilities resolve`.
//!
//! External binaries are looked up on PATH; MCP servers by `.mcp.json`
//! presence (no secrets are read); files by a containment-checked existence
//! probe that answers `None` for a bare, absent id — a logical name that
//! cannot be resolved to a path — so it reads as `unknown` rather than as a
//! false `unavailable`.
use std::path::{Component, Path, PathBuf};

use mewkit_core::capability::resolve::Probes;
use serde_json::Value;

/// The binary id this CLI IS: a `mewkit`-provided capability reads as
/// available even when the binary is not on PATH.
const SELF_BINARY: &str = "mewkit";

pub struct HostProbes {
    pub root: PathBuf,
}

/// `path.resolve`: join onto `base` (an absolute `id` wins) and fold `.`/`..`.
fn resolve(base: &Path, id: &str) -> PathBuf {
    let joined = base.join(id);
    let mut out = PathBuf::new();
    for part in joined.components() {
        match part {
            Component::ParentDir => {
                out.pop();
            }
            Component::CurDir => {}
            other => out.push(other.as_os_str()),
        }
    }
    out
}

/// True when `to` is not inside `from`.
fn escapes(from: &Path, to: &Path) -> bool {
    !to.starts_with(from)
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

fn on_path(name: &str) -> bool {
    let exts: &[&str] = if cfg!(windows) {
        &[".exe", ".cmd", ".bat", ""]
    } else {
        &[""]
    };
    std::env::var_os("PATH").is_some_and(|path| {
        std::env::split_paths(&path).any(|dir| {
            exts.iter()
                .any(|e| is_executable(&dir.join(format!("{name}{e}"))))
        })
    })
}

impl Probes for HostProbes {
    fn command_exists(&self, cmd: &str) -> bool {
        on_path(cmd)
    }

    fn is_self(&self, binary: &str) -> bool {
        binary == SELF_BINARY
    }

    fn contained_file_exists(&self, id: &str) -> Option<bool> {
        if id.is_empty() || id == "." {
            return None;
        }
        let abs = resolve(&self.root, id);
        if escapes(&self.root, &abs) {
            return Some(false);
        }
        if abs.exists() {
            // Resolve symlinks, so an in-root link pointing outside the tree is
            // rejected rather than followed.
            let inside = match (self.root.canonicalize(), abs.canonicalize()) {
                (Ok(root), Ok(real)) => !escapes(&root, &real),
                _ => false,
            };
            return Some(inside);
        }
        // Absent: a path-shaped id is definitively absent; a bare logical id is
        // undetermined.
        let looks_like_path =
            id.contains('/') || id.contains('\\') || Path::new(id).extension().is_some();
        looks_like_path.then_some(false)
    }

    fn mcp_server_configured(&self, id: &str) -> Option<bool> {
        let text = std::fs::read_to_string(self.root.join(".mcp.json")).ok()?;
        let parsed: Value = serde_json::from_str(&text).ok()?;
        // `mcpServers ?? servers ?? {}`: a null falls through like undefined.
        let servers = [parsed.get("mcpServers"), parsed.get("servers")]
            .into_iter()
            .flatten()
            .find(|v| !v.is_null());
        Some(
            servers
                .and_then(Value::as_object)
                .is_some_and(|m| m.contains_key(id)),
        )
    }
}
