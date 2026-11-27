//! Machine-level probes per OS. `read_os` takes one instant's readings;
//! `disk_between` turns two instants into disk rates. Cumulative counters are
//! kept in the snapshot so the next sample can diff against them.
pub mod linux_parse;
pub mod macos_parse;
pub mod windows_parse;

#[cfg(windows)]
mod windows_live;

use std::collections::BTreeMap;

use super::model::{Disk, MemPressure, Os, Psi};

/// One instant's OS readings other than what `sysinfo` provides.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct OsRead {
    /// Cumulative disk counters (names depend on the OS).
    pub counters: BTreeMap<String, f64>,
    pub mem_pressure: Option<MemPressure>,
    pub thermal: Option<u8>,
    pub psi_io: Option<Psi>,
    pub psi_cpu: Option<Psi>,
    pub psi_mem: Option<Psi>,
    pub container: bool,
}

/// `v` rounded to one decimal place.
pub fn round1(v: f64) -> f64 {
    (v * 10.0).round() / 10.0
}

/// `v` rounded to three decimal places.
pub fn round3(v: f64) -> f64 {
    (v * 1000.0).round() / 1000.0
}

/// Disk rates from `prev` counters to `next`, `dt_s` apart.
pub fn disk_between(
    os: Os,
    prev: &BTreeMap<String, f64>,
    next: &OsRead,
    dt_s: f64,
) -> Option<Disk> {
    match os {
        Os::Macos => macos_parse::disk_from_counters(prev, &next.counters, dt_s),
        Os::Windows => windows_parse::disk_from_raw(prev, &next.counters),
        Os::Linux => {
            // PSI is judged; utilisation rides along for display.
            let util = linux_parse::busiest_util(prev, &next.counters, dt_s);
            next.psi_io.map(|psi| Disk {
                device: util.as_ref().map_or("all".into(), |(d, _)| d.clone()),
                busy_pct: util.map(|(_, u)| u),
                latency_ms: None,
                psi: Some(psi),
                scope: "host".into(),
            })
        }
        Os::Other => None,
    }
}

#[cfg(target_os = "macos")]
pub fn read_os() -> OsRead {
    use std::time::Duration;
    let t = Duration::from_secs(2);
    let probe = super::probe_cmd::run;
    OsRead {
        counters: probe(
            "/usr/sbin/ioreg",
            &[
                "-r",
                "-c",
                "IOBlockStorageDriver",
                "-k",
                "Statistics",
                "-d",
                "1",
            ],
            t,
        )
        .and_then(|text| macos_parse::parse_ioreg_stats(&text))
        .unwrap_or_default(),
        mem_pressure: probe(
            "/usr/sbin/sysctl",
            &["-n", "kern.memorystatus_vm_pressure_level"],
            t,
        )
        .and_then(|text| macos_parse::parse_pressure(&text)),
        thermal: probe(
            "/usr/bin/notifyutil",
            &["-g", "com.apple.system.thermalpressurelevel"],
            t,
        )
        .and_then(|text| macos_parse::parse_thermal(&text)),
        ..OsRead::default()
    }
}

#[cfg(target_os = "linux")]
pub fn read_os() -> OsRead {
    let read = |p: &str| std::fs::read_to_string(p).ok();
    let psi = |kind: &str| {
        read(&format!("/proc/pressure/{kind}")).and_then(|t| linux_parse::parse_psi(&t))
    };
    OsRead {
        counters: read("/proc/diskstats")
            .map(|t| linux_parse::parse_diskstats(&t))
            .unwrap_or_default(),
        psi_io: psi("io"),
        psi_cpu: psi("cpu"),
        psi_mem: psi("memory"),
        container: linux_parse::is_container(
            std::path::Path::new("/.dockerenv").exists(),
            &read("/proc/1/cgroup").unwrap_or_default(),
        ),
        ..OsRead::default()
    }
}

#[cfg(windows)]
pub fn read_os() -> OsRead {
    OsRead {
        counters: windows_live::read_raw_disk().unwrap_or_default(),
        ..OsRead::default()
    }
}

#[cfg(not(any(target_os = "macos", target_os = "linux", windows)))]
pub fn read_os() -> OsRead {
    OsRead::default()
}
