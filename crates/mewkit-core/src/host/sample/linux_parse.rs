//! Parsers for Linux `/proc` text. PSI is the judged signal; `/proc/diskstats`
//! utilisation is display-only (it saturates on multi-queue NVMe).
use std::collections::BTreeMap;

use crate::host::model::Psi;

/// `/proc/pressure/{io,cpu,memory}`: the `some` and (when present) `full`
/// avg10 percentages.
pub fn parse_psi(text: &str) -> Option<Psi> {
    let avg10 = |line: &str| {
        line.split_whitespace()
            .find_map(|field| field.strip_prefix("avg10="))
            .and_then(|v| v.parse::<f64>().ok())
    };
    let mut psi = None::<Psi>;
    let mut full = None;
    for line in text.lines() {
        if line.starts_with("some ") {
            psi = Some(Psi {
                some_avg10: avg10(line)?,
                full_avg10: None,
            });
        } else if line.starts_with("full ") {
            full = avg10(line);
        }
    }
    psi.map(|p| Psi {
        full_avg10: full,
        ..p
    })
}

/// Whole-disk device names: `sda`, `vdb`, `xvda`, `nvme0n1`, `mmcblk0`, not
/// their partitions (`sda1`, `nvme0n1p2`) or loop/ram devices.
fn is_whole_disk(name: &str) -> bool {
    let letters_only =
        |rest: &str| !rest.is_empty() && rest.bytes().all(|b| b.is_ascii_lowercase());
    if let Some(rest) = name.strip_prefix("nvme") {
        return rest.contains('n') && !rest.contains('p');
    }
    if let Some(rest) = name.strip_prefix("mmcblk") {
        return !rest.is_empty() && rest.bytes().all(|b| b.is_ascii_digit());
    }
    ["sd", "vd", "xvd", "hd"]
        .iter()
        .any(|prefix| name.strip_prefix(prefix).is_some_and(letters_only))
}

/// `io_ticks` (field 13, ms the device had I/O in flight) per whole disk,
/// keyed `io_ticks:<device>`.
pub fn parse_diskstats(text: &str) -> BTreeMap<String, f64> {
    text.lines()
        .filter_map(|line| {
            let fields: Vec<&str> = line.split_whitespace().collect();
            let name = *fields.get(2)?;
            let ticks = fields.get(12)?.parse::<f64>().ok()?;
            is_whole_disk(name).then(|| (format!("io_ticks:{name}"), ticks))
        })
        .collect()
}

/// The busiest disk's utilisation between two `parse_diskstats` reads.
pub fn busiest_util(
    prev: &BTreeMap<String, f64>,
    next: &BTreeMap<String, f64>,
    dt_s: f64,
) -> Option<(String, f64)> {
    next.iter()
        .filter_map(|(key, now)| {
            let before = prev.get(key)?;
            let device = key.strip_prefix("io_ticks:")?;
            let util = ((now - before) / (dt_s * 1000.0) * 100.0).clamp(0.0, 100.0);
            Some((device.to_string(), super::round1(util)))
        })
        .max_by(|a, b| a.1.total_cmp(&b.1))
}

/// True inside a container: `/.dockerenv` exists, or pid 1's cgroup is the
/// namespace root `0::/` (a VM's init shows `0::/init.scope`).
pub fn is_container(dockerenv_exists: bool, pid1_cgroup: &str) -> bool {
    dockerenv_exists || pid1_cgroup.trim() == "0::/"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn psi_reads_some_and_full() {
        let io = "some avg10=7.66 avg60=2.06 avg300=0.46 total=1501984\nfull avg10=5.23 avg60=1.40 avg300=0.31 total=1064100\n";
        assert_eq!(
            parse_psi(io),
            Some(Psi {
                some_avg10: 7.66,
                full_avg10: Some(5.23)
            })
        );
        let cpu_old_kernel = "some avg10=10.03 avg60=2.96 avg300=0.67 total=2101690\n";
        assert_eq!(parse_psi(cpu_old_kernel).unwrap().full_avg10, None);
        assert_eq!(parse_psi(""), None);
    }

    #[test]
    fn diskstats_keeps_whole_disks_only() {
        let text = "   7       0 loop0 11 0 28 0 0 0 0 0 0 1 0 0 0 0 0 0 0\n   8       0 sda 16632 12983 1244646 6332 3543 5332 3650443 6159 0 4032 12501 146 4 297144 9 0 0\n   8       1 sda1 1 0 1 0 0 0 0 0 0 9 0 0 0 0 0 0 0\n 259       0 nvme0n1 1 2 3 4 5 6 7 8 0 777 0\n 259       1 nvme0n1p1 1 2 3 4 5 6 7 8 0 1 0\n";
        let stats = parse_diskstats(text);
        assert_eq!(
            stats.keys().collect::<Vec<_>>(),
            ["io_ticks:nvme0n1", "io_ticks:sda"]
        );
        assert_eq!(stats["io_ticks:sda"], 4032.0);
    }

    #[test]
    fn utilisation_is_clamped_and_picks_the_busiest() {
        let prev = BTreeMap::from([("io_ticks:sda".into(), 0.0), ("io_ticks:vdb".into(), 0.0)]);
        let next = BTreeMap::from([
            ("io_ticks:sda".into(), 500.0),
            ("io_ticks:vdb".into(), 5000.0),
        ]);
        assert_eq!(busiest_util(&prev, &next, 1.0), Some(("vdb".into(), 100.0)));
    }

    #[test]
    fn container_markers() {
        assert!(is_container(true, "0::/init.scope"));
        assert!(is_container(false, "0::/\n"));
        assert!(!is_container(false, "0::/init.scope\n"));
    }
}
