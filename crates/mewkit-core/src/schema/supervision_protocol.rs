//! The supervision state machine's vocabularies.
//!
//! A disposition ROUTES work. None of them advances a gate, and the stage→
//! disposition table is what keeps that true: a forward-looking stage cannot
//! report on finished work, and a backward-looking stage cannot hand out a
//! "carry on" directive. Mixing them is how a review turns into tacit approval,
//! so the legality check is part of the contract rather than a reviewer's memory.

use std::sync::LazyLock;

use regex::Regex;
use serde::{Deserialize, Serialize};

/// The four supervisory checkpoints of one supervised run.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SupervisionStage {
    #[serde(rename = "GUIDE")]
    Guide,
    #[serde(rename = "RESCUE")]
    Rescue,
    #[serde(rename = "REVIEW")]
    Review,
    #[serde(rename = "RECHECK")]
    Recheck,
}

/// Every disposition the supervisor may return, across all stages.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Disposition {
    #[serde(rename = "CONTINUE_WITH_DIRECTIVE")]
    ContinueWithDirective,
    #[serde(rename = "READY_FOR_EXISTING_GATE")]
    ReadyForExistingGate,
    #[serde(rename = "RETURN_TO_EXECUTOR")]
    ReturnToExecutor,
    #[serde(rename = "ESCALATE_TO_HUMAN")]
    EscalateToHuman,
    #[serde(rename = "BLOCKED_MISSING_EVIDENCE")]
    BlockedMissingEvidence,
}

impl SupervisionStage {
    /// The dispositions this stage may legally return.
    pub fn legal_dispositions(self) -> &'static [Disposition] {
        use Disposition::*;
        match self {
            // Forward-looking: may direct work, may stop, may ask for evidence —
            // but cannot declare finished work ready, because none exists yet.
            Self::Guide | Self::Rescue => &[
                ContinueWithDirective,
                EscalateToHuman,
                BlockedMissingEvidence,
            ],
            // Backward-looking: may hand finished work to its EXISTING gate or
            // return it, but never issue a fresh "carry on".
            Self::Review | Self::Recheck => &[
                ReadyForExistingGate,
                ReturnToExecutor,
                EscalateToHuman,
                BlockedMissingEvidence,
            ],
        }
    }

    pub fn allows(self, disposition: Disposition) -> bool {
        self.legal_dispositions().contains(&disposition)
    }
}

/// A supervision run id: the same slug shape a task id uses, because it also
/// becomes part of a filename.
static RUN_ID_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^[a-z0-9][a-z0-9-]{0,63}$").expect("static run id pattern"));

pub fn is_valid_run_id(run_id: &str) -> bool {
    RUN_ID_RE.is_match(run_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_forward_stage_cannot_report_finished_work_ready() {
        assert!(SupervisionStage::Guide.allows(Disposition::ContinueWithDirective));
        assert!(!SupervisionStage::Guide.allows(Disposition::ReadyForExistingGate));
        assert!(!SupervisionStage::Rescue.allows(Disposition::ReturnToExecutor));
    }

    #[test]
    fn a_backward_stage_cannot_hand_out_a_fresh_directive() {
        assert!(SupervisionStage::Review.allows(Disposition::ReadyForExistingGate));
        assert!(SupervisionStage::Recheck.allows(Disposition::ReturnToExecutor));
        assert!(!SupervisionStage::Review.allows(Disposition::ContinueWithDirective));
    }

    #[test]
    fn every_stage_may_escalate_or_report_missing_evidence() {
        for stage in [
            SupervisionStage::Guide,
            SupervisionStage::Rescue,
            SupervisionStage::Review,
            SupervisionStage::Recheck,
        ] {
            assert!(stage.allows(Disposition::EscalateToHuman));
            assert!(stage.allows(Disposition::BlockedMissingEvidence));
        }
    }

    #[test]
    fn stages_and_dispositions_use_their_screaming_wire_forms() {
        assert_eq!(
            serde_json::to_value(SupervisionStage::Recheck).expect("serializable"),
            serde_json::json!("RECHECK")
        );
        assert_eq!(
            serde_json::from_value::<Disposition>(serde_json::json!("RETURN_TO_EXECUTOR"))
                .expect("known disposition"),
            Disposition::ReturnToExecutor
        );
        assert!(
            serde_json::from_value::<Disposition>(serde_json::json!("APPROVED")).is_err(),
            "there is no approval disposition"
        );
    }

    #[test]
    fn run_ids_are_filename_safe_slugs() {
        assert!(is_valid_run_id("261112-advice-7"));
        assert!(!is_valid_run_id("../escape"));
        assert!(!is_valid_run_id("-leading"));
        assert!(!is_valid_run_id(""));
        assert!(!is_valid_run_id(&"a".repeat(65)));
    }
}
