//! What a parity case needs before it can compare anything: Node, and a built
//! TypeScript CLI to compare against.
//!
//! A missing prerequisite FAILS. Printing a skip notice and returning is what
//! this used to do elsewhere, and `cargo test` swallows that without
//! `--nocapture`: a CI leg without Node went green while the comparison never
//! ran, which is the one outcome a cross-CLI test must not have. The opt-out is
//! explicit, named in the failure message, and visible in the CI configuration
//! that uses it.
use std::path::{Path, PathBuf};
use std::process::Command;

/// The explicit opt-out, shared with the core crate's cross-reader test. Any
/// value other than `0`, `false` or empty counts.
const SKIP_ENV: &str = "MEWKIT_SKIP_NODE_PARITY";

pub struct Prerequisites {
    /// `packages/mewkit/dist/index.js` — the built npm CLI entry point.
    pub ts_cli: PathBuf,
}

pub fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
        .canonicalize()
        .expect("the repo root resolves from the crate manifest")
}

pub fn fixtures_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("parity")
        .join("fixtures")
}

fn skip_requested() -> bool {
    std::env::var(SKIP_ENV).is_ok_and(|value| !matches!(value.as_str(), "" | "0" | "false"))
}

fn node_available() -> bool {
    Command::new("node")
        .arg("--version")
        .output()
        .is_ok_and(|out| out.status.success())
}

/// The prerequisites, or `None` when the case was deliberately opted out of.
/// Panics when a prerequisite is missing WITHOUT the opt-out.
pub fn check(case: &str) -> Option<Prerequisites> {
    let ts_cli = repo_root()
        .join("packages")
        .join("mewkit")
        .join("dist")
        .join("index.js");
    let missing = if !node_available() {
        Some("node is not on PATH".to_string())
    } else if !ts_cli.exists() {
        Some(format!(
            "{} does not exist — run `npm run build` first",
            ts_cli.display()
        ))
    } else {
        None
    };
    match missing {
        None => Some(Prerequisites { ts_cli }),
        Some(reason) if skip_requested() => {
            eprintln!("parity case {case} skipped on request ({SKIP_ENV}): {reason}");
            None
        }
        Some(reason) => panic!(
            "parity case {case} cannot run: {reason}. \
             Build the npm CLI (`npm run build`) and install Node, \
             or set {SKIP_ENV}=1 to opt out deliberately."
        ),
    }
}
