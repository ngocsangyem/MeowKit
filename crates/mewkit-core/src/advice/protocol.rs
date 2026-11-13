//! Supervision budgets: which skills expose a checkpoint, how many calls each
//! gets, and whether that budget is per run or per release stage.
//!
//! [`crate::schema::supervision_protocol`] owns the stage→disposition legality
//! table; this owns the ACCOUNTING, which is the half a caller can walk around.
//! Caps are per run and the run id comes from the caller, so every rule here
//! errs toward under-permitting: an unattributable history entry is charged to
//! every budget rather than none, and a duplicate checkpoint id is answered from
//! the record rather than given a fresh slot.
//!
//! No decision here advances a gate. A refusal routes to a human; an allowance
//! only buys the right to ask a question.

use super::wire::stage_wire;
use crate::schema::dossier::CheckpointHistory;
use crate::schema::supervision_protocol::{Disposition, SupervisionStage};

/// Per-stage call ceiling within one supervised run (or one partition of it).
pub fn per_stage_max(stage: SupervisionStage) -> usize {
    match stage {
        SupervisionStage::Guide => 1,
        // One rescue per rework round; two rounds is the ceiling before a human
        // decides.
        SupervisionStage::Rescue => 2,
        SupervisionStage::Review => 1,
        SupervisionStage::Recheck => 1,
    }
}

/// Call ceiling per wrapped skill. A flat per-RUN total, except for a skill in
/// [`partition_values_for`], where it is the ceiling per PARTITION.
///
/// A slice rather than a map: the set is small and fixed, and the declaration
/// order is the order `status` would print it in.
pub const SKILL_HARD_CAPS: &[(&str, usize)] = &[
    ("mk:brainstorming", 4),
    ("mk:plan-creator", 4),
    ("mk:cook", 5),
    ("mk:fix", 5),
    ("mk:autobuild", 5),
    ("mk:ship", 4),
];

/// Ship's scopes. One ship run may pass through all three in sequence.
pub const RELEASE_STAGES: &[&str] = &["prepare", "release", "publish"];

/// The cap for `skill`, or `None` when it exposes no checkpoint.
pub fn skill_cap(skill: &str) -> Option<usize> {
    SKILL_HARD_CAPS
        .iter()
        .find_map(|(name, cap)| (*name == skill).then_some(*cap))
}

/// Skills that expose `--advice`. Anything else is not a supervision entry point.
pub fn is_supervised_skill(skill: &str) -> bool {
    skill_cap(skill).is_some()
}

/// The partition values a skill accepts, or `None` when its cap is per run.
///
/// `mk:ship` is the reason partitioning exists: its three scopes are three
/// separate decisions, and a run that walks all three under one flat budget
/// arrives at `publish` with its supervision already spent on `prepare`.
pub fn partition_values_for(skill: &str) -> Option<&'static [&'static str]> {
    (skill == "mk:ship").then_some(RELEASE_STAGES)
}

/// Whether `record` is charged to `partition`'s budget for `skill`.
///
/// On an unpartitioned skill everything counts — there is one budget. On a
/// partitioned one, a record naming no partition, or one the skill does not
/// declare, is UNATTRIBUTABLE and counts against EVERY partition.
///
/// The tempting reading — "it belongs to no partition, so skip it" — silently
/// turns every such entry into a free slot in all three budgets, which is how a
/// run that already exhausted a flat cap acquires 4×3 fresh calls and how a run
/// holding two unresolved returns loses its escalation. Counting it everywhere
/// can only under-permit, which is the direction to err in.
pub fn charges_to_partition(
    skill: &str,
    record: &CheckpointHistory,
    partition: Option<&str>,
) -> bool {
    let Some(legal) = partition_values_for(skill) else {
        return true;
    };
    let attributable = record
        .partition
        .as_deref()
        .is_some_and(|p| legal.contains(&p));
    record.partition.as_deref() == partition || !attributable
}

