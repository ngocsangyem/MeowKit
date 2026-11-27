//! Raw-to-cooked math for `Win32_PerfRawData_PerfDisk_PhysicalDisk` (`_Total`
//! row). Pure, so the fixture tests run on every OS.
//!
//! Counter types (Microsoft "Calculating Counter Values"): `PercentIdleTime`
//! is PERF_PRECISION_100NS_TIMER over `PercentIdleTime_Base`;
//! `AvgDisksecPerTransfer` is PERF_AVERAGE_TIMER over its `_Base`, in ticks of
//! `Frequency_PerfTime`. Property names are as the class spells them
//! (`AvgDisksecPerTransfer`, lower-case "sec"), probed on Windows Server 2025.
use std::collections::BTreeMap;

use crate::host::model::Disk;

/// The raw properties read each sample, as stored in the snapshot counters.
pub const FIELDS: [(&str, &str); 5] = [
    ("PercentIdleTime", "idle"),
    ("PercentIdleTime_Base", "idle_base"),
    ("AvgDisksecPerTransfer", "lat"),
    ("AvgDisksecPerTransfer_Base", "lat_base"),
    ("Frequency_PerfTime", "freq"),
];

/// Busy % and mean latency between two raw reads. Busy needs a moving idle
/// base; latency is `None` when no transfer completed (an idle disk).
pub fn disk_from_raw(prev: &BTreeMap<String, f64>, next: &BTreeMap<String, f64>) -> Option<Disk> {
    let delta = |k: &str| Some(next.get(k)? - prev.get(k)?);
    let idle_base = delta("idle_base").filter(|d| *d > 0.0)?;
    let idle = delta("idle")?;
    let busy = (100.0 - 100.0 * idle / idle_base).clamp(0.0, 100.0);
    let latency = match (delta("lat"), delta("lat_base"), next.get("freq")) {
        (Some(lat), Some(base), Some(freq)) if base > 0.0 && *freq > 0.0 && lat >= 0.0 => {
            Some(((lat / freq / base) * 1e6).round() / 1e3)
        }
        _ => None,
    };
    Some(Disk {
        device: "_Total".into(),
        busy_pct: Some((busy * 10.0).round() / 10.0),
        latency_ms: latency,
        psi: None,
        scope: "host".into(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn raw(idle: f64, base: f64, lat: f64, lat_base: f64) -> BTreeMap<String, f64> {
        BTreeMap::from([
            ("idle".into(), idle),
            ("idle_base".into(), base),
            ("lat".into(), lat),
            ("lat_base".into(), lat_base),
            ("freq".into(), 10_000_000.0),
        ])
    }

    #[test]
    fn busy_and_latency_cook_from_two_reads() {
        // 1 s of 100 ns ticks, 10 % idle; 200 transfers averaging 5 ms.
        let prev = raw(0.0, 0.0, 0.0, 0.0);
        let next = raw(1_000_000.0, 10_000_000.0, 10_000_000.0, 200.0);
        let disk = disk_from_raw(&prev, &next).unwrap();
        assert_eq!(disk.busy_pct, Some(90.0));
        assert_eq!(disk.latency_ms, Some(5.0));
    }

    #[test]
    fn no_transfers_means_no_latency_and_no_base_means_no_sample() {
        let a = raw(0.0, 0.0, 50.0, 7.0);
        let b = raw(10_000_000.0, 10_000_000.0, 50.0, 7.0);
        let disk = disk_from_raw(&a, &b).unwrap();
        assert_eq!((disk.busy_pct, disk.latency_ms), (Some(0.0), None));
        assert!(disk_from_raw(&a, &a).is_none());
    }
}
