//! How long `host run` waits before handing control back, per agent runtime.
//! Each runtime stops or backgrounds a tool call after its own limit (probed:
//! Codex yields at 10 s, Grok gives 30 s, OMP backgrounds at 60 s, Claude
//! Code and Pi allow minutes), so the wait sits safely under each.
use std::time::Duration;

use sysinfo::{ProcessRefreshKind, ProcessesToUpdate, System, UpdateKind};

use super::procs::{basename, runtime_of};

/// The default wait for `runtime`; an unknown caller gets the shortest.
pub fn for_runtime(runtime: Option<&str>) -> Duration {
    Duration::from_secs(match runtime {
        Some("claude" | "pi") => 90,
        Some("omp") => 50,
        Some("grok") => 25,
        _ => 8,
    })
}

/// The agent runtime this process runs under: the nearest ancestor that is one.
pub fn calling_runtime() -> Option<String> {
    let mut sys = System::new().ok()?;
    let kind = ProcessRefreshKind::nothing()
        .with_exe(UpdateKind::OnlyIfNotSet)
        .with_cmd(UpdateKind::OnlyIfNotSet);
    sys.refresh_processes_specifics(ProcessesToUpdate::All, true, kind);
    let mut cursor = sysinfo::get_current_pid().ok();
    for _ in 0..64 {
        let p = sys.process(cursor?)?;
        let exe = p
            .exe()
            .map_or_else(|| basename(std::path::Path::new(p.name())), basename);
        let args: Vec<String> = p
            .cmd()
            .iter()
            .map(|a| a.to_string_lossy().into_owned())
            .collect();
        if let Some(rt) = runtime_of(&exe, &args) {
            return Some(rt);
        }
        cursor = p.parent();
    }
    None
}

/// `90`, `90s`, `500ms`, `2m`, `1h`; `None` for anything else.
pub fn parse(text: &str) -> Option<Duration> {
    let text = text.trim();
    let split = text
        .find(|c: char| !c.is_ascii_digit())
        .unwrap_or(text.len());
    let (num, unit) = text.split_at(split);
    let n: u64 = num.parse().ok()?;
    Some(match unit {
        "" | "s" => Duration::from_secs(n),
        "ms" => Duration::from_millis(n),
        "m" => Duration::from_secs(n.checked_mul(60)?),
        "h" => Duration::from_secs(n.checked_mul(3600)?),
        _ => return None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn durations_and_runtime_defaults() {
        assert_eq!(parse("2s"), Some(Duration::from_secs(2)));
        assert_eq!(parse("90"), Some(Duration::from_secs(90)));
        assert_eq!(parse("500ms"), Some(Duration::from_millis(500)));
        assert_eq!(parse("2m"), Some(Duration::from_secs(120)));
        assert_eq!(parse("x"), None);
        assert_eq!(parse("1d"), None);
        assert_eq!(for_runtime(Some("claude")), Duration::from_secs(90));
        assert_eq!(for_runtime(Some("codex")), Duration::from_secs(8));
        assert_eq!(for_runtime(None), Duration::from_secs(8));
    }
}