/// Whether a proposed checkpoint call may run.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StageDecision {
    /// `duplicate_of` means the id already ran: answer from the record, spend
    /// nothing.
    Allowed { duplicate_of: Option<String> },
    /// `escalate` means hand off to a human — it is not a retry hint.
    Refused { reason: String, escalate: bool },
}

/// What a caller proposes to do.
pub struct StageRequest<'a> {
    pub skill: &'a str,
    pub stage: SupervisionStage,
    pub checkpoint_id: &'a str,
    pub history: &'a [CheckpointHistory],
    /// Required for a partitioned skill, refused for any other.
    pub partition: Option<&'a str>,
}

/// Decide whether `request` may run.
///
/// Idempotency is checked FIRST, against the WHOLE run history: a retried
/// checkpoint must be a no-op rather than consume a slot, or a crash between the
/// pending marker and the committed result silently spends the budget. A
/// checkpoint id is unique per run, not per partition, so that check ignores
/// partitioning on purpose. Everything after it is a real new call.
pub fn evaluate_stage_request(request: &StageRequest<'_>) -> StageDecision {
    let StageRequest {
        skill,
        stage,
        checkpoint_id,
        history,
        partition,
    } = *request;

    if let Some(duplicate) = history.iter().find(|h| h.checkpoint_id == checkpoint_id) {
        return StageDecision::Allowed {
            duplicate_of: Some(duplicate.checkpoint_id.clone()),
        };
    }
    let Some(cap) = skill_cap(skill) else {
        return refuse(format!("{skill} does not expose --advice"), false);
    };

    let legal_partitions = partition_values_for(skill);
    match (legal_partitions, partition) {
        (Some(legal), None) => {
            return refuse(
                format!(
                    "{skill} budgets supervision per release stage — name one of {}",
                    legal.join(", ")
                ),
                false,
            );
        }
        (Some(legal), Some(p)) if !legal.contains(&p) => {
            return refuse(
                format!(
                    "\"{p}\" is not a release stage for {skill} — expected {}",
                    legal.join(", ")
                ),
                false,
            );
        }
        (None, Some(_)) => {
            return refuse(
                format!("{skill} has a per-run cap and takes no release stage"),
                false,
            );
        }
        _ => {}
    }

    // The active budget. For a partitioned skill each partition carries its own
    // per-stage maxima, return counter and cap — that is what "per release
    // stage" means.
    let scoped: Vec<&CheckpointHistory> = history
        .iter()
        .filter(|h| charges_to_partition(skill, h, partition))
        .collect();
    let within = match (legal_partitions, partition) {
        (Some(_), Some(p)) => format!("in {p}"),
        _ => "in this run".to_string(),
    };

    // A second unresolved return is a human's decision, not a third supervisor
    // opinion. Counted within the budget: a resolved return while preparing and
    // an unrelated one while releasing are two episodes, not one loop.
    let returns = scoped
        .iter()
        .filter(|h| h.disposition == Disposition::ReturnToExecutor)
        .count();
    if returns >= 2 {
        return refuse(
            format!("work was returned twice without resolution {within} — escalate to a human"),
            true,
        );
    }

    let at_stage = scoped.iter().filter(|h| h.stage == stage).count();
    let stage_max = per_stage_max(stage);
    if at_stage >= stage_max {
        return refuse(
            format!("{} already ran {stage_max}× {within}", stage_wire(stage)),
            stage == SupervisionStage::Recheck,
        );
    }

    // RECHECK exists only to re-examine returned work; without a return it would
    // be a second free review of unchanged evidence.
    if stage == SupervisionStage::Recheck && returns == 0 {
        return refuse(
            format!("RECHECK requires a prior RETURN_TO_EXECUTOR {within}"),
            false,
        );
    }

    if scoped.len() >= cap {
        return refuse(
            format!("{skill} reached its {cap}-call supervision cap {within}"),
            true,
        );
    }

    StageDecision::Allowed { duplicate_of: None }
}

fn refuse(reason: String, escalate: bool) -> StageDecision {
    StageDecision::Refused { reason, escalate }
}

#[cfg(test)]
#[path = "protocol_tests.rs"]
mod tests;
