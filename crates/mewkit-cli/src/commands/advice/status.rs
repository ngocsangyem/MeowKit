//! `advice status` — what a resuming parent needs, without loading any history.
use std::path::Path;

use mewkit_core::advice::protocol::{charges_to_partition, partition_values_for, skill_cap};
use mewkit_core::advice::wire::stage_wire;
use mewkit_core::schema::dossier::CheckpointState;

use super::{AdviceArgs, AdviceError, or_else, refuse};

pub(super) fn run(project_root: &Path, args: &AdviceArgs) -> Result<(), AdviceError> {
    let run_id = args
        .run
        .as_deref()
        .ok_or_else(|| refuse("`advice status` requires --run <supervisionRunId>."))?;
    let Some(dossier) = super::load_dossier(project_root, run_id)? else {
        println!("No supervision run \"{run_id}\".");
        return Ok(());
    };
    if args.json {
        let json = serde_json::to_string_pretty(&dossier).expect("a dossier serializes");
        println!("{json}");
        return Ok(());
    }

    // A skill the caps table does not know reports 0 rather than a garbled
    // number: a hand-edited `skill` must not be able to invent a budget.
    let cap = skill_cap(&dossier.skill).unwrap_or(0);
    println!("Supervision run {}", dossier.run_id);
    match partition_values_for(&dossier.skill) {
        // A resuming parent needs the budget it is about to spend from. One run
        // total against a per-partition cap would read as over-budget while
        // every stage still has room — or worse, as room remaining in a stage
        // that has none. Unattributable entries count everywhere, so the
        // displayed totals may exceed the history length; that is the
        // accounting the caps actually use.
        Some(partitions) => {
            let used = partitions
                .iter()
                .map(|p| {
                    let spent = dossier
                        .history
                        .iter()
                        .filter(|h| charges_to_partition(&dossier.skill, h, Some(p)))
                        .count();
                    format!("{p} {spent}/{cap}")
                })
                .collect::<Vec<_>>()
                .join("   ");
            println!(
                "  skill: {}   calls per release stage: {used}   corrections: {}",
                dossier.skill, dossier.correction_count
            );
        }
        None => println!(
            "  skill: {}   calls: {}/{cap}   corrections: {}",
            dossier.skill,
            dossier.history.len(),
            dossier.correction_count
        ),
    }
    let open = dossier
        .checkpoint
        .as_ref()
        .filter(|cp| cp.state == CheckpointState::Pending)
        .map(|cp| cp.checkpoint_id.as_str())
        .unwrap_or("(none)");
    println!(
        "  stage: {}   open checkpoint: {open}",
        stage_wire(dossier.stage)
    );
    println!(
        "  latest directive: {}",
        or_else(&dossier.latest_directive, "(none)")
    );
    // `(none)`, not the dossier body's `(none recorded)`: this is the status
    // line's own wording, and the two artifacts differ here.
    println!(
        "  next safe action: {}",
        or_else(&dossier.next_safe_action, "(none)")
    );
    if !dossier.receipt_pointers.is_empty() {
        println!("  receipts: {}", dossier.receipt_pointers.join(", "));
    }
    println!("  supervision continuity — never verification, never a gate approval.");
    Ok(())
}
