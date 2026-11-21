//! Deterministic grading of one run against its case.
//!
//! Grading is pure: the workspace is reached through the [`Workspace`] trait,
//! so tests need no files on disk. A `modelGraded` assertion is never decided
//! here; the run comes back `NeedsJudge` for the runner's pinned judge.

use serde::{Deserialize, Serialize};

use super::case::{Assertion, CaseKind, EvalCase, compile};
use super::transcript::{Event, Transcript, normalize_skill};
use crate::fsx::RelPath;

/// The files a run left behind.
pub trait Workspace {
    /// Contents of every file matching `pattern`, where a segment may be `*`.
    /// A file that cannot be read as text counts with empty contents.
    fn read_matching(&self, pattern: &RelPath) -> Vec<String>;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Verdict {
    Pass,
    Fail,
    NeedsJudge,
}

/// Did the run load `skill` as its first decision — before any other tool?
///
/// A skill found by searching the repo after a listing miss is not a trigger
/// hit: on Codex a read of `SKILL.md` after a search looks like a load.
pub fn trigger_hit(skill: &str, t: &Transcript) -> bool {
    let want = normalize_skill(skill);
    t.events
        .iter()
        .take_while(|e| matches!(e, Event::SkillLoad(_)))
        .any(|e| matches!(e, Event::SkillLoad(s) if *s == want))
}

fn loaded_anywhere(skill: &str, t: &Transcript) -> bool {
    let want = normalize_skill(skill);
    t.events
        .iter()
        .any(|e| matches!(e, Event::SkillLoad(s) if *s == want))
}

fn tool_index(name: &str, t: &Transcript) -> Option<usize> {
    t.events.iter().position(|e| match e {
        Event::Tool(n) => n == name,
        Event::SkillLoad(_) => name == "Skill",
    })
}

fn verdict(ok: bool) -> Verdict {
    if ok { Verdict::Pass } else { Verdict::Fail }
}

/// Grade one assertion. An invalid pattern or path fails the assertion; the
/// loader has already refused both, so this only guards a hand-built case.
pub fn grade_assertion(a: &Assertion, t: &Transcript, ws: &dyn Workspace) -> Verdict {
    match a {
        Assertion::SkillLoaded { skill } => verdict(loaded_anywhere(skill, t)),
        Assertion::SkillNotLoaded { skill } => verdict(!loaded_anywhere(skill, t)),
        Assertion::FileExists { path } => {
            verdict(RelPath::new(path).is_ok_and(|p| !ws.read_matching(&p).is_empty()))
        }
        Assertion::FileContains { path, pattern } => {
            let found = match (RelPath::new(path), compile(pattern)) {
                (Ok(p), Ok(re)) => ws.read_matching(&p).iter().any(|text| re.is_match(text)),
                _ => false,
            };
            verdict(found)
        }
        Assertion::OutputMatches { pattern } => {
            verdict(compile(pattern).is_ok_and(|r| r.is_match(&t.final_text)))
        }
        Assertion::OutputNotMatches { pattern } => {
            verdict(compile(pattern).is_ok_and(|r| !r.is_match(&t.final_text)))
        }
        Assertion::ToolBefore { first, then } => verdict(
            matches!((tool_index(first, t), tool_index(then, t)), (Some(a), Some(b)) if a < b),
        ),
        Assertion::ModelGraded { .. } => Verdict::NeedsJudge,
    }
}

/// All assertions must pass. Any failure fails the run; otherwise a pending
/// model-graded assertion leaves it `NeedsJudge`.
pub fn grade_assertions(assertions: &[Assertion], t: &Transcript, ws: &dyn Workspace) -> Verdict {
    let mut pending = false;
    for a in assertions {
        match grade_assertion(a, t, ws) {
            Verdict::Fail => return Verdict::Fail,
            Verdict::NeedsJudge => pending = true,
            Verdict::Pass => {}
        }
    }
    if pending {
        Verdict::NeedsJudge
    } else {
        Verdict::Pass
    }
}

/// Grade one run of a trigger or parachute case, or one arm of a paired case.
///
/// - trigger: passes when `trigger_hit` equals `expectTrigger`;
/// - parachute: passes when the output reports a mismatch exactly when the
///   approach is wrong, so a report on a control brief is a failure;
/// - paired: the arm passes when every assertion does.
///
/// Extra assertions on trigger and parachute cases must pass as well.
pub fn grade_run(case: &EvalCase, t: &Transcript, ws: &dyn Workspace) -> Verdict {
    let kind_ok = match case.kind {
        CaseKind::Trigger => trigger_hit(&case.skill, t) == case.expect_trigger.unwrap_or(true),
        CaseKind::Parachute => {
            let reported = case
                .mismatch_pattern
                .as_deref()
                .and_then(|p| compile(p).ok())
                .is_some_and(|r| r.is_match(&t.final_text));
            reported == case.approach_is_wrong.unwrap_or(true)
        }
        CaseKind::Paired => true,
    };
    if !kind_ok {
        return Verdict::Fail;
    }
    grade_assertions(&case.assertions, t, ws)
}
