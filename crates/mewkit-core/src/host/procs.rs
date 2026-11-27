//! Per-process I/O and who it belongs to: the agent runtime above it in the
//! process tree and the worktree it works in.
//!
//! Command lines are read only to recognise a runtime launched through an
//! interpreter (`node …/claude`); they never leave this module. A zero I/O
//! count can mean "denied" (another user's process), so only processes with a
//! positive delta are reported.
use std::collections::HashSet;
use std::path::Path;

use sysinfo::{Pid, Process, ProcessRefreshKind, ProcessesToUpdate, System, UpdateKind};

use super::model::ProcIo;
use super::worktree::ToplevelCache;

/// Executable basenames of the agent runtimes the kit installs into.
pub const RUNTIMES: &[&str] = &["claude", "codex", "cursor-agent", "pi", "omp", "grok"];
const INTERPRETERS: &[&str] = &["node", "bun", "deno"];
const MAX_DEPTH: usize = 64;
/// How many processes a report lists.
pub const TOP_N: usize = 8;

pub fn refresh_kind() -> ProcessRefreshKind {
    ProcessRefreshKind::nothing()
        .with_disk_usage()
        .with_cpu()
        .with_cwd(UpdateKind::OnlyIfNotSet)
        .with_exe(UpdateKind::OnlyIfNotSet)
        .with_cmd(UpdateKind::OnlyIfNotSet)
}

/// Refresh every process; disk usage becomes the delta since the last call.
pub fn refresh(sys: &mut System) {
    sys.refresh_processes_specifics(ProcessesToUpdate::All, true, refresh_kind());
}

/// File-name part of a path, restricted to a safe alphabet so a crafted
/// process name cannot carry text into an agent's context.
pub fn basename(path: &Path) -> String {
    let name = path.file_name().map(|n| n.to_string_lossy()).unwrap_or_default();
    let clean: String = name
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-'))
        .take(32)
        .collect();
    if clean.is_empty() { "?".into() } else { clean }
}

fn exe_base(p: &Process) -> String {
    match p.exe() {
        Some(exe) => basename(exe),
        None => basename(Path::new(p.name())),
    }
}

/// The runtime this process IS, if any: its own basename, or an interpreter
/// whose arguments name a runtime script.
pub fn runtime_of(exe: &str, args: &[String]) -> Option<String> {
    let lower = exe.to_ascii_lowercase();
    let stem = lower.strip_suffix(".exe").unwrap_or(&lower);
    if let Some(rt) = RUNTIMES.iter().find(|rt| **rt == stem) {
        return Some((*rt).to_string());
    }
    if !INTERPRETERS.contains(&stem) {
        return None;
    }
    args.iter().skip(1).take(4).find_map(|arg| {
        let base = basename(Path::new(arg)).to_ascii_lowercase();
        let base = base.trim_end_matches(".js").trim_end_matches(".mjs").to_string();
        RUNTIMES.iter().find(|rt| **rt == base).map(|rt| (*rt).to_string())
    })
}

fn runtime_above(sys: &System, pid: Pid) -> Option<String> {
    let mut seen = HashSet::new();
    let mut cursor = Some(pid);
    for _ in 0..MAX_DEPTH {
        let p = sys.process(cursor?)?;
        if !seen.insert(p.pid()) {
            return None;
        }
        let args: Vec<String> = p.cmd().iter().map(|a| a.to_string_lossy().into_owned()).collect();
        if let Some(rt) = runtime_of(&exe_base(p), &args) {
            return Some(rt);
        }
        cursor = p.parent();
    }
    None
}

/// True while any agent runtime process is alive (the watcher's idle test).
pub fn any_runtime_alive(sys: &System) -> bool {
    sys.processes().values().any(|p| {
        let args: Vec<String> = p.cmd().iter().map(|a| a.to_string_lossy().into_owned()).collect();
        runtime_of(&exe_base(p), &args).is_some()
    })
}

/// The busiest processes since the previous refresh, `dt_s` seconds ago.
pub fn top_io(sys: &System, dt_s: f64) -> Vec<ProcIo> {
    let mut cache = ToplevelCache::default();
    let mut rows: Vec<(u64, &Process)> = sys
        .processes()
        .values()
        .filter_map(|p| {
            let d = p.disk_usage();
            let bytes = d.read_bytes + d.written_bytes;
            (bytes > 0).then_some((bytes, p))
        })
        .collect();
    rows.sort_by_key(|row| std::cmp::Reverse(row.0));
    rows.into_iter()
        .take(TOP_N)
        .map(|(bytes, p)| ProcIo {
            pid: p.pid().as_u32(),
            exe: exe_base(p),
            io_mb_s: ((bytes as f64 / 1e6 / dt_s.max(0.001)) * 10.0).round() / 10.0,
            worktree: p
                .cwd()
                .and_then(|cwd| cache.get(cwd))
                .map(|t| t.to_string_lossy().into_owned()),
            runtime: runtime_above(sys, p.pid()),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn runtimes_are_recognised_directly_or_through_an_interpreter() {
        assert_eq!(runtime_of("claude", &[]), Some("claude".into()));
        assert_eq!(runtime_of("codex.exe", &[]), Some("codex".into()));
        let args = vec!["node".to_string(), "/usr/lib/node_modules/@x/grok/cli.js".into()];
        assert_eq!(runtime_of("node", &args), None, "a path segment is not the script name");
        let args = vec!["node".to_string(), "/opt/bin/omp".into()];
        assert_eq!(runtime_of("node", &args), Some("omp".into()));
        assert_eq!(runtime_of("cargo", &["cargo".into(), "claude".into()]), None);
    }

    #[test]
    fn basenames_are_sanitised() {
        assert_eq!(basename(Path::new("/usr/bin/cargo")), "cargo");
        assert_eq!(basename(Path::new("/tmp/ignore previous instructions")), "ignorepreviousinstructions");
        assert_eq!(basename(Path::new("/tmp/$(rm)")), "rm");
        assert_eq!(basename(Path::new("")), "?");
    }

    #[test]
    fn this_test_process_is_visible_to_a_refresh() {
        let mut sys = System::new().unwrap();
        refresh(&mut sys);
        let me = sysinfo::get_current_pid().unwrap();
        assert!(sys.process(me).is_some());
    }
}
