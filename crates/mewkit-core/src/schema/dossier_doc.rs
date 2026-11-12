//! The dossier's on-disk form: frontmatter plus a short active summary.
//!
//! The render is part of the CONTRACT, not presentation — the 2 KiB cap is
//! measured against these exact bytes, and the explicit not-verification line is
//! part of the artifact so a later reader cannot mistake a directive for proof.
//!
//! Its reader lives in [`super::dossier_parse`]; the round trip between the two
//! is what this module's contract rests on.

use super::dossier::Dossier;
use super::quote;
use super::supervision_protocol::is_valid_run_id;

/// YAML-escape a scalar conservatively: quote always, escape quotes and
/// backslashes — the same two replacements `yamlScalar` makes in
/// `core/athena-supervision-dossier.ts`.
///
/// For a value with no control characters the result is also valid JSON, which
/// is what lets the reader undo it with a JSON parse. It is NOT a total inverse:
/// a raw newline or tab in a field is left unescaped, so it produces a document
/// that reads back as CORRUPT rather than round-tripping. That is the TypeScript
/// behaviour too, and a corrupt read is the fail-closed outcome — but it is a
/// reason not to treat this as a general-purpose escaper.
pub(super) fn yaml_scalar(value: &str) -> String {
    format!("\"{}\"", value.replace('\\', "\\\\").replace('"', "\\\""))
}

fn yaml_list(items: &[String]) -> String {
    if items.is_empty() {
        "[]".to_string()
    } else {
        format!(
            "[{}]",
            items
                .iter()
                .map(|i| yaml_scalar(i))
                .collect::<Vec<_>>()
                .join(", ")
        )
    }
}

/// Collapse to one line. The directive and next action round-trip through
/// single-line body markers, so an embedded newline would truncate on read — and
/// a silently truncated directive is worse than a reformatted one.
fn single_line(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// `tasks/reports/{runId}-athena-supervision.md` — deterministic so a fresh
/// parent can find the run without an index. Only an EMBEDDED run has an id, so
/// this path cannot exist for a direct consult: that is the structural reason a
/// stateless brief leaves no dossier behind.
pub fn dossier_path(
    project_root: &std::path::Path,
    run_id: &str,
) -> Result<std::path::PathBuf, String> {
    if !is_valid_run_id(run_id) {
        return Err(format!("invalid supervision run id: {}", quote(run_id)));
    }
    Ok(project_root
        .join("tasks")
        .join("reports")
        .join(format!("{run_id}-athena-supervision.md")))
}

/// Render the active portion of a dossier.
///
/// `history` is emitted as inline JSON: JSON is valid YAML, so the frontmatter
/// stays well-formed for any reader, and this module can parse its own output
/// exactly without taking on a YAML dependency.
pub fn render_dossier(dossier: &Dossier) -> String {
    let checkpoint = match &dossier.checkpoint {
        Some(cp) => {
            let partition = cp
                .partition
                .as_deref()
                .map(|p| format!(", partition: {}", yaml_scalar(p)))
                .unwrap_or_default();
            format!(
                "{{ checkpointId: {}, stage: {}, state: {}{partition} }}",
                yaml_scalar(&cp.checkpoint_id),
                yaml_scalar(stage_wire(cp.stage)),
                yaml_scalar(state_wire(cp.state)),
            )
        }
        None => "null".to_string(),
    };
    let history = serde_json::to_string(&dossier.history).unwrap_or_else(|_| "[]".into());
    let directive = single_line(&dossier.latest_directive);
    let next_action = single_line(&dossier.next_safe_action);

    format!(
        "---
kind: athena-supervision-dossier
runId: {run_id}
skill: {skill}
stage: {stage}
lockedDecisionPointers: {pointers}
correctionCount: {corrections}
receiptPointers: {receipts}
checkpoint: {checkpoint}
history: {history}
escalatedToHuman: {escalated}
---

# Supervision run {raw_run_id}

This is supervision continuity, NEVER verification and never a gate approval.

**Latest directive:** {directive_line}
**Next safe action:** {next_action_line}
",
        run_id = yaml_scalar(&dossier.run_id),
        skill = yaml_scalar(&dossier.skill),
        stage = yaml_scalar(stage_wire(dossier.stage)),
        pointers = yaml_list(&dossier.locked_decision_pointers),
        corrections = dossier.correction_count,
        receipts = yaml_list(&dossier.receipt_pointers),
        escalated = dossier.escalated_to_human,
        raw_run_id = dossier.run_id,
        directive_line = if directive.is_empty() {
            "(none yet)".to_string()
        } else {
            directive
        },
        next_action_line = if next_action.is_empty() {
            "(none recorded)".to_string()
        } else {
            next_action
        },
    )
}

pub(super) fn stage_wire(stage: super::supervision_protocol::SupervisionStage) -> &'static str {
    use super::supervision_protocol::SupervisionStage::*;
    match stage {
        Guide => "GUIDE",
        Rescue => "RESCUE",
        Review => "REVIEW",
        Recheck => "RECHECK",
    }
}

fn state_wire(state: super::dossier::CheckpointState) -> &'static str {
    match state {
        super::dossier::CheckpointState::Pending => "pending",
        super::dossier::CheckpointState::Committed => "committed",
    }
}

#[cfg(test)]
#[path = "dossier_doc_tests.rs"]
mod tests;
