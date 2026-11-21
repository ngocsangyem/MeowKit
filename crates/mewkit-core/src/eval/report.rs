//! The eval report: what ran, against what, and the rates every later gate reads.
//!
//! Rates are recomputed from the per-run results by [`Report::finalize`], never
//! taken from the file, so a hand-edited total or `complete` flag cannot pass
//! `compare`. A run that errored (timeout, rate limit, auth, unreadable output)
//! is kept out of every rate; past [`ERROR_SHARE_LIMIT`] the report is incomplete.

use serde::{Deserialize, Serialize};

use super::case::CaseKind;
use super::transcript::Runtime;

/// Bumped on any change a reader must notice; `compare` refuses a mismatch.
pub const REPORT_SCHEMA_VERSION: u32 = 1;
/// The comparison margin never drops below this, however small the spread.
pub const MARGIN_FLOOR_PP: f64 = 10.0;
/// Share of errored runs above which the report is incomplete.
pub const ERROR_SHARE_LIMIT: f64 = 0.05;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RunOutcome {
    Pass,
    Fail,
    Error,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Arm {
    On,
    Off,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RunResult {
    pub outcome: RunOutcome,
    /// Paired cases only.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub arm: Option<Arm>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CaseResult {
    pub id: String,
    pub skill: String,
    pub kind: CaseKind,
    #[serde(default)]
    pub held_out: bool,
    /// Parachute only: a control brief, whose approach is right.
    #[serde(default)]
    pub control: bool,
    /// Runs the case asked for; a paired case runs each arm this many times.
    pub planned_runs: u32,
    pub runs: Vec<RunResult>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ProbeOutcome {
    Yes,
    No,
    /// Readers treat this as `no`.
    Inconclusive,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Probe {
    pub name: String,
    pub outcome: ProbeOutcome,
    /// The command or observation that produced the outcome.
    pub evidence: String,
}

/// One eval-based gate: the smallest change it must detect, stated before the
/// first run. For a `pp` gate, [`Report::finalize`] sets `smoke_check` when that
/// change is below the margin: the gate cannot tell it from noise.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GateRow {
    pub gate: String,
    pub metric: String,
    pub unit: String,
    pub min_detectable_change: f64,
    #[serde(default)]
    pub smoke_check: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SkippedCase {
    pub id: String,
    pub reason: String,
}

/// Rates as fractions in 0..=1; `None` when no graded run fed them.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Totals {
    pub runs: u32,
    pub errors: u32,
    pub trigger_rate: Option<f64>,
    pub paired_on_rate: Option<f64>,
    pub paired_off_rate: Option<f64>,
    pub mismatch_report_rate: Option<f64>,
    pub false_report_rate: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Report {
    pub schema_version: u32,
    pub runtime: Runtime,
    /// The pinned model version, e.g. `claude-opus-5-5`.
    pub model: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub judge_model: Option<String>,
    pub case_set_hash: String,
    /// How the "skill off" arm was produced, e.g. `scratch-install`.
    pub off_arm: String,
    pub complete: bool,
    #[serde(default)]
    pub skipped: Vec<SkippedCase>,
    pub cases: Vec<CaseResult>,
    #[serde(default)]
    pub totals: Totals,
    /// Run-to-run spread in percentage points, once measured.
    #[serde(default)]
    pub spread_pp: Option<f64>,
    pub margin_pp: f64,
    #[serde(default)]
    pub probes: Vec<Probe>,
    #[serde(default)]
    pub gates: Vec<GateRow>,
}

/// The margin every gate uses: the measured spread, never below the floor.
pub fn margin_pp(spread_pp: Option<f64>) -> f64 {
    spread_pp.map_or(MARGIN_FLOOR_PP, |s| s.max(MARGIN_FLOOR_PP))
}

/// Largest gap, in percentage points, between the suite rates two runs of the
/// same suite produced. Rates present in only one report are ignored.
pub fn spread_pp(a: &Totals, b: &Totals) -> Option<f64> {
    super::rates::named(a)
        .into_iter()
        .zip(super::rates::named(b))
        .filter_map(|((_, x), (_, y))| Some((x? - y?).abs() * 100.0))
        .reduce(f64::max)
}

fn spread_is_valid(spread: Option<f64>) -> bool {
    spread.is_none_or(|s| s.is_finite() && (0.0..=100.0).contains(&s))
}

impl Report {
    /// Recompute totals, completeness, margin and smoke-check flags from the
    /// runs and the spread. Nothing stored in those fields is kept, so a
    /// hand-raised margin cannot hide a regression.
    pub fn finalize(&mut self) {
        let (totals, as_planned) = super::rates::totals(&self.cases);
        let error_share = if totals.runs == 0 {
            0.0
        } else {
            f64::from(totals.errors) / f64::from(totals.runs)
        };
        let spread_ok = spread_is_valid(self.spread_pp);
        self.complete = !self.cases.is_empty()
            && self.skipped.is_empty()
            && as_planned
            && spread_ok
            && error_share <= ERROR_SHARE_LIMIT;
        self.margin_pp = margin_pp(self.spread_pp.filter(|_| spread_ok));
        for g in self.gates.iter_mut().filter(|g| g.unit == "pp") {
            let detectable =
                g.min_detectable_change.is_finite() && g.min_detectable_change >= self.margin_pp;
            g.smoke_check = !detectable;
        }
        self.totals = totals;
    }
}
