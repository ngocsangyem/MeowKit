//! What crosses the supervision context boundary on the way IN.
//!
//! Every call is a fresh context fork, so the packet IS the supervisor's entire
//! world. Two failure modes are guarded: TOO MUCH (a transcript or diff pasted
//! in reproduces the caller's context rot inside the fork and buries the actual
//! question) and SECRETS. Both fail LOUDLY before delegation rather than
//! truncating, because a truncated packet asks a different question than the one
//! intended.
//!
//! The return trip is [`super::supervision_output`], which adds the one bar this
//! side does not need: counsel may not speak with authority.

use std::sync::LazyLock;

use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::supervision_protocol::SupervisionStage;
use super::supervision_scan::{scan_bulk_content, scan_secrets};
use super::{Validation, require_non_empty};

/// Serialized input-packet ceiling. Exceeding it fails before any delegation.
pub const INPUT_PACKET_MAX_BYTES: usize = 12 * 1024;
/// Evidence is a map, not a payload: pointers only, and few of them.
pub const MAX_EVIDENCE_POINTERS: usize = 5;
/// A pointer path is a path, not a payload.
pub const MAX_POINTER_PATH_LENGTH: usize = 512;

static POINTER_PATH_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^[^\n\r\t\x00]+$").expect("static pointer path pattern"));

/// One evidence pointer. `provenance` is mandatory: an unattributed path cannot
/// be weighed, and "where did this come from" is exactly what a fresh fork
/// cannot reconstruct for itself.
///
/// `path` is shape-constrained rather than free text. Bulk-content scanning
/// skips it so a legitimate filename like `fix-diff.md` is not mistaken for a
/// diff — which means an unconstrained `path` would be an unscanned smuggling
/// channel wide enough for a PEM block. The shape rule closes that; secrets are
/// still scanned for separately.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EvidencePointer {
    pub path: String,
    pub relevance: String,
    pub provenance: String,
    pub summary: String,
}

impl EvidencePointer {
    fn validate(&self, label: &str) -> Vec<String> {
        let mut errors = Vec::new();
        if self.path.is_empty() || self.path.chars().count() > MAX_POINTER_PATH_LENGTH {
            errors.push(format!("{label}.path: must be a path of 1..512 characters"));
        } else if !POINTER_PATH_RE.is_match(&self.path) {
            errors.push(format!("{label}.path: must be a single-line path"));
        }
        require_non_empty(&format!("{label}.relevance"), &self.relevance, &mut errors);
        require_non_empty(
            &format!("{label}.provenance"),
            &self.provenance,
            &mut errors,
        );
        require_non_empty(&format!("{label}.summary"), &self.summary, &mut errors);
        errors
    }
}

/// `deny_unknown_fields`: an unknown key would be an UNSCANNED field — the same
/// class of hole as an unconstrained pointer path — and it would also make the
/// byte cap a lie, since the caller serializes a shape larger than the one that
/// was measured.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct InputPacket {
    pub run_id: String,
    pub skill: String,
    pub stage: SupervisionStage,
    pub checkpoint_id: String,
    pub mission: String,
    #[serde(default)]
    pub locked_decisions: Vec<String>,
    pub current_state: String,
    #[serde(default)]
    pub worker_summary: String,
    #[serde(default)]
    pub evidence_refs: Vec<EvidencePointer>,
    #[serde(default)]
    pub prior_directive: Option<String>,
    pub question: String,
    pub risk_and_reversibility: String,
}

/// Serialized byte length, which is what the cap is actually about.
pub fn packet_bytes(packet: &InputPacket) -> usize {
    serde_json::to_string(packet).map(|s| s.len()).unwrap_or(0)
}

/// Validate an input packet before delegation: shape, byte cap, pointer budget,
/// provenance, and forbidden content. Schema errors are reported alongside the
/// content findings so a caller sees the whole picture in one pass.
pub fn validate_input_packet(candidate: &Value) -> Validation {
    let packet: InputPacket = match serde_json::from_value(candidate.clone()) {
        Ok(p) => p,
        Err(e) => return Validation::new(vec![e.to_string()]),
    };

    let mut errors = Vec::new();
    for (label, value) in [
        ("runId", &packet.run_id),
        ("skill", &packet.skill),
        ("checkpointId", &packet.checkpoint_id),
        ("mission", &packet.mission),
        ("currentState", &packet.current_state),
        ("question", &packet.question),
        ("riskAndReversibility", &packet.risk_and_reversibility),
    ] {
        require_non_empty(label, value, &mut errors);
    }
    if packet.evidence_refs.len() > MAX_EVIDENCE_POINTERS {
        errors.push(format!(
            "evidenceRefs: at most {MAX_EVIDENCE_POINTERS} pointers"
        ));
    }
    for (i, pointer) in packet.evidence_refs.iter().enumerate() {
        errors.extend(pointer.validate(&format!("evidenceRefs.{i}")));
    }
    if !errors.is_empty() {
        return Validation::new(errors);
    }

    let bytes = packet_bytes(&packet);
    if bytes > INPUT_PACKET_MAX_BYTES {
        errors.push(format!(
            "packet is {bytes}B, over the {INPUT_PACKET_MAX_BYTES}B cap — select fewer pointers"
        ));
    }

    // Bulk-content scanning covers author-supplied prose. Pointer PATHS are
    // exempt: `tasks/reports/fix-diff.md` legitimately names a diff without
    // containing one.
    let mut prose = vec![
        packet.mission.clone(),
        packet.current_state.clone(),
        packet.worker_summary.clone(),
        packet.question.clone(),
        packet.risk_and_reversibility.clone(),
        packet.prior_directive.clone().unwrap_or_default(),
    ];
    prose.extend(packet.locked_decisions.clone());
    prose.extend(
        packet
            .evidence_refs
            .iter()
            .map(|e| format!("{} {} {}", e.relevance, e.provenance, e.summary)),
    );
    let prose = prose.join("\n");
    errors.extend(scan_bulk_content(&prose));

    // Secret scanning has NO exemption and covers every field, paths included.
    // The path exemption above is about diff-shaped FILENAMES; it must never
    // become a channel that carries a credential past the boundary.
    let mut scanned = vec![prose];
    scanned.extend(packet.evidence_refs.iter().map(|e| e.path.clone()));
    errors.extend(scan_secrets(&scanned.join("\n")));

    Validation::new(errors)
}

#[cfg(test)]
#[path = "supervision_packet_tests.rs"]
mod tests;
