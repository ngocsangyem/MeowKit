//! `host status [--json] [--fresh] [--caches]`. The verdict is data, so the exit code is
//! 0 whatever it says; a script reads `data.verdict` from `--json`.
use std::path::PathBuf;

use clap::Args;
use mewkit_core::host::model::Report;
use mewkit_core::host::paths::HostPaths;
use mewkit_core::host::snapshot::Envelope;
use mewkit_core::host::{status, unknown_report};

use crate::failure::{Failure, OK};

#[derive(Args, Debug)]
pub struct StatusArgs {
    /// Print one JSON document: {schema_version, kind, data}.
    #[arg(long)]
    pub json: bool,
    /// Sample now even when a recent snapshot exists.
    #[arg(long)]
    pub fresh: bool,
    /// Also report Rust space users (target/ dirs, Cargo cache cleaning).
    #[arg(long, conflicts_with = "json")]
    pub caches: bool,
}

pub fn run(args: &StatusArgs) -> Result<u8, Failure> {
    let paths = HostPaths::resolve();
    let mut env = match &paths {
        Some(paths) => {
            let mut space_paths = vec![std::env::current_dir()?];
            space_paths.extend(mewkit_core::config::home_dir());
            status(paths, args.fresh, &space_paths)
        }
        None => Envelope::new(unknown_report("no_home", "HOME is not set"), None),
    };
    // The stored counters are the next sample's baseline, not output.
    env.counters = None;
    print_or_render(&env, args.json, paths.as_ref());
    if args.caches
        && let Some(paths) = &paths
    {
        super::caches::print(paths, &env.data);
    }
    Ok(OK)
}

fn print_or_render(env: &Envelope, json: bool, paths: Option<&HostPaths>) {
    if json {
        println!("{}", serde_json::to_string_pretty(env).unwrap_or_default());
        return;
    }
    render(&env.data);
    if let Some(stats) = paths.and_then(|p| std::fs::read_to_string(p.stats()).ok()) {
        render_stats(&stats);
    }
}

fn pct(v: Option<f64>) -> String {
    v.map_or("n/a".into(), |v| format!("{v:.0}%"))
}

fn render(r: &Report) {
    println!(
        "mewkit host (beta) — verdict: {}",
        r.verdict.as_str().to_uppercase()
    );
    if let Some(cpu) = &r.cpu {
        let psi = cpu
            .psi
            .map_or(String::new(), |p| format!(" · stall {:.0}%", p.some_avg10));
        println!(
            "  cpu      {} busy · {} cores{psi}",
            pct(cpu.busy_pct),
            cpu.cores
        );
    }
    if let Some(m) = &r.memory {
        let pressure = m.pressure.map_or(String::new(), |p| {
            format!("pressure {p:?} · ").to_lowercase()
        });
        println!("  memory   {pressure}{} used", pct(m.used_pct));
    }
    if let Some(d) = &r.disk {
        let latency = d
            .latency_ms
            .map_or("n/a".into(), |l| format!("{l:.2} ms/op"));
        let psi = d
            .psi
            .and_then(|p| p.full_avg10)
            .map_or(String::new(), |f| format!(" · io stall {f:.0}%"));
        println!(
            "  disk     {}: busy {} · {latency}{psi}",
            d.device,
            pct(d.busy_pct)
        );
    }
    if let Some(t) = r.thermal {
        let name = ["nominal", "moderate", "heavy", "trapping", "sleeping"]
            .get(usize::from(t))
            .copied()
            .unwrap_or("?");
        println!("  thermal  {t} ({name})");
    }
    for s in &r.space {
        println!(
            "  space    {} {:.1} GB free of {:.0} GB{}",
            s.path,
            s.free_gb,
            s.total_gb,
            if s.low { " (low)" } else { "" }
        );
    }
    for reason in &r.reasons {
        println!("  reason   [{}] {}", reason.code, reason.detail);
    }
    if !r.top_io.is_empty() {
        println!("  top i/o ({} processes visible)", r.proc_scope);
        for p in &r.top_io {
            let owner = match (&p.runtime, &p.worktree) {
                (Some(rt), Some(wt)) => format!("{rt} · {}", short(wt)),
                (Some(rt), None) => rt.clone(),
                (None, Some(wt)) => short(wt),
                (None, None) => String::new(),
            };
            println!(
                "    {:>7}  {:<24} {:>8.1} MB/s  {owner}",
                p.pid, p.exe, p.io_mb_s
            );
        }
    }
}

fn short(path: &str) -> String {
    let p = PathBuf::from(path);
    p.file_name()
        .map_or(path.to_string(), |n| n.to_string_lossy().into_owned())
}

/// The local beta counters `host run` keeps in `stats.json`, if any.
fn render_stats(text: &str) {
    let Ok(serde_json::Value::Object(map)) = serde_json::from_str::<serde_json::Value>(text) else {
        return;
    };
    let fields: Vec<String> = map.iter().map(|(k, v)| format!("{k} {v}")).collect();
    println!("  beta counters (local only): {}", fields.join(" · "));
}
