//! The route contract, for the one route this CLI can take.
//!
//! The supervisor is reachable two ways and they are DIFFERENT capabilities: a
//! stateless strategy consult (no run id, no dossier, no receipt, no cap) and an
//! embedded checkpoint inside a supervised run. The failure worth preventing is
//! the two impersonating each other — a consult recorded as supervision puts a
//! directive in the audit trail that no run ever governed, and an "embedded"
//! call with no run id is supervision with nothing to resume from and no cap to
//! bound it. Both are refused rather than coerced into a working shape.
//!
//! Only the EMBEDDED half is here: `advice begin` is the single call site, and
//! it always claims `embedded`. The direct half is structurally unreachable from
//! a CLI — a consult has no run id, so it can build no dossier path and write no
//! artifact — so a Rust copy of its predicate would have no caller.

use crate::schema::supervision_protocol::{SupervisionStage, is_valid_run_id};

use super::wire::stage_from_wire;

/// The triple an embedded call must carry, already validated.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct EmbeddedCall {
    pub stage: SupervisionStage,
}

/// Decide whether a call claiming embedded supervision may run as one.
///
/// The triple (run id, stage, checkpoint id) is what makes a call resumable,
/// idempotent and capped, so a call missing any of it is refused rather than
/// downgraded to a stateless consult.
pub fn classify_embedded_call(
    run_id: &str,
    stage: Option<&str>,
    checkpoint_id: &str,
) -> Result<EmbeddedCall, String> {
    if !is_valid_run_id(run_id) {
        return Err(
            "embedded supervision requires a valid supervisionRunId — a direct consult cannot become supervision"
                .to_string(),
        );
    }
    // Validated against the stage vocabulary, not merely present: an unknown
    // stage would classify as valid here and then index a cadence table with a
    // key it does not have.
    let Some(stage) = stage.and_then(stage_from_wire) else {
        return Err(format!(
            "embedded supervision requires a known stage, got {}",
            quote_or_undefined(stage)
        ));
    };
    if checkpoint_id.trim().is_empty() {
        return Err("embedded supervision requires a non-blank checkpointId".to_string());
    }
    Ok(EmbeddedCall { stage })
}

/// `JSON.stringify(value)` of a possibly-absent string, which renders an absent
/// one as the bare word `undefined` inside a template literal.
fn quote_or_undefined(value: Option<&str>) -> String {
    match value {
        Some(text) => crate::schema::quote(text),
        None => "undefined".to_string(),
    }
}

#[cfg(test)]
#[path = "mode_tests.rs"]
mod tests;
