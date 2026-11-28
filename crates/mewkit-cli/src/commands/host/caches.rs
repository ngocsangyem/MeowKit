//! `host status --caches`: Rust space users, for the agent to propose to the
//! user. Measuring walks trees, so it is skipped under a `hold` verdict.
use std::path::PathBuf;

use mewkit_core::host::cache_report::{auto_clean_disabled, cargo_cache_sizes, target_dirs};
use mewkit_core::host::jobs;
use mewkit_core::host::model::{Report, Verdict};
use mewkit_core::host::paths::HostPaths;
use mewkit_core::host::worktree::git_toplevel;

fn gib(bytes: u64) -> String {
    if bytes >= 1 << 30 {
        format!("{:.1} GiB", bytes as f64 / (1u64 << 30) as f64)
    } else {
        format!("{:.0} MiB", bytes as f64 / (1u64 << 20) as f64)
    }
}

/// The current worktree, worktrees seen loading the disk, and job worktrees.
fn known_worktrees(paths: &HostPaths, report: &Report) -> Vec<PathBuf> {
    let mut out: Vec<PathBuf> = std::env::current_dir()
        .ok()
        .and_then(|d| git_toplevel(&d))
        .into_iter()
        .collect();
    out.extend(
        report
            .top_io
            .iter()
            .filter_map(|p| p.worktree.as_ref().map(PathBuf::from)),
    );
    out.extend(
        jobs::all(paths)
            .iter()
            .filter_map(|j| j.read_meta()?.worktree.map(PathBuf::from)),
    );
    out.sort();
    out.dedup();
    out
}

pub fn print(paths: &HostPaths, report: &Report) {
    println!("caches (report only; mewkit deletes none of these)");
    if report.verdict == Verdict::Hold {
        println!("  skipped: the host is under hold and measuring would add disk load");
        return;
    }
    let targets = target_dirs(&known_worktrees(paths, report));
    if targets.is_empty() {
        println!("  no target/ dirs in known worktrees");
    }
    for t in &targets {
        let dir = t
            .path
            .parent()
            .map_or_else(String::new, |p| p.display().to_string());
        println!(
            "  {:>9}  {}   (cargo clean, run in {dir})",
            gib(t.bytes),
            t.path.display()
        );
    }
    let home = mewkit_core::config::home_dir().unwrap_or_default();
    let cwd = std::env::current_dir().unwrap_or_default();
    let env = std::env::var("CARGO_CACHE_AUTO_CLEAN_FREQUENCY").ok();
    if let Some(source) = auto_clean_disabled(&cwd, &home, env.as_deref()) {
        let (registry, git) = cargo_cache_sizes(&home);
        println!("  note: Cargo's automatic cache cleaning is off (\"never\" in {source});");
        println!(
            "        ~/.cargo/registry {} · ~/.cargo/git {}",
            gib(registry),
            gib(git)
        );
    }
}
