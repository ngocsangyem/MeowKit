//! The screaming spellings a caller types and a message quotes.
//!
//! The serde derives on [`SupervisionStage`] and [`Disposition`] already carry
//! these names, but only on the JSON boundary. A refusal message and a `--stage`
//! argument are not JSON, and routing them through `serde_json` to recover one
//! word would make a parse failure the error path for a typo. Explicit tables
//! keep that conversion total in both directions.
//!
//! The set is closed, and nothing in it means "approved": there is no
//! disposition a caller can spell that advances a gate.

use crate::schema::supervision_protocol::{Disposition, SupervisionStage};

pub fn stage_wire(stage: SupervisionStage) -> &'static str {
    match stage {
        SupervisionStage::Guide => "GUIDE",
        SupervisionStage::Rescue => "RESCUE",
        SupervisionStage::Review => "REVIEW",
        SupervisionStage::Recheck => "RECHECK",
    }
}

pub fn disposition_wire(disposition: Disposition) -> &'static str {
    match disposition {
        Disposition::ContinueWithDirective => "CONTINUE_WITH_DIRECTIVE",
        Disposition::ReadyForExistingGate => "READY_FOR_EXISTING_GATE",
        Disposition::ReturnToExecutor => "RETURN_TO_EXECUTOR",
        Disposition::EscalateToHuman => "ESCALATE_TO_HUMAN",
        Disposition::BlockedMissingEvidence => "BLOCKED_MISSING_EVIDENCE",
    }
}

/// Parse a stage from the spelling a caller typed.
pub fn stage_from_wire(raw: &str) -> Option<SupervisionStage> {
    match raw {
        "GUIDE" => Some(SupervisionStage::Guide),
        "RESCUE" => Some(SupervisionStage::Rescue),
        "REVIEW" => Some(SupervisionStage::Review),
        "RECHECK" => Some(SupervisionStage::Recheck),
        _ => None,
    }
}

/// Parse a disposition from the spelling a caller typed.
pub fn disposition_from_wire(raw: &str) -> Option<Disposition> {
    match raw {
        "CONTINUE_WITH_DIRECTIVE" => Some(Disposition::ContinueWithDirective),
        "READY_FOR_EXISTING_GATE" => Some(Disposition::ReadyForExistingGate),
        "RETURN_TO_EXECUTOR" => Some(Disposition::ReturnToExecutor),
        "ESCALATE_TO_HUMAN" => Some(Disposition::EscalateToHuman),
        "BLOCKED_MISSING_EVIDENCE" => Some(Disposition::BlockedMissingEvidence),
        _ => None,
    }
}

/// The spelling of a parent's own outcome, kept here beside the dispositions so
/// the two vocabularies stay visibly distinct: one is what came back, the other
/// is what the parent did with it.
pub fn outcome_from_wire(raw: &str) -> Option<crate::schema::supervision_receipt::ReceiptOutcome> {
    use crate::schema::supervision_receipt::ReceiptOutcome;
    match raw {
        "adopted" => Some(ReceiptOutcome::Adopted),
        "rejected" => Some(ReceiptOutcome::Rejected),
        "deferred" => Some(ReceiptOutcome::Deferred),
        _ => None,
    }
}

/// Every outcome a receipt may record, in schema order — the list a refusal
/// quotes back.
pub const RECEIPT_OUTCOMES: &[&str] = &["adopted", "rejected", "deferred"];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_spelling_round_trips() {
        for stage in [
            SupervisionStage::Guide,
            SupervisionStage::Rescue,
            SupervisionStage::Review,
            SupervisionStage::Recheck,
        ] {
            assert_eq!(stage_from_wire(stage_wire(stage)), Some(stage));
        }
        for disposition in [
            Disposition::ContinueWithDirective,
            Disposition::ReadyForExistingGate,
            Disposition::ReturnToExecutor,
            Disposition::EscalateToHuman,
            Disposition::BlockedMissingEvidence,
        ] {
            assert_eq!(
                disposition_from_wire(disposition_wire(disposition)),
                Some(disposition)
            );
        }
        for outcome in RECEIPT_OUTCOMES {
            assert!(outcome_from_wire(outcome).is_some());
        }
    }

    #[test]
    fn a_typo_is_none_rather_than_the_nearest_match() {
        assert_eq!(stage_from_wire("guide"), None);
        assert_eq!(disposition_from_wire("APPROVED"), None);
        assert_eq!(outcome_from_wire("Adopted"), None);
    }

    #[test]
    fn no_disposition_in_the_vocabulary_grants_approval() {
        // These spellings are the whole set a caller may name. An "approved" or
        // "gate cleared" routing signal does not exist, which is what keeps a
        // checkpoint from advancing a gate however the call is worded.
        for wire in [
            "APPROVED",
            "GATE_CLEARED",
            "READY",
            "PASS",
            "CLEARED_FOR_SHIP",
        ] {
            assert_eq!(disposition_from_wire(wire), None, "{wire} must not parse");
        }
        for stage in [
            SupervisionStage::Guide,
            SupervisionStage::Rescue,
            SupervisionStage::Review,
            SupervisionStage::Recheck,
        ] {
            for disposition in stage.legal_dispositions() {
                let wire = disposition_wire(*disposition);
                assert!(
                    !wire.contains("APPROV") && !wire.contains("CLEAR"),
                    "{wire} reads as authority"
                );
            }
        }
    }
}
