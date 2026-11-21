//! Tie a report to the case set it claims to have run.
//!
//! A report's case results are file content. Before a report is trusted, its
//! cases must be exactly the loaded set's cases, with the kind, control flag,
//! held-out flag and planned run count each case declares, and its hash must be
//! the set's hash. A runner builds each result with [`CaseResult::planned`], so
//! a report it writes passes this check by construction.

use super::case::{CaseKind, EvalCase};
use super::load::CaseSet;
use super::report::{CaseResult, Report};

impl CaseResult {
    /// An empty result for `case`, carrying what the case declares.
    pub fn planned(case: &EvalCase) -> Self {
        Self {
            id: case.id.clone(),
            skill: case.skill.clone(),
            kind: case.kind,
            held_out: case.held_out,
            control: case.kind == CaseKind::Parachute && case.approach_is_wrong == Some(false),
            planned_runs: case.runs,
            runs: Vec::new(),
        }
    }

    /// The fields that must match the case, without the runs.
    pub(crate) fn shape(&self) -> CaseResult {
        CaseResult {
            runs: Vec::new(),
            ..self.clone()
        }
    }
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum ReportCheckError {
    #[error("report hash {report} is not the case set's hash {set}")]
    Hash { report: String, set: String },
    #[error("case {0:?} is in the case set but not in the report")]
    Missing(String),
    #[error("case {0:?} is in the report but not in the case set")]
    Unknown(String),
    #[error(
        "case {0:?} in the report does not match its case (kind, control, held-out or planned runs)"
    )]
    Mismatch(String),
}

impl Report {
    /// Check this report against the case set it names.
    pub fn check_against(&self, set: &CaseSet) -> Result<(), ReportCheckError> {
        if self.case_set_hash != set.hash {
            return Err(ReportCheckError::Hash {
                report: self.case_set_hash.clone(),
                set: set.hash.clone(),
            });
        }
        for loaded in &set.cases {
            let id = &loaded.case.id;
            let Some(r) = self.cases.iter().find(|r| &r.id == id) else {
                return Err(ReportCheckError::Missing(id.clone()));
            };
            if r.shape() != CaseResult::planned(&loaded.case) {
                return Err(ReportCheckError::Mismatch(id.clone()));
            }
        }
        match self
            .cases
            .iter()
            .find(|r| !set.cases.iter().any(|l| l.case.id == r.id))
        {
            Some(extra) => Err(ReportCheckError::Unknown(extra.id.clone())),
            None => Ok(()),
        }
    }
}
