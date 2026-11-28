//! The data `mewkit host status` reports, and what the verdict reads.
//!
//! Every metric is an `Option`: a value the sampler could not read stays
//! `None` and is reported as missing, never as zero, because a zero reads as
//! "idle" and an idle verdict admits more heavy work.
use serde::{Deserialize, Serialize};

/// The admission verdict. Declared in rank order, lowest first, so `max()`
/// over contributions picks the most restrictive one:
/// go < throttle < unknown < clean < hold.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Verdict {
    Go,
    Throttle,
    Unknown,
    Clean,
    Hold,
}

impl Verdict {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Go => "go",
            Self::Throttle => "throttle",
            Self::Unknown => "unknown",
            Self::Clean => "clean",
            Self::Hold => "hold",
        }
    }
}

/// The operating system family a sample came from; thresholds differ.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Os {
    Macos,
    Linux,
    Windows,
    Other,
}

impl Os {
    pub fn current() -> Self {
        if cfg!(target_os = "macos") {
            Self::Macos
        } else if cfg!(target_os = "linux") {
            Self::Linux
        } else if cfg!(windows) {
            Self::Windows
        } else {
            Self::Other
        }
    }
}

/// macOS memory pressure as the kernel reports it; only observed values map.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MemPressure {
    Normal,
    Warn,
    Critical,
}

/// Linux pressure-stall averages (percent of wall time, last 10 s).
#[derive(Clone, Copy, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct Psi {
    pub some_avg10: f64,
    pub full_avg10: Option<f64>,
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct Cpu {
    pub busy_pct: Option<f64>,
    pub cores: usize,
    /// Linux only: stall pressure, the stronger signal.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub psi: Option<Psi>,
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct Memory {
    pub used_pct: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pressure: Option<MemPressure>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub psi: Option<Psi>,
}

/// Disk activity. On macOS `busy_pct` is device-time per wall second and can
/// pass 100 % with queued I/O; on Windows it is 100 − idle %; on Linux it is
/// `io_ticks` utilisation, shown but not judged (PSI is judged instead).
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct Disk {
    pub device: String,
    pub busy_pct: Option<f64>,
    pub latency_ms: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub psi: Option<Psi>,
    /// `host`, or `container` when the sample came from inside one.
    pub scope: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Space {
    pub path: String,
    pub free_gb: f64,
    pub total_gb: f64,
    pub low: bool,
}

/// One process that did I/O since the previous sample. `exe` is a basename
/// only: another process's command line never leaves memory.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ProcIo {
    pub pid: u32,
    pub exe: String,
    pub io_mb_s: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub worktree: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub runtime: Option<String>,
}

/// Why the verdict is what it is: a stable code for programs, text for people.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Reason {
    pub code: String,
    pub detail: String,
}

/// Everything the verdict reads, sampled at one instant.
#[derive(Clone, Debug, PartialEq)]
pub struct MachineSample {
    pub os: Os,
    pub cpu: Option<Cpu>,
    pub memory: Option<Memory>,
    pub disk: Option<Disk>,
    pub space: Vec<Space>,
    /// macOS thermal pressure 0–4 (Nominal … Sleeping).
    pub thermal: Option<u8>,
}

/// The report `host status --json` prints under `data`.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Report {
    pub beta: bool,
    pub verdict: Verdict,
    pub reasons: Vec<Reason>,
    pub sampled_at: String,
    pub os: Os,
    pub cpu: Option<Cpu>,
    pub memory: Option<Memory>,
    pub disk: Option<Disk>,
    pub space: Vec<Space>,
    pub thermal: Option<u8>,
    pub top_io: Vec<ProcIo>,
    /// `host`, or `container` when only this container's processes are visible.
    pub proc_scope: String,
}
