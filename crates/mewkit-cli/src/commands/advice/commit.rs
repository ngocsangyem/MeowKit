//! `advice commit` — record a delivered result, write the receipt, apply any
//! correction.
//!
//! The dossier write is the durable commit; the receipt is the human record.
//! The receipt is written FIRST so a crash between them leaves a readable
//! orphan rather than a committed checkpoint whose evidence never landed.
use std::path::Path;

use mewkit_core::advice::protocol::charges_to_partition;
use mewkit_core::advice::store::{CommitResult, commit_checkpoint, update_dossier};
use mewkit_core::advice::wire::{disposition_from_wire, disposition_wire, stage_wire};
use mewkit_core::schema::dossier::{CheckpointMarker, Dossier};
use mewkit_core::schema::supervision_protocol::Disposition;

use super::{
    AdviceArgs, AdviceError, evidence_correction, load_dossier, receipt, refuse, store_error,
};

pub(super) fn run(project_root: &Path, args: &AdviceArgs) -> Result<(), AdviceError> {
    let run_id = args
        .run
        .as_deref()
        .ok_or_else(|| refuse("`advice commit` requires --run <supervisionRunId>."))?;
    let checkpoint_id = args
        .checkpoint
        .as_deref()
        .ok_or_else(|| refuse("`advice commit` requires --checkpoint <checkpointId>."))?;
    let reason = args
        .reason
        .as_deref()
        .ok_or_else(|| refuse("`advice commit` requires --reason (required even when adopted)."))?;

    let dossier = load_dossier(project_root, run_id)?.ok_or_else(|| {
        refuse(format!(
            "No supervision run \"{run_id}\" — run `mewkit advice begin` first."
        ))
    })?;
    let marker = dossier
        .checkpoint
        .clone()
        .filter(|m| m.checkpoint_id == checkpoint_id)
        .ok_or_else(|| {
            refuse(format!(
                "Refused: no open checkpoint \"{checkpoint_id}\" on run \"{run_id}\"."
            ))
        })?;
    let disposition = legal_disposition(args, &marker)?;
    confirm_release_stage(args, &marker, checkpoint_id)?;

    let record = receipt::assemble(args, &dossier, &marker, disposition, reason);
    receipt::check(&record, receipt::outcome_of(args), reason)?;
    let relative = receipt::path_for(args, &dossier, run_id)?;
    let written = receipt::write(&project_root.join(&relative), &record);

    commit_to_dossier(
        project_root,
        args,
        dossier,
        &marker,
        disposition,
        &relative,
        written,
    )?;

    println!(
        "Committed {}/{checkpoint_id} — disposition {}, outcome {}.",
        stage_wire(marker.stage),
        disposition_wire(disposition),
        receipt::outcome_of(args)
    );
    if written {
        println!("  receipt: {relative}");
    }
    announce(project_root, args, disposition)
}

/// The returned routing signal, refused when the stage cannot legally issue it.
fn legal_disposition(
    args: &AdviceArgs,
    marker: &CheckpointMarker,
) -> Result<Disposition, AdviceError> {
    args.disposition
        .as_deref()
        .and_then(disposition_from_wire)
        .filter(|d| marker.stage.allows(*d))
        .ok_or_else(|| {
            refuse(format!(
                "Refused: \"{}\" is not legal at {}.\n  legal here: {}",
                args.disposition.as_deref().unwrap_or("(none)"),
                stage_wire(marker.stage),
                marker
                    .stage
                    .legal_dispositions()
                    .iter()
                    .map(|d| disposition_wire(*d))
                    .collect::<Vec<_>>()
                    .join(", ")
            ))
        })
}

/// The budget is fixed when the slot is claimed. A `--release-stage` on commit
/// may only CONFIRM it: letting it differ would charge the call to one budget
/// and record it against another, which is how a spent slot comes back.
fn confirm_release_stage(
    args: &AdviceArgs,
    marker: &CheckpointMarker,
    checkpoint_id: &str,
) -> Result<(), AdviceError> {
    match super::partition_of(args) {
        Some(claimed) if Some(claimed) != marker.partition.as_deref() => Err(refuse(format!(
            "Refused: checkpoint \"{checkpoint_id}\" opened in {}, not {claimed} — the release stage is fixed at `begin`.",
            marker.partition.as_deref().unwrap_or("(no release stage)")
        ))),
        _ => Ok(()),
    }
}

/// Re-read and mutate under the lock: the copy loaded earlier may be stale, and
/// a lost update here would return a spent cap slot to the run.
fn commit_to_dossier(
    project_root: &Path,
    args: &AdviceArgs,
    dossier: Dossier,
    marker: &CheckpointMarker,
    disposition: Disposition,
    relative: &str,
    receipt_written: bool,
) -> Result<(), AdviceError> {
    let partition = marker.partition.clone();
    let pointer = receipt_written.then(|| relative.to_string());
    update_dossier(project_root, &dossier.run_id.clone(), move |existing| {
        let current = existing.unwrap_or(dossier);
        let skill = current.skill.clone();
        let committed = commit_checkpoint(
            current,
            &CommitResult {
                latest_directive: args.directive.clone().unwrap_or_default(),
                next_safe_action: args.next.clone().unwrap_or_default(),
                disposition,
                receipt_pointer: pointer,
                corrections: u64::from(disposition == Disposition::ReturnToExecutor),
            },
        );
        // A second unresolved return is the human's call, so record it where a
        // later call — including one under a fresh run id — will see it. Returns
        // are counted within the budget that spent them, but the escalation flag
        // itself stays run-wide: once a human has been asked, the whole run
        // waits for them, not just the stage that asked.
        let returns = committed
            .history
            .iter()
            .filter(|h| {
                h.disposition == Disposition::ReturnToExecutor
                    && charges_to_partition(&skill, h, partition.as_deref())
            })
            .count();
        Ok(Dossier {
            escalated_to_human: committed.escalated_to_human || returns >= 2,
            ..committed
        })
    })
    .map_err(store_error)?;
    Ok(())
}

/// What the disposition means for the workflow. None of these clears a gate,
/// and the one that reads most like clearance says so explicitly.
fn announce(
    project_root: &Path,
    args: &AdviceArgs,
    disposition: Disposition,
) -> Result<(), AdviceError> {
    match disposition {
        Disposition::ReturnToExecutor => evidence_correction::apply(project_root, args),
        Disposition::ReadyForExistingGate => {
            println!("  the normal reviewer/gate is the next step — this does NOT clear it.");
            Ok(())
        }
        Disposition::EscalateToHuman => {
            println!("  stop at the existing human touchpoint.");
            Ok(())
        }
        _ => Ok(()),
    }
}
