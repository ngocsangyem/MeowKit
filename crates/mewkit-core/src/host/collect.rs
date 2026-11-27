//! One host sample, end to end: OS probes, `sysinfo`, attribution, verdict.
//!
//! A [`Collector`] keeps its `sysinfo::System` between samples, because CPU
//! use and per-process I/O are deltas since the previous refresh: the watcher
//! holds one for its life, a one-shot `host status` primes one and waits.
use std::path::PathBuf;
use std::time::Duration;

use sysinfo::{Disks, System};

use super::model::{Cpu, MachineSample, Memory, Os, Report, Space};
use super::sample::{self, OsRead};
use super::snapshot::Counters;
use super::verdict::{self, MIN_FREE_GB};
use super::{procs, time_now_ms};
use crate::time_utc::iso_seconds;

/// Wait between the two reads of a cold sample.
pub const COLD_WAIT: Duration = Duration::from_secs(1);
/// Wait when a stored baseline supplies the disk delta: CPU and process
/// deltas still need two refreshes, at least sysinfo's minimum interval.
pub const WARM_WAIT: Duration = Duration::from_millis(300);

pub struct Collector {
    sys: System,
    os: Os,
    baseline: Option<Counters>,
    last_refresh_ms: i64,
}

impl Collector {
    /// `None` only when `sysinfo` cannot start on this platform.
    pub fn new() -> Option<Self> {
        Some(Self {
            sys: System::new().ok()?,
            os: Os::current(),
            baseline: None,
            last_refresh_ms: 0,
        })
    }

    pub fn system(&self) -> &System {
        &self.sys
    }

    /// First read: CPU and process baselines, and disk counters unless
    /// `stored` already gives a usable baseline.
    pub fn prime(&mut self, stored: Option<&Counters>) {
        self.sys.refresh_cpu_usage();
        procs::refresh(&mut self.sys);
        self.last_refresh_ms = time_now_ms();
        self.baseline = match stored {
            Some(c) => Some(c.clone()),
            None => Some(Counters {
                taken_ms: self.last_refresh_ms,
                disk: sample::read_os().counters,
            }),
        };
    }

    /// The next sample; becomes the baseline for the one after.
    pub fn sample(&mut self, space_paths: &[PathBuf]) -> (Report, Counters) {
        self.sys.refresh_cpu_usage();
        self.sys.refresh_memory();
        procs::refresh(&mut self.sys);
        let now = time_now_ms();
        let read = sample::read_os();
        let disk = self.baseline.as_ref().and_then(|base| {
            let dt = (now - base.taken_ms) as f64 / 1000.0;
            sample::disk_between(self.os, &base.disk, &read, dt)
        });
        let proc_dt = (now - self.last_refresh_ms) as f64 / 1000.0;
        self.last_refresh_ms = now;
        let machine = MachineSample {
            os: self.os,
            cpu: Some(self.cpu(&read)),
            memory: self.memory(&read),
            disk,
            space: space_report(space_paths),
            thermal: read.thermal,
        };
        let (verdict, reasons) = verdict::evaluate(&machine);
        let counters = Counters {
            taken_ms: now,
            disk: read.counters.clone(),
        };
        self.baseline = Some(counters.clone());
        let report = Report {
            beta: true,
            verdict,
            reasons,
            sampled_at: iso_seconds(now),
            os: self.os,
            cpu: machine.cpu,
            memory: machine.memory,
            disk: machine.disk,
            space: machine.space,
            thermal: machine.thermal,
            top_io: procs::top_io(&self.sys, proc_dt),
            proc_scope: if read.container { "container" } else { "host" }.into(),
        };
        (report, counters)
    }

    fn cpu(&self, read: &OsRead) -> Cpu {
        let busy = self.sys.global_cpu_usage() as f64;
        Cpu {
            busy_pct: busy.is_finite().then(|| (busy * 10.0).round() / 10.0),
            cores: self.sys.cpus().len(),
            psi: read.psi_cpu,
        }
    }

    fn memory(&self, read: &OsRead) -> Option<Memory> {
        let total = self.sys.total_memory();
        let used_pct = (total > 0).then(|| {
            let pct = self.sys.used_memory() as f64 / total as f64 * 100.0;
            (pct * 10.0).round() / 10.0
        });
        if used_pct.is_none() && read.mem_pressure.is_none() && read.psi_mem.is_none() {
            return None;
        }
        Some(Memory {
            used_pct,
            pressure: read.mem_pressure,
            psi: read.psi_mem,
        })
    }
}

/// Free space for the volumes holding `paths`, one row per volume.
fn space_report(paths: &[PathBuf]) -> Vec<Space> {
    let Ok(disks) = Disks::new_with_refreshed_list() else {
        return Vec::new();
    };
    let mut rows: Vec<Space> = Vec::new();
    for path in paths {
        let Some(disk) = disks
            .iter()
            .filter(|d| path.starts_with(d.mount_point()))
            .max_by_key(|d| d.mount_point().as_os_str().len())
        else {
            continue;
        };
        let mount = disk.mount_point().to_string_lossy().into_owned();
        if rows.iter().any(|r| r.path == mount) {
            continue;
        }
        let gb = |bytes: u64| (bytes as f64 / 1e9 * 10.0).round() / 10.0;
        let free_gb = gb(disk.available_space());
        rows.push(Space {
            path: mount,
            free_gb,
            total_gb: gb(disk.total_space()),
            low: free_gb < MIN_FREE_GB,
        });
    }
    rows
}
