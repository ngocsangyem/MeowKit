//! The verdict: a pure function over one [`MachineSample`].
//!
//! Each metric contributes a verdict and a reason; the most restrictive wins
//! (hold > clean > unknown > throttle > go). A metric that could not be read
//! contributes `unknown`, so missing data can never produce `go` on its own.
//!
//! Thresholds are constants for the beta. macOS disk numbers differ from the
//! others because its busy figure is device-time per wall second: two parallel
//! writers measured 1632 % on an NVMe laptop while latency stayed near 3 ms, so
//! the percentage cutoffs other systems use would hold constantly there.
use super::model::{MachineSample, Os, Reason, Verdict};

pub const CPU_THROTTLE_PCT: f64 = 85.0;
pub const CPU_HOLD_PCT: f64 = 95.0;
pub const MEM_THROTTLE_PCT: f64 = 88.0;
pub const MEM_HOLD_PCT: f64 = 95.0;
pub const MIN_FREE_GB: f64 = 25.0;

/// (throttle, hold) for disk busy % and mean latency in ms.
const fn disk_limits(os: Os) -> ((f64, f64), (f64, f64)) {
    match os {
        Os::Macos => ((300.0, 800.0), (5.0, 20.0)),
        _ => ((70.0, 90.0), (50.0, 100.0)),
    }
}

/// Linux pressure stall, percent of the last 10 s: (throttle, hold).
pub const PSI_IO_FULL: (f64, f64) = (10.0, 30.0);
pub const PSI_CPU_SOME: (f64, f64) = (50.0, 80.0);
pub const PSI_MEM_FULL: (f64, f64) = (5.0, 20.0);

/// macOS thermal levels: 1 Moderate throttles, 2 Heavy and above hold.
pub const THERMAL_THROTTLE: u8 = 1;
pub const THERMAL_HOLD: u8 = 2;

struct Tally {
    verdict: Verdict,
    reasons: Vec<Reason>,
}

impl Tally {
    fn add(&mut self, verdict: Verdict, code: &str, detail: String) {
        if verdict == Verdict::Go {
            return;
        }
        self.verdict = self.verdict.max(verdict);
        self.reasons.push(Reason {
            code: code.to_string(),
            detail,
        });
    }
}

fn level(value: f64, (throttle, hold): (f64, f64)) -> Verdict {
    if value >= hold {
        Verdict::Hold
    } else if value >= throttle {
        Verdict::Throttle
    } else {
        Verdict::Go
    }
}

/// The verdict and its reasons, in metric order (cpu, memory, disk, space, thermal).
pub fn evaluate(sample: &MachineSample) -> (Verdict, Vec<Reason>) {
    let mut tally = Tally {
        verdict: Verdict::Go,
        reasons: Vec::new(),
    };
    judge_cpu(sample, &mut tally);
    judge_memory(sample, &mut tally);
    judge_disk(sample, &mut tally);
    for space in sample.space.iter().filter(|s| s.free_gb < MIN_FREE_GB) {
        let detail = format!("{} has {:.1} GB free (< {MIN_FREE_GB} GB)", space.path, space.free_gb);
        tally.add(Verdict::Clean, "space_low", detail);
    }
    if let Some(t) = sample.thermal {
        let v = if t >= THERMAL_HOLD {
            Verdict::Hold
        } else if t >= THERMAL_THROTTLE {
            Verdict::Throttle
        } else {
            Verdict::Go
        };
        tally.add(v, "thermal", format!("thermal level {t}"));
    }
    (tally.verdict, tally.reasons)
}

fn judge_cpu(sample: &MachineSample, tally: &mut Tally) {
    let Some(cpu) = &sample.cpu else {
        return tally.add(Verdict::Unknown, "cpu_unavailable", "cpu unavailable".into());
    };
    if let Some(psi) = cpu.psi {
        let v = level(psi.some_avg10, PSI_CPU_SOME);
        tally.add(v, "cpu", format!("cpu stall {:.0}% (psi some avg10)", psi.some_avg10));
    }
    match cpu.busy_pct {
        Some(busy) => {
            let v = level(busy, (CPU_THROTTLE_PCT, CPU_HOLD_PCT));
            tally.add(v, "cpu", format!("cpu busy {busy:.0}%"));
        }
        None if cpu.psi.is_none() => {
            tally.add(Verdict::Unknown, "cpu_unavailable", "cpu unavailable".into());
        }
        None => {}
    }
}

fn judge_memory(sample: &MachineSample, tally: &mut Tally) {
    use super::model::MemPressure;
    let Some(mem) = &sample.memory else {
        return tally.add(Verdict::Unknown, "memory_unavailable", "memory unavailable".into());
    };
    if let Some(p) = mem.pressure {
        // macOS: used % misleads (cold pages sit in swap at "normal"), so the
        // kernel's pressure level is the only memory signal judged there.
        let v = match p {
            MemPressure::Normal => Verdict::Go,
            MemPressure::Warn => Verdict::Throttle,
            MemPressure::Critical => Verdict::Hold,
        };
        return tally.add(v, "memory", format!("memory pressure {p:?}").to_lowercase());
    }
    if let Some(full) = mem.psi.and_then(|p| p.full_avg10) {
        let v = level(full, PSI_MEM_FULL);
        return tally.add(v, "memory", format!("memory stall {full:.0}% (psi full avg10)"));
    }
    match mem.used_pct {
        Some(used) => {
            let v = level(used, (MEM_THROTTLE_PCT, MEM_HOLD_PCT));
            tally.add(v, "memory", format!("memory used {used:.0}%"));
        }
        None => tally.add(Verdict::Unknown, "memory_unavailable", "memory unavailable".into()),
    }
}

fn judge_disk(sample: &MachineSample, tally: &mut Tally) {
    let Some(disk) = &sample.disk else {
        return tally.add(Verdict::Unknown, "disk_unavailable", "disk unavailable".into());
    };
    if sample.os == Os::Linux {
        // `%util` saturates on multi-queue NVMe, so only stall time is judged.
        match disk.psi.and_then(|p| p.full_avg10) {
            Some(full) => tally.add(
                level(full, PSI_IO_FULL),
                "disk",
                format!("io stall {full:.0}% (psi full avg10)"),
            ),
            None => tally.add(Verdict::Unknown, "disk_unavailable", "io pressure unavailable".into()),
        }
        return;
    }
    let (busy_limits, latency_limits) = disk_limits(sample.os);
    let busy = disk.busy_pct.map(|b| level(b, busy_limits));
    let latency = disk.latency_ms.map(|l| level(l, latency_limits));
    match (busy, latency) {
        (None, None) => tally.add(Verdict::Unknown, "disk_unavailable", "disk unavailable".into()),
        (b, l) => {
            let v = b.unwrap_or(Verdict::Go).max(l.unwrap_or(Verdict::Go));
            let detail = format!(
                "disk {}: busy {}, latency {}",
                disk.device,
                disk.busy_pct.map_or("n/a".into(), |b| format!("{b:.0}%")),
                disk.latency_ms.map_or("n/a".into(), |l| format!("{l:.1} ms")),
            );
            tally.add(v, "disk", detail);
        }
    }
}
