//! The deterministic cap table: evidence in, decision out.
//!
//! No model judgment reaches this layer, and nothing here records a human
//! approval. The composed decision is a pure function of what the session can
//! prove, and the strongest thing it can produce is a recommendation the human
//! reads at the gate — `PASS`/`APPROVE` here means "nothing capped it", never
//! "a review was approved".
//!
//! There is no decision-level `WARN`: residual risk maps to `PASS_WITH_RISK`,
//! so a verdict can never be half-approved.
use crate::schema::review_session::EvidenceLevel;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Decision {
    Pass,
    PassWithRisk,
    Blocked,
}

impl Decision {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Pass => "PASS",
            Self::PassWithRisk => "PASS_WITH_RISK",
            Self::Blocked => "BLOCKED",
        }
    }

    /// The per-dimension state this decision implies in the proof bundle.
    pub fn dimension_verdict(self) -> &'static str {
        match self {
            Self::Pass => "PASS",
            Self::PassWithRisk => "WARN",
            Self::Blocked => "FAIL",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReviewEvent {
    Approve,
    RequestChanges,
    Comment,
}

impl ReviewEvent {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Approve => "APPROVE",
            Self::RequestChanges => "REQUEST_CHANGES",
            Self::Comment => "COMMENT",
        }
    }
}

#[derive(Debug, Clone)]
pub struct VerdictInput {
    pub confirmed_critical: bool,
    pub coverage_complete: bool,
    pub evidence_level: EvidenceLevel,
    pub ci_red: bool,
    pub ci_all_skipped: bool,
    /// Capture the session could not make (rate limit, missing scope).
    pub context_unavailable: Vec<String>,
    pub self_pr: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ComputedVerdict {
    pub decision: Decision,
    pub event: ReviewEvent,
    /// Why the outcome was capped — disclosed in the verdict body rather than
    /// swallowed, so the human at the gate sees what the session could not do.
    pub reasons: Vec<String>,
}

pub fn compute_verdict(input: &VerdictInput) -> ComputedVerdict {
    // A confirmed Critical is the top of the table: nothing below it can lift
    // the block.
    if input.confirmed_critical {
        return ComputedVerdict {
            decision: Decision::Blocked,
            event: ReviewEvent::RequestChanges,
            reasons: vec!["confirmed Critical finding".to_string()],
        };
    }

    let mut reasons: Vec<String> = Vec::new();
    if !input.coverage_complete {
        reasons.push("incomplete reviewer coverage".to_string());
    }
    if input.evidence_level != EvidenceLevel::SessionObserved {
        reasons.push("evidence level: attested — Approve unavailable".to_string());
    }
    if input.ci_red {
        reasons.push("CI red".to_string());
    }
    if input.ci_all_skipped {
        reasons.push("all CI checks skipped".to_string());
    }
    for context in &input.context_unavailable {
        reasons.push(format!("context unavailable: {context}"));
    }
    if input.self_pr {
        reasons.push("self-authored PR".to_string());
    }

    if reasons.is_empty() {
        ComputedVerdict {
            decision: Decision::Pass,
            event: ReviewEvent::Approve,
            reasons,
        }
    } else {
        ComputedVerdict {
            decision: Decision::PassWithRisk,
            event: ReviewEvent::Comment,
            reasons,
        }
    }
}

#[cfg(test)]
#[path = "verdict_cap_tests.rs"]
mod tests;
