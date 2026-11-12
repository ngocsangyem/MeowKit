//! What a DIRECT consult returns.
//!
//! The supervisor is reachable two ways and they are different capabilities: an
//! EMBEDDED checkpoint has a run id, a stage, a cap, a dossier and a
//! stage-legal disposition that routes the workflow; a DIRECT consult is a
//! stateless strategy answer with none of those.
//!
//! The brief is the direct half's shape, and it deliberately CANNOT express a
//! disposition. Emitted without a run, a disposition reads as a governed
//! decision no run ever governed, and a later reader cannot tell the difference
//! — so the refusal lives in the schema, not in a reviewer's memory. Everything
//! forbidden is REFUSED rather than stripped: silently dropping a field the
//! caller believed it returned leaves the caller trusting output that was never
//! recorded.

use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::supervision_output::{ConfidenceLevel, OUTPUT_PACKET_MAX_WORDS};
use super::supervision_scan::{scan_authority_language, scan_secrets, word_count};
use super::{Validation, object_keys, require_non_empty};

/// Fields that would turn a consult into a governed checkpoint. A brief
/// carrying any of them is refused with the field NAMED, because the caller
/// needs to know it tried to claim supervision it never had.
pub const FORBIDDEN_BRIEF_FIELDS: &[&str] = &[
    "disposition",
    "requiredCorrections",
    "runId",
    "supervisionRunId",
    "stage",
    "checkpointId",
    "receiptPointer",
    "receiptPointers",
    "correctionCount",
    "evidenceRevision",
    "strategicDirective",
];

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct StrategyBrief {
    /// What is actually going on, read from evidence rather than from the
    /// asker's framing.
    pub situation: String,
    /// One recommended operational path, and why it beats the alternatives.
    pub decision_recommendation: String,
    /// What was considered and rejected. Absent alternatives usually means one
    /// was assumed.
    #[serde(default)]
    pub rejected_alternatives: String,
    /// The check that would prove the recommendation wrong. Advice with no such
    /// check is an opinion.
    pub next_falsifiable_check: String,
    #[serde(default)]
    pub risks_and_rollback: String,
    /// Where this stops being the supervisor's call. Required: a consult with no
    /// escalation point implies authority it lacks.
    pub escalation_point: String,
    #[serde(default)]
    pub assumptions: String,
    pub confidence: ConfidenceLevel,
    #[serde(default)]
    pub evidence_read: Vec<String>,
}

/// Validate a direct-consult brief.
///
/// The forbidden-field scan runs against the RAW candidate, before the strict
/// shape narrows it: an unknown key reports as "unknown field", and "you tried
/// to return a disposition from a stateless consult" is the message that matters.
pub fn validate_strategy_brief(candidate: &Value) -> Validation {
    let mut errors = Vec::new();
    let keys = object_keys(candidate);
    for forbidden in FORBIDDEN_BRIEF_FIELDS {
        if keys.contains(forbidden) {
            errors.push(format!(
                "\"{forbidden}\" belongs to embedded supervision — a direct consult is stateless and routes no workflow"
            ));
        }
    }

    let brief: StrategyBrief = match serde_json::from_value(candidate.clone()) {
        Ok(b) => b,
        Err(e) => {
            errors.push(e.to_string());
            return Validation::new(errors);
        }
    };

    for (label, value) in [
        ("situation", &brief.situation),
        ("decisionRecommendation", &brief.decision_recommendation),
        ("nextFalsifiableCheck", &brief.next_falsifiable_check),
        ("escalationPoint", &brief.escalation_point),
    ] {
        require_non_empty(label, value, &mut errors);
    }
    if !errors.is_empty() {
        return Validation::new(errors);
    }

    let prose = [
        brief.situation.as_str(),
        brief.decision_recommendation.as_str(),
        brief.rejected_alternatives.as_str(),
        brief.next_falsifiable_check.as_str(),
        brief.risks_and_rollback.as_str(),
        brief.escalation_point.as_str(),
        brief.assumptions.as_str(),
    ]
    .join(" ");

    let words = word_count(&prose);
    if words > OUTPUT_PACKET_MAX_WORDS {
        errors.push(format!(
            "brief is {words} words, over the {OUTPUT_PACKET_MAX_WORDS}-word cap"
        ));
    }

    // A consult holds LESS authority than a checkpoint, not more — so it is held
    // to the same language bar, through the same single detector.
    errors.extend(scan_authority_language(&prose));
    let mut scanned = vec![prose];
    scanned.extend(brief.evidence_read.clone());
    errors.extend(scan_secrets(&scanned.join("\n")));

    Validation::new(errors)
}

// There is deliberately NO renderer here: a direct consult produces no durable
// artifact — that is the whole distinction from an embedded checkpoint, and it
// is structural (no run id ⇒ no dossier path, no receipt).

#[cfg(test)]
#[path = "strategy_brief_tests.rs"]
mod tests;
