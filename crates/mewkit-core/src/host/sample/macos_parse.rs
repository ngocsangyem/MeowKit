//! Parsers for the macOS probes. Pure text in, numbers out, so every OS runs
//! the fixture tests.
use std::collections::BTreeMap;

use super::{round1, round3};
use crate::host::model::{Disk, MemPressure};

/// Cumulative IOBlockStorageDriver statistics summed over every driver.
///
/// A driver with no media child reports all zeros, so summing equals reading
/// only the drivers that back a disk; external disks add their own load,
/// which is load the machine really carries.
pub fn parse_ioreg_stats(text: &str) -> Option<BTreeMap<String, f64>> {
    let mut total = BTreeMap::new();
    let mut seen = false;
    for line in text.lines() {
        let Some(body) = line
            .split_once("\"Statistics\" = {")
            .and_then(|(_, rest)| rest.rsplit_once('}'))
            .map(|(body, _)| body)
        else {
            continue;
        };
        seen = true;
        for pair in body.split(',') {
            let Some((key, value)) = pair.split_once('=') else {
                continue;
            };
            let key = key.trim().trim_matches('"');
            let Ok(value) = value.trim().parse::<f64>() else {
                continue;
            };
            let slot = match key {
                "Total Time (Read)" | "Total Time (Write)" => "total_time_ns",
                "Operations (Read)" | "Operations (Write)" => "ops",
                "Bytes (Read)" | "Bytes (Write)" => "bytes",
                _ => continue,
            };
            *total.entry(slot.to_string()).or_insert(0.0) += value;
        }
    }
    seen.then_some(total)
}

/// Disk rates between two counter sets taken `dt_s` apart. Busy is
/// device-time per wall second (can exceed 100 %); latency is time per
/// operation, `None` when no operation completed.
pub fn disk_from_counters(
    prev: &BTreeMap<String, f64>,
    next: &BTreeMap<String, f64>,
    dt_s: f64,
) -> Option<Disk> {
    let delta = |k: &str| Some(next.get(k)? - prev.get(k)?).filter(|d| *d >= 0.0);
    let time = delta("total_time_ns")?;
    let ops = delta("ops")?;
    if dt_s <= 0.0 {
        return None;
    }
    Some(Disk {
        device: "internal".into(),
        busy_pct: Some(round1(time / 1e9 / dt_s * 100.0)),
        latency_ms: (ops > 0.0).then(|| round3(time / ops / 1e6)),
        psi: None,
        scope: "host".into(),
    })
}

/// `kern.memorystatus_vm_pressure_level`: only the observed values map
/// (1 normal, 2 warn, 4 critical); anything else is unknown.
pub fn parse_pressure(text: &str) -> Option<MemPressure> {
    match text.trim() {
        "1" => Some(MemPressure::Normal),
        "2" => Some(MemPressure::Warn),
        "4" => Some(MemPressure::Critical),
        _ => None,
    }
}

/// `notifyutil -g com.apple.system.thermalpressurelevel` → 0–4.
pub fn parse_thermal(text: &str) -> Option<u8> {
    text.split_whitespace()
        .last()?
        .parse::<u8>()
        .ok()
        .filter(|level| *level <= 4)
}

#[cfg(test)]
mod tests {
    use super::*;

    const IOREG: &str = r#"+-o IOBlockStorageDriver  <class IOBlockStorageDriver, id 0x1000009f3>
      "Statistics" = {"Operations (Write)"=0,"Latency Time (Write)"=0,"Bytes (Read)"=0,"Errors (Write)"=0,"Total Time (Read)"=0,"Latency Time (Read)"=0,"Retries (Read)"=0,"Errors (Read)"=0,"Total Time (Write)"=0,"Bytes (Write)"=0,"Operations (Read)"=0,"Retries (Write)"=0}
+-o IOBlockStorageDriver  <class IOBlockStorageDriver, id 0x1000009f9>
  |   "Statistics" = {"Operations (Write)"=547121436,"Latency Time (Write)"=0,"Bytes (Read)"=1302463172608,"Errors (Write)"=0,"Total Time (Read)"=9000000000,"Latency Time (Read)"=0,"Retries (Read)"=0,"Errors (Read)"=0,"Total Time (Write)"=1000000000,"Bytes (Write)"=3900000000000,"Operations (Read)"=100,"Retries (Write)"=0}
"#;

    #[test]
    fn statistics_are_summed_across_drivers() {
        let stats = parse_ioreg_stats(IOREG).unwrap();
        assert_eq!(stats["total_time_ns"], 10_000_000_000.0);
        assert_eq!(stats["ops"], 547_121_536.0);
        assert!(parse_ioreg_stats("no drivers here").is_none());
    }

    #[test]
    fn busy_can_pass_one_hundred_percent_and_latency_is_per_op() {
        let prev = BTreeMap::from([("total_time_ns".into(), 0.0), ("ops".into(), 0.0)]);
        let next = BTreeMap::from([
            ("total_time_ns".into(), 48_978_000_000.0),
            ("ops".into(), 15_984.0),
        ]);
        let disk = disk_from_counters(&prev, &next, 3.0).unwrap();
        assert_eq!(disk.busy_pct, Some(1632.6));
        assert_eq!(disk.latency_ms, Some(3.064));
        let idle = disk_from_counters(&prev, &prev, 3.0).unwrap();
        assert_eq!((idle.busy_pct, idle.latency_ms), (Some(0.0), None));
    }

    #[test]
    fn a_counter_that_went_backwards_is_no_sample() {
        let prev = BTreeMap::from([("total_time_ns".into(), 9.0), ("ops".into(), 9.0)]);
        let next = BTreeMap::from([("total_time_ns".into(), 1.0), ("ops".into(), 10.0)]);
        assert!(disk_from_counters(&prev, &next, 1.0).is_none());
    }

    #[test]
    fn pressure_and_thermal_map_only_known_values() {
        assert_eq!(parse_pressure("1\n"), Some(MemPressure::Normal));
        assert_eq!(parse_pressure("4"), Some(MemPressure::Critical));
        assert_eq!(parse_pressure("3"), None);
        assert_eq!(
            parse_thermal("com.apple.system.thermalpressurelevel 0\n"),
            Some(0)
        );
        assert_eq!(
            parse_thermal("com.apple.system.thermalpressurelevel 2"),
            Some(2)
        );
        assert_eq!(
            parse_thermal("com.apple.system.thermalpressurelevel 30"),
            None
        );
    }
}
