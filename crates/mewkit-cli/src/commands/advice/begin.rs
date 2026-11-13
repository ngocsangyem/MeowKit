//! `advice begin` — claim a checkpoint slot and write the pending marker.
use std::path::Path;

use mewkit_core::advice::mode::classify_embedded_call;
use mewkit_core::advice::protocol::{
    StageDecision, StageRequest, charges_to_partition, evaluate_stage_request, is_supervised_skill,
    skill_cap,
};
use mewkit_core::advice::store::{begin_checkpoint, update_dossier};
use mewkit_core::advice::wire::{disposition_wire, stage_wire};
use mewkit_core::schema::dossier::Dossier;
use mewkit_core::schema::dossier_doc::dossier_path;
use mewkit_core::schema::supervision_protocol::SupervisionStage;

use super::escalation::{record_escalation, refuse_if_skill_already_escalated};
use super::{
    AdviceArgs, AdviceError, escalate, load_dossier, or_else, partition_of, refuse, store_error,
};

pub(super) fn run(project_root: &Path, args: &AdviceArgs) -> Result<(), AdviceError> {
    let run_id = args
        .run
        .as_deref()
        .ok_or_else(|| refuse("`advice begin` requires --run <supervisionRunId>."))?;
    let skill = args
        .skill
        .as_deref()
        .ok_or_else(|| refuse("`advice begin` requires --skill <mk:skill>."))?;
    let checkpoint_id = args
        .checkpoint
        .as_deref()
        .ok_or_else(|| refuse("`advice begin` requires --checkpoint <checkpointId>."))?;

    // Route contract first: a call claiming embedded supervision without the
    // full triple is refused, never downgraded to a stateless consult.
    let call = classify_embedded_call(run_id, args.stage.as_deref(), checkpoint_id)
        .map_err(|reason| refuse(format!("Refused: {reason}")))?;
    if !is_supervised_skill(skill) {
        return Err(refuse(format!(
            "Refused: {skill} does not expose --advice."
        )));
    }

    // Read once outside the lock only to decide refusals that need no write.
    // The authoritative read happens inside `update_dossier` below.
    let preview = load_dossier(project_root, run_id)?;
    if let Some(existing) = &preview
        && existing.skill != skill
    {
        return Err(refuse(format!(
            "Refused: run \"{run_id}\" belongs to {}, not {skill}.",
            existing.skill
        )));
    }
    if preview.is_none() {
        refuse_if_skill_already_escalated(project_root, run_id, skill)?;
    }
    if preview.as_ref().is_some_and(|d| d.escalated_to_human) {
        return Err(escalate(format!(
            "Refused: run \"{run_id}\" escalated to a human and is unresolved — that decision is theirs, not a retry."
        )));
    }

    let partition = partition_of(args);
    let history = preview
        .as_ref()
        .map(|d| d.history.as_slice())
        .unwrap_or(&[]);
    match evaluate_stage_request(&StageRequest {
        skill,
        stage: call.stage,
        checkpoint_id,
        history,
        partition,
    }) {
        StageDecision::Refused { reason, escalate } => {
            if escalate {
                return Err(record_escalation(project_root, run_id, &reason));
            }
            Err(refuse(format!("Checkpoint refused: {reason}")))
        }
        StageDecision::Allowed {
            duplicate_of: Some(_),
        } => replay(preview.as_ref(), checkpoint_id, call.stage, partition),
        StageDecision::Allowed { duplicate_of: None } => {
            open(project_root, args, run_id, skill, call.stage, partition)
        }
    }
}

/// Idempotent by design: a retried checkpoint returns the prior result instead
/// of spending a slot, which is what makes crash-and-resume safe.
///
/// A different STAGE or a different RELEASE STAGE under the same id is a naming
/// collision, not a retry — accepting it would return the recorded result of
/// another checkpoint and silently skip this one, while spending nothing.
fn replay(
    preview: Option<&Dossier>,
    checkpoint_id: &str,
    stage: SupervisionStage,
    partition: Option<&str>,
) -> Result<(), AdviceError> {
    if let Some(prior) =
        preview.and_then(|d| d.history.iter().find(|h| h.checkpoint_id == checkpoint_id))
    {
        if prior.stage != stage {
            return Err(refuse(format!(
                "Refused: checkpointId \"{checkpoint_id}\" already ran at {} — use a distinct id per checkpoint.",
                stage_wire(prior.stage)
            )));
        }
        if prior.partition.as_deref() != partition {
            return Err(refuse(format!(
                "Refused: checkpointId \"{checkpoint_id}\" already ran in {} — use a distinct id per release stage.",
                prior.partition.as_deref().unwrap_or("(no release stage)")
            )));
        }
    }
    println!(
        "Checkpoint \"{checkpoint_id}\" already ran — returning the recorded result, no slot spent."
    );
    let directive = preview.map(|d| d.latest_directive.as_str()).unwrap_or("");
    let next = preview.map(|d| d.next_safe_action.as_str()).unwrap_or("");
    println!("  latest directive: {}", or_else(directive, "(none)"));
    println!("  next safe action: {}", or_else(next, "(none)"));
    Ok(())
}

fn open(
    project_root: &Path,
    args: &AdviceArgs,
    run_id: &str,
    skill: &str,
    stage: SupervisionStage,
    partition: Option<&str>,
) -> Result<(), AdviceError> {
    let written = update_dossier(project_root, run_id, |existing| {
        let base = existing.unwrap_or(Dossier {
            run_id: run_id.to_string(),
            skill: skill.to_string(),
            stage,
            locked_decision_pointers: Vec::new(),
            latest_directive: String::new(),
            correction_count: 0,
            receipt_pointers: Vec::new(),
            next_safe_action: String::new(),
            checkpoint: None,
            history: Vec::new(),
            escalated_to_human: false,
        });
        Ok(begin_checkpoint(
            base,
            args.checkpoint.clone().unwrap_or_default(),
            stage,
            partition.map(str::to_string),
        ))
    })
    .map_err(store_error)?;

    // Report usage against the budget this call actually SPENDS, not the run
    // total — on a partitioned skill those differ, and the run total would
    // misstate what is left.
    let spent = written
        .history
        .iter()
        .filter(|h| charges_to_partition(skill, h, partition))
        .count();
    let scope = match partition {
        Some(p) => format!("{skill} / {p}"),
        None => skill.to_string(),
    };
    let checkpoint_id = args.checkpoint.as_deref().unwrap_or_default();
    println!(
        "Checkpoint {}/{checkpoint_id} opened ({} of {} for {scope}).",
        stage_wire(stage),
        spent + 1,
        skill_cap(skill).unwrap_or(0)
    );
    let dossier = dossier_path(project_root, run_id).unwrap_or_default();
    println!(
        "  dossier: {}",
        mewkit_core::advice::paths::relative_to(project_root, &dossier)
    );
    println!(
        "  legal dispositions: {}",
        stage
            .legal_dispositions()
            .iter()
            .map(|d| disposition_wire(*d))
            .collect::<Vec<_>>()
            .join(", ")
    );
    println!("  supervision is evidence — it clears no gate and counts as no verification.");
    Ok(())
}
