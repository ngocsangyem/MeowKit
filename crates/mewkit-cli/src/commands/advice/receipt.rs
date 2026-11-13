//! Assembling, checking and writing the per-checkpoint receipt.
//!
//! The receipt answers what the dossier deliberately cannot: what was asked,
//! what came back, and what the PARENT did about it. `disposition` (recorded
//! verbatim) and `outcome` (the parent's own call) stay separate fields —
//! collapsing them would erase the case that matters most, a parent rightly
//! rejecting a directive.
use std::path::Path;

use mewkit_core::advice::receipt_doc::render_receipt;
use mewkit_core::advice::wire::{RECEIPT_OUTCOMES, outcome_from_wire};
use mewkit_core::schema::dossier::{CheckpointMarker, Dossier};
use mewkit_core::schema::supervision_protocol::Disposition;
use mewkit_core::schema::supervision_receipt::{
    Receipt, ReceiptOutcome, receipt_path, validate_receipt,
};
use mewkit_core::task_files::today_yymmdd;

use super::{AdviceArgs, AdviceError, refuse, to_array};

/// Build the receipt for a commit. The outcome is assumed valid here and
/// checked by [`check`] — an unknown one must report in the schema's wording
/// rather than crash the builder.
pub(super) fn assemble(
    args: &AdviceArgs,
    dossier: &Dossier,
    marker: &CheckpointMarker,
    disposition: Disposition,
    reason: &str,
) -> Receipt {
    Receipt {
        run_id: dossier.run_id.clone(),
        stage: marker.stage,
        disposition,
        outcome: outcome_from_wire(outcome_of(args)).unwrap_or(ReceiptOutcome::Adopted),
        reason: reason.to_string(),
        task_id: args.task_id.clone().unwrap_or_else(|| "none".into()),
        provider: args.provider.clone().unwrap_or_else(|| "unknown".into()),
        skill: dossier.skill.clone(),
        checkpoint_id: marker.checkpoint_id.clone(),
        release_stage: marker.partition.clone(),
        question: args.question.clone().unwrap_or_default(),
        directive: args.directive.clone().unwrap_or_default(),
        required_corrections: to_array(&args.correction),
        evidence_pointers: to_array(&args.evidence_pointer),
        next_safe_action: args.next.clone().unwrap_or_default(),
    }
}

/// What the parent did with the directive; `adopted` when it did not say.
pub(super) fn outcome_of(args: &AdviceArgs) -> &str {
    args.outcome.as_deref().unwrap_or("adopted")
}

/// Validate the receipt before it is written.
///
/// The two SHAPE problems reachable from this command — an unknown `--outcome`
/// and a blank `--reason` — report in the schema's own wording, because a skill
/// reads the refusal. Every other field is assembled from values already
/// checked, so a third shape error would be unreachable text.
///
/// The prose scan afterwards is not redundant with packet validation: a packet
/// is checked on the way IN from the supervisor, while a receipt is the
/// parent's own summary of it — a second authoring step that could otherwise
/// assert an approval the packet was refused for asserting.
pub(super) fn check(receipt: &Receipt, outcome: &str, reason: &str) -> Result<(), AdviceError> {
    let mut shape = Vec::new();
    if outcome_from_wire(outcome).is_none() {
        shape.push(format!(
            "outcome: Invalid enum value. Expected {}, received '{outcome}'",
            RECEIPT_OUTCOMES
                .iter()
                .map(|o| format!("'{o}'"))
                .collect::<Vec<_>>()
                .join(" | ")
        ));
    }
    if reason.is_empty() {
        shape.push("reason: String must contain at least 1 character(s)".to_string());
    }
    if !shape.is_empty() {
        return Err(refuse(format!("Refused: {}", shape.join("; "))));
    }
    let candidate = serde_json::to_value(receipt).expect("a receipt serializes");
    let found = validate_receipt(&candidate);
    if found.ok {
        Ok(())
    } else {
        Err(refuse(format!("Refused: {}", found.errors.join("; "))))
    }
}

/// Where this receipt lands, relative to the project.
pub(super) fn path_for(
    args: &AdviceArgs,
    dossier: &Dossier,
    run_id: &str,
) -> Result<String, AdviceError> {
    receipt_path(
        &today_yymmdd(),
        args.slug.as_deref().unwrap_or(run_id),
        dossier.receipt_pointers.len() as u32 + 1,
    )
    .map_err(AdviceError::Hard)
}

/// Write it, reporting whether it landed.
///
/// A failed write is advisory and never silent: the checkpoint still commits,
/// because losing cap accounting is worse than losing the record.
pub(super) fn write(absolute: &Path, receipt: &Receipt) -> bool {
    let body = render_receipt(receipt);
    let written = absolute
        .parent()
        .map(std::fs::create_dir_all)
        .unwrap_or(Ok(()))
        .and_then(|()| std::fs::write(absolute, body));
    match written {
        Ok(()) => true,
        Err(error) => {
            eprintln!("⚠ receipt write failed: {error}");
            false
        }
    }
}
