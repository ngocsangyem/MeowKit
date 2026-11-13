//! The two guards that keep an escalation from being walked around.
//!
//! Caps are per run and the run id comes from the CALLER, so "cap reached —
//! escalate" is only as strong as the caller's willingness to stop. Both rules
//! below exist because the cheapest response to a refusal would otherwise be a
//! fresh `--run` id, and the human the refusal asked for never gets involved.
use std::path::Path;

use mewkit_core::advice::store::{StoreError, list_supervision_runs, update_dossier};
use mewkit_core::schema::dossier::Dossier;
use mewkit_core::schema::dossier_parse::DossierRead;

use super::{AdviceError, escalate, refuse};

/// Refuse a NEW run for a skill that already has an escalated one.
///
/// Resuming the ESCALATED run is still allowed; what is refused is starting a
/// parallel one around it.
pub(super) fn refuse_if_skill_already_escalated(
    project_root: &Path,
    run_id: &str,
    skill: &str,
) -> Result<(), AdviceError> {
    for (other_id, read) in list_supervision_runs(project_root) {
        if other_id == run_id {
            continue;
        }
        match read {
            // A damaged sibling is refused too: skipping it would restore the
            // bypass by simply corrupting the record that says "escalate".
            DossierRead::Corrupt(reason) => {
                return Err(refuse(format!(
                    "Refused: supervision record \"{other_id}\" is unreadable ({reason}) — repair or remove it first."
                )));
            }
            DossierRead::Absent => {}
            DossierRead::Found(other) if other.skill == skill && other.escalated_to_human => {
                return Err(escalate(format!(
                    "Refused: run \"{other_id}\" for {skill} escalated to a human and is unresolved.\n\
                     A new run id does not clear an escalation. Resolve it with the human, then remove or resume that run."
                )));
            }
            DossierRead::Found(_) => {}
        }
    }
    Ok(())
}

/// Persist the escalation, then refuse — so the marker survives the refusal.
pub(super) fn record_escalation(project_root: &Path, run_id: &str, reason: &str) -> AdviceError {
    let written = update_dossier(project_root, run_id, |existing| match existing {
        Some(dossier) => Ok(Dossier {
            escalated_to_human: true,
            ..dossier
        }),
        // No run to mark: the refusal below says the same thing, so there is
        // nothing further to report.
        None => Err(String::new()),
    });
    if let Err(error) = written
        && !matches!(error, StoreError::Refused(_))
    {
        // Advisory, never silent: losing the marker is worse than a noisy line.
        eprintln!("⚠ could not record the escalation: {error}");
    }
    escalate(format!("Checkpoint refused: {reason}"))
}
