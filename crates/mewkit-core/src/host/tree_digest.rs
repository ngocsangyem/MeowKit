//! The working-tree digest, byte-for-byte the one the completion check in
//! `.claude/hooks/lib/core/completion-check.cjs` computes, so a job's recorded
//! digest can be compared with the tree an agent later claims was verified.
//! HEAD, every tracked change (staged or not) and the untracked files by size
//! and mtime; kit state that changes on every hook run is excluded.
use std::path::Path;
use std::process::{Command, Stdio};

use sha2::{Digest, Sha256};

use crate::fsx::hex;

/// Paths excluded from the digest (the hook's `IGNORED_PATHS`).
pub const IGNORED_PATHS: &[&str] = &[
    ".meowkit/state",
    ".meowkit/telemetry",
    ".meowkit/cache",
    "session-state",
    ".claude/session-state",
    ".claude/logs",
    ".claude/cache",
];

fn git(dir: &Path, args: &[&str]) -> Option<Vec<u8>> {
    let out = Command::new("git")
        .args(args)
        .current_dir(dir)
        .stdin(Stdio::null())
        .stderr(Stdio::null())
        .output()
        .ok()?;
    out.status.success().then_some(out.stdout)
}

fn text(bytes: Vec<u8>) -> String {
    String::from_utf8_lossy(&bytes).trim().to_string()
}

/// Node's `Stats.mtimeMs`: sec * 1e3 + nsec / 1e6 as a double, printed the
/// way JavaScript prints a number (shortest round-trip, which Rust matches).
fn mtime_ms(meta: &std::fs::Metadata) -> Option<String> {
    let since = meta
        .modified()
        .ok()?
        .duration_since(std::time::UNIX_EPOCH)
        .ok()?;
    let ms = since.as_secs() as f64 * 1e3 + f64::from(since.subsec_nanos()) / 1e6;
    Some(format!("{ms}"))
}

/// The digest for the worktree containing `root`, `None` outside a git
/// worktree or when git fails.
pub fn tree_digest(root: &Path) -> Option<String> {
    if text(git(root, &["rev-parse", "--is-inside-work-tree"])?) != "true" {
        return None;
    }
    let top_text = text(git(root, &["rev-parse", "--show-toplevel"])?);
    let top = Path::new(&top_text);
    let excludes: Vec<String> = IGNORED_PATHS
        .iter()
        .map(|p| format!(":(exclude){p}"))
        .collect();
    let mut hash = Sha256::new();
    let head = git(top, &["rev-parse", "HEAD"])
        .map(text)
        .unwrap_or_else(|| "no-head".into());
    hash.update(format!("head:{head}\n"));
    let run = |lead: &[&str]| {
        let mut args: Vec<&str> = lead.to_vec();
        args.extend(["--", "."]);
        args.extend(excludes.iter().map(String::as_str));
        git(top, &args)
    };
    let diff = ["--binary", "--no-ext-diff", "--no-color"];
    if head == "no-head" {
        hash.update(run(&[&["diff"][..], &diff].concat())?);
        hash.update(run(&[&["diff", "--cached"][..], &diff].concat())?);
    } else {
        hash.update(run(&[&["diff", "HEAD"][..], &diff].concat())?);
    }
    let listed = run(&["ls-files", "--others", "--exclude-standard", "-z"])?;
    let mut untracked: Vec<String> = String::from_utf8_lossy(&listed)
        .split('\0')
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .collect();
    // JavaScript's default sort compares UTF-16 units; for the ASCII paths a
    // repository nearly always holds this is byte order.
    untracked.sort();
    for rel in untracked {
        let stamp = std::fs::metadata(top.join(&rel))
            .ok()
            .and_then(|m| mtime_ms(&m).map(|ms| format!("{}:{ms}", m.len())))
            .unwrap_or_else(|| "gone".into());
        hash.update(format!("untracked:{rel}:{stamp}\n"));
    }
    Some(hex(&hash.finalize()))
}
