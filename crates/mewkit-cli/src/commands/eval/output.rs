//! Where an `eval run` report goes, and the `--fail-under` check over it.

use std::path::{Path, PathBuf};

use mewkit_core::eval::Report;
use mewkit_core::fsx::atomic_write;
use mewkit_core::time_utc::{now_millis, rotation_stamp};

use crate::failure::Failure;

pub fn below(r: &Report, floor: Option<f64>) -> bool {
    let Some(floor) = floor else { return false };
    let t = &r.totals;
    [t.trigger_rate, t.paired_on_rate, t.mismatch_report_rate]
        .into_iter()
        .flatten()
        .any(|rate| rate < floor)
}

pub fn write_report(
    telemetry: &Path,
    suite: &str,
    runtime: &str,
    r: &Report,
) -> Result<PathBuf, Failure> {
    let dir = telemetry.join("eval");
    let stem = format!("{}-{suite}-{runtime}", rotation_stamp(now_millis()));
    let json = dir.join(format!("{stem}.json"));
    let bytes = serde_json::to_vec_pretty(r).expect("report serialises");
    std::fs::create_dir_all(&dir)?;
    atomic_write(&json, &bytes, None)?;
    Ok(json)
}
