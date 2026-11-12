//! What the supervisor returns.
//!
//! The outbound half of the boundary is held to the same bars as the inbound
//! one plus one more: it may not speak with AUTHORITY. Counsel is evidence a
//! human reads at a gate, never the approval itself, so approval language is
//! refused here however it is worded.
//!
//! The supervisor also OPENS the files it was pointed at, so its own prose can
//! quote their contents back — which is why the credential scan runs on the
//! return trip too. A laxer return path would make the outbound scan decorative.

use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::supervision_protocol::Disposition;
use super::supervision_scan::{scan_authority_language, scan_secrets, word_count};
use super::{Validation, require_non_empty};

/// Output prose ceiling. Volume is not rigor.
pub const OUTPUT_PACKET_MAX_WORDS: usize = 600;
/// Corrections must be actionable and finite.
pub const MAX_REQUIRED_CORRECTIONS: usize = 5;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ConfidenceLevel {
    Low,
    Medium,
    High,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequiredCorrection {
    pub change: String,
    pub proof_required: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutputPacket {
    pub disposition: Disposition,
    #[serde(default)]
    pub strategic_assessment: String,
    #[serde(default)]
    pub decision_recommendation: String,
    #[serde(default)]
    pub strategic_directive: String,
    #[serde(default)]
    pub required_corrections: Vec<RequiredCorrection>,
    #[serde(default)]
    pub next_falsifiable_check: String,
    #[serde(default)]
    pub risks_and_rollback: String,
    #[serde(default)]
    pub rejected_alternatives: String,
    #[serde(default)]
    pub assumptions: String,
    pub confidence: ConfidenceLevel,
    #[serde(default)]
    pub evidence_read: Vec<String>,
}

/// Validate a returned packet: shape, word cap, correction budget, and absence
/// of authority language. `RETURN_TO_EXECUTOR` additionally requires at least
/// one correction — returning work with nothing to change is not actionable.
pub fn validate_output_packet(candidate: &Value) -> Validation {
    let packet: OutputPacket = match serde_json::from_value(candidate.clone()) {
        Ok(p) => p,
        Err(e) => return Validation::new(vec![e.to_string()]),
    };

    let mut errors = Vec::new();
    if packet.required_corrections.len() > MAX_REQUIRED_CORRECTIONS {
        errors.push(format!(
            "requiredCorrections: at most {MAX_REQUIRED_CORRECTIONS} corrections"
        ));
    }
    for (i, correction) in packet.required_corrections.iter().enumerate() {
        require_non_empty(
            &format!("requiredCorrections.{i}.change"),
            &correction.change,
            &mut errors,
        );
        require_non_empty(
            &format!("requiredCorrections.{i}.proofRequired"),
            &correction.proof_required,
            &mut errors,
        );
    }
    if !errors.is_empty() {
        return Validation::new(errors);
    }

    let mut prose = vec![
        packet.strategic_assessment.clone(),
        packet.decision_recommendation.clone(),
        packet.strategic_directive.clone(),
        packet.next_falsifiable_check.clone(),
        packet.risks_and_rollback.clone(),
        packet.rejected_alternatives.clone(),
        packet.assumptions.clone(),
    ];
    for correction in &packet.required_corrections {
        prose.push(correction.change.clone());
        prose.push(correction.proof_required.clone());
    }
    let prose = prose.join(" ");

    let words = word_count(&prose);
    if words > OUTPUT_PACKET_MAX_WORDS {
        errors.push(format!(
            "output is {words} words, over the {OUTPUT_PACKET_MAX_WORDS}-word cap"
        ));
    }
    errors.extend(scan_authority_language(&prose));

    // The supervisor OPENS the files it was pointed at, so its own prose can
    // quote their contents back. Without this the return trip is laxer than the
    // outbound one.
    let mut scanned = vec![prose];
    scanned.extend(packet.evidence_read.clone());
    errors.extend(scan_secrets(&scanned.join("\n")));

    if packet.disposition == Disposition::ReturnToExecutor && packet.required_corrections.is_empty()
    {
        errors.push("RETURN_TO_EXECUTOR requires at least one required correction".to_string());
    }

    Validation::new(errors)
}

#[cfg(test)]
#[path = "supervision_output_tests.rs"]
mod tests;
