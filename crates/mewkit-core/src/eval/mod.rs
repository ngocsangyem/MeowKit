//! What `mewkit eval` loads, grades and compares — no process spawning here.
//!
//! Cases are loaded from a case root and fingerprinted ([`load`]); a runtime's
//! headless output is reduced to skill loads and tool calls ([`transcript`]);
//! each run is graded deterministically ([`grade`]); results go into a
//! versioned report whose rates are always recomputed ([`report`]); and two
//! reports are compared only when they measured the same thing ([`compare`]).
pub mod case;
pub mod compare;
pub mod grade;
pub mod ledger;
pub mod load;
mod load_fs;
mod rates;
pub mod report;
mod report_check;
pub mod runner;
pub mod sandbox;
pub mod transcript;

pub use case::{Assertion, CaseError, CaseKind, EvalCase};
pub use compare::{CompareError, Comparison, Delta, compare};
pub use grade::{Verdict, grade_run, trigger_hit};
pub use load::{CaseSet, LoadError, LoadedCase, load_cases};
pub use report::{
    Arm, CaseResult, GateRow, Probe, ProbeOutcome, REPORT_SCHEMA_VERSION, Report, RunOutcome,
    RunResult, SkippedCase, Totals, margin_pp, spread_pp,
};
pub use report_check::ReportCheckError;
pub use transcript::{Event, Runtime, Transcript, TranscriptError, normalize_skill, parse};

#[cfg(test)]
#[path = "case_tests.rs"]
mod case_tests;
#[cfg(test)]
#[path = "compare_tests.rs"]
mod compare_tests;
#[cfg(test)]
#[path = "grade_tests.rs"]
mod grade_tests;
#[cfg(test)]
#[path = "ledger_tests.rs"]
mod ledger_tests;
#[cfg(test)]
#[path = "load_tests.rs"]
mod load_tests;
#[cfg(test)]
#[path = "report_check_tests.rs"]
mod report_check_tests;
#[cfg(test)]
#[path = "report_tests.rs"]
mod report_tests;
#[cfg(test)]
#[path = "runner_tests.rs"]
mod runner_tests;
#[cfg(test)]
#[path = "sandbox_tests.rs"]
mod sandbox_tests;
#[cfg(test)]
#[path = "transcript_tests.rs"]
mod transcript_tests;
