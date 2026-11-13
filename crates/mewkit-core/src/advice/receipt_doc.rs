//! The receipt's on-disk form.
//!
//! [`crate::schema::supervision_receipt`] owns the type, its validation and its
//! path; this owns the bytes. The not-verification sentence is verbatim from the
//! contract and part of the ARTIFACT rather than decoration: a receipt is the
//! most re-readable supervision output, so it is the one most likely to be
//! mistaken for proof at a later gate.

use crate::advice::wire::{disposition_wire, stage_wire};
use crate::schema::supervision_receipt::{Receipt, ReceiptOutcome};

/// Quote always; escape backslashes and quotes — the same conservative YAML
/// scalar the dossier renderer writes.
fn yaml_scalar(value: &str) -> String {
    format!("\"{}\"", value.replace('\\', "\\\\").replace('"', "\\\""))
}

/// Collapse to one line, so a multi-line reason cannot break the frontmatter it
/// is written into.
fn line(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn outcome_wire(outcome: ReceiptOutcome) -> &'static str {
    match outcome {
        ReceiptOutcome::Adopted => "adopted",
        ReceiptOutcome::Rejected => "rejected",
        ReceiptOutcome::Deferred => "deferred",
    }
}

/// Render the receipt.
pub fn render_receipt(receipt: &Receipt) -> String {
    let corrections = if receipt.required_corrections.is_empty() {
        "none".to_string()
    } else {
        receipt
            .required_corrections
            .iter()
            .enumerate()
            .map(|(i, c)| format!("{}. {}", i + 1, line(c)))
            .collect::<Vec<_>>()
            .join("\n")
    };
    let pointers = if receipt.evidence_pointers.is_empty() {
        "none".to_string()
    } else {
        receipt
            .evidence_pointers
            .iter()
            .map(|p| format!("- {p}"))
            .collect::<Vec<_>>()
            .join("\n")
    };
    // An empty `releaseStage` is absent, not blank: the npm CLI tests the field
    // for truthiness, and a blank one there writes no line at all.
    let release_stage = receipt
        .release_stage
        .as_deref()
        .filter(|s| !s.is_empty())
        .map(|s| format!("\nreleaseStage: {}", yaml_scalar(s)))
        .unwrap_or_default();
    let or_else = |value: &str, fallback: &str| {
        let collapsed = line(value);
        if collapsed.is_empty() {
            fallback.to_string()
        } else {
            collapsed
        }
    };

    format!(
        "---
kind: advice-receipt
runId: {run_id}
stage: {stage}
disposition: {disposition}
outcome: {outcome}
reason: {reason}
taskId: {task_id}
provider: {provider}
skill: {skill}
checkpointId: {checkpoint_id}{release_stage}
---

This is a record of supervision, NEVER verification and never a gate approval.

**Question asked:** {question}

**Directive:** {directive}

**Required corrections:**

{corrections}

**Evidence pointers:**

{pointers}

**Next safe action:** {next_safe_action}
",
        run_id = yaml_scalar(&receipt.run_id),
        stage = yaml_scalar(stage_wire(receipt.stage)),
        disposition = yaml_scalar(disposition_wire(receipt.disposition)),
        outcome = yaml_scalar(outcome_wire(receipt.outcome)),
        reason = yaml_scalar(&line(&receipt.reason)),
        task_id = yaml_scalar(&receipt.task_id),
        provider = yaml_scalar(&receipt.provider),
        skill = yaml_scalar(&receipt.skill),
        checkpoint_id = yaml_scalar(&receipt.checkpoint_id),
        question = or_else(&receipt.question, "(not recorded)"),
        directive = or_else(&receipt.directive, "(none)"),
        next_safe_action = or_else(&receipt.next_safe_action, "(none recorded)"),
    )
}

#[cfg(test)]
#[path = "receipt_doc_tests.rs"]
mod tests;
