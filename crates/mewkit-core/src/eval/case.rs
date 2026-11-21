//! One eval case as an author writes it, and the checks that make it safe to run.
//!
//! A case file is repository input, so it is validated before any runner sees
//! it: every path it names must stay inside the disposable fixture copy, and
//! every field its kind needs must be present. Unknown keys are refused so a
//! typo cannot silently turn an assertion off.

use regex::Regex;
use serde::{Deserialize, Serialize};

use crate::fsx::RelPath;

/// The most runs one case may ask for; a higher count is almost always a typo
/// that would spend the shared cost ceiling on one case.
pub const MAX_RUNS_PER_CASE: u32 = 20;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CaseKind {
    /// Was the expected skill loaded (or, for a near miss, left alone)?
    Trigger,
    /// The same task with the skill on and off, graded by assertions.
    Paired,
    /// A brief whose stated approach may contradict its goal; graded on
    /// whether the run reports the mismatch.
    Parachute,
}

/// A deterministic check over one run, unless it is `ModelGraded`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase", deny_unknown_fields)]
pub enum Assertion {
    SkillLoaded {
        skill: String,
    },
    SkillNotLoaded {
        skill: String,
    },
    /// A file exists in the run's workspace after the run, relative to it.
    /// A path segment may use `*` (`tasks/plans/*/plan.md`).
    FileExists {
        path: String,
    },
    /// Some file matching `path` (as for `fileExists`) matches `pattern`.
    FileContains {
        path: String,
        pattern: String,
    },
    OutputMatches {
        pattern: String,
    },
    OutputNotMatches {
        pattern: String,
    },
    /// Tool `first` is called before tool `then`; both must appear.
    ToolBefore {
        first: String,
        then: String,
    },
    /// Needs a pinned judge model; the runner grades it, not this crate.
    ModelGraded {
        rubric: String,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct EvalCase {
    pub id: String,
    /// The skill under test, by kit name (`cook`, not `mk:cook`).
    pub skill: String,
    pub kind: CaseKind,
    pub prompt: String,
    #[serde(default = "default_runs")]
    pub runs: u32,
    /// The suite this case belongs to; `mewkit eval run --suite` selects by it.
    #[serde(default = "default_suite")]
    pub suite: String,
    /// Fixture directory relative to the case file's `eval/` folder; the runner
    /// copies it.
    #[serde(default)]
    pub fixture: Option<String>,
    /// Tool allowlist for the run; empty means the runner's safe default.
    #[serde(default)]
    pub tools: Vec<String>,
    /// Kept out of authoring loops: a revised skill must not be tuned on it.
    #[serde(default)]
    pub held_out: bool,
    /// Trigger only: true for a should-trigger query, false for a near miss.
    #[serde(default)]
    pub expect_trigger: Option<bool>,
    /// Parachute only: false marks a control brief whose approach is right.
    #[serde(default)]
    pub approach_is_wrong: Option<bool>,
    /// Parachute only: what a mismatch report looks like in the final output.
    #[serde(default)]
    pub mismatch_pattern: Option<String>,
    #[serde(default)]
    pub assertions: Vec<Assertion>,
}

fn default_runs() -> u32 {
    3
}

fn default_suite() -> String {
    "baseline".into()
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
#[error("case {id:?}: {reason}")]
pub struct CaseError {
    pub id: String,
    pub reason: String,
}

impl EvalCase {
    /// True when grading this case needs a judge model.
    pub fn needs_judge(&self) -> bool {
        self.assertions
            .iter()
            .any(|a| matches!(a, Assertion::ModelGraded { .. }))
    }

    pub fn validate(&self) -> Result<(), CaseError> {
        let fail = |reason: String| CaseError {
            id: self.id.clone(),
            reason,
        };
        let id_ok = !self.id.is_empty()
            && self
                .id
                .bytes()
                .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-');
        if !id_ok {
            return Err(fail(
                "id must be non-empty lowercase letters, digits and `-`".into(),
            ));
        }
        if self.skill.trim().is_empty() || self.prompt.trim().is_empty() {
            return Err(fail("skill and prompt must be non-empty".into()));
        }
        if self.runs == 0 || self.runs > MAX_RUNS_PER_CASE {
            return Err(fail(format!("runs must be 1..={MAX_RUNS_PER_CASE}")));
        }
        if let Some(f) = &self.fixture {
            RelPath::new(f).map_err(|e| fail(format!("fixture: {e}")))?;
        }
        for a in &self.assertions {
            check_assertion(a).map_err(fail)?;
        }
        self.check_kind_fields().map_err(fail)
    }

    fn check_kind_fields(&self) -> Result<(), String> {
        let parachute_fields = self.approach_is_wrong.is_some() || self.mismatch_pattern.is_some();
        match self.kind {
            CaseKind::Trigger => {
                if self.expect_trigger.is_none() {
                    return Err("trigger case needs expectTrigger".into());
                }
                if parachute_fields {
                    return Err("trigger case takes no parachute fields".into());
                }
            }
            CaseKind::Paired => {
                if self.assertions.is_empty() {
                    return Err("paired case needs at least one assertion".into());
                }
                if self.expect_trigger.is_some() || parachute_fields {
                    return Err("paired case takes no trigger or parachute fields".into());
                }
            }
            CaseKind::Parachute => {
                let Some(pattern) = &self.mismatch_pattern else {
                    return Err("parachute case needs mismatchPattern".into());
                };
                if self.approach_is_wrong.is_none() {
                    return Err("parachute case needs approachIsWrong".into());
                }
                if self.expect_trigger.is_some() {
                    return Err("parachute case takes no expectTrigger".into());
                }
                compile(pattern)?;
            }
        }
        Ok(())
    }
}

fn check_assertion(a: &Assertion) -> Result<(), String> {
    match a {
        Assertion::FileExists { path } => RelPath::new(path)
            .map(|_| ())
            .map_err(|e| format!("fileExists: {e}")),
        Assertion::FileContains { path, pattern } => {
            RelPath::new(path).map_err(|e| format!("fileContains: {e}"))?;
            compile(pattern).map(|_| ())
        }
        Assertion::OutputMatches { pattern } | Assertion::OutputNotMatches { pattern } => {
            compile(pattern).map(|_| ())
        }
        Assertion::ModelGraded { rubric } if rubric.trim().is_empty() => {
            Err("modelGraded needs a rubric".into())
        }
        _ => Ok(()),
    }
}

pub(crate) fn compile(pattern: &str) -> Result<Regex, String> {
    Regex::new(pattern).map_err(|e| format!("pattern {pattern:?} does not compile: {e}"))
}
