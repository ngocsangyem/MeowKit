//! `status.json`: the last report plus the cumulative disk counters it was
//! computed from, so the next sample can diff against them instead of
//! waiting a second for a second read.
use std::collections::BTreeMap;
use std::io;
use std::path::Path;

use serde::{Deserialize, Serialize};

use super::model::Report;

pub const KIND: &str = "host.status";
pub const SCHEMA_VERSION: u32 = 1;
/// Counters this old or newer are too close for a stable rate.
pub const MIN_DELTA_MS: i64 = 2_000;
/// Counters older than this describe another moment (and maybe a sleep).
pub const MAX_DELTA_MS: i64 = 10 * 60 * 1000;

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct Counters {
    pub taken_ms: i64,
    pub disk: BTreeMap<String, f64>,
}

/// The JSON envelope `host status --json` prints and the snapshot stores.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Envelope {
    pub schema_version: u32,
    pub kind: String,
    pub data: Report,
    /// Stored for the next delta; not part of the printed contract.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub counters: Option<Counters>,
}

impl Envelope {
    pub fn new(data: Report, counters: Option<Counters>) -> Self {
        Self {
            schema_version: SCHEMA_VERSION,
            kind: KIND.to_string(),
            data,
            counters,
        }
    }
}

/// The snapshot at `path`, or `None` when absent, unparsable, of another kind
/// or of a newer schema (read nothing rather than misread it).
pub fn read(path: &Path) -> Option<Envelope> {
    let text = std::fs::read_to_string(path).ok()?;
    let env: Envelope = serde_json::from_str(&text).ok()?;
    (env.kind == KIND && env.schema_version <= SCHEMA_VERSION).then_some(env)
}

/// Write atomically, so a reader never sees half a file.
pub fn write(path: &Path, env: &Envelope) -> io::Result<()> {
    let json = serde_json::to_vec_pretty(env).map_err(io::Error::other)?;
    crate::fsx::atomic_write(path, &json, Some(0o600))
}

/// The stored counters when they are a usable baseline at `now_ms`.
pub fn usable_baseline(env: &Envelope, now_ms: i64) -> Option<&Counters> {
    let counters = env.counters.as_ref()?;
    let age = now_ms - counters.taken_ms;
    (MIN_DELTA_MS..=MAX_DELTA_MS)
        .contains(&age)
        .then_some(counters)
}

/// Milliseconds since the snapshot's counters were taken (`None` without them).
pub fn age_ms(env: &Envelope, now_ms: i64) -> Option<i64> {
    env.counters.as_ref().map(|c| now_ms - c.taken_ms)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::host::model::{Os, Verdict};

    fn report() -> Report {
        Report {
            beta: true,
            verdict: Verdict::Go,
            reasons: vec![],
            sampled_at: "2026-11-28T00:00:00Z".into(),
            os: Os::Macos,
            cpu: None,
            memory: None,
            disk: None,
            space: vec![],
            thermal: None,
            top_io: vec![],
            proc_scope: "host".into(),
        }
    }

    #[test]
    fn round_trip_and_kind_check() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("status.json");
        let counters = Counters {
            taken_ms: 1_000,
            disk: BTreeMap::from([("ops".into(), 5.0)]),
        };
        let env = Envelope::new(report(), Some(counters));
        write(&file, &env).unwrap();
        assert_eq!(read(&file), Some(env.clone()));
        let mut other = env;
        other.kind = "host.other".into();
        write(&file, &other).unwrap();
        assert_eq!(read(&file), None);
    }

    #[test]
    fn a_baseline_must_be_two_seconds_to_ten_minutes_old() {
        let env = Envelope::new(
            report(),
            Some(Counters {
                taken_ms: 0,
                disk: BTreeMap::new(),
            }),
        );
        assert!(usable_baseline(&env, 1_000).is_none());
        assert!(usable_baseline(&env, 5_000).is_some());
        assert!(usable_baseline(&env, MAX_DELTA_MS + 1).is_none());
    }
}
