//! The two transition tokens a human types on the command line.
//!
//! Both are parsed leniently in SHAPE and strictly in VOCABULARY: a missing
//! delimiter is accepted (the whole token becomes the reference), while an
//! unknown decision word is refused by name — a typo'd `skiped` recorded as-is
//! would make an audit of capability use silently wrong.
use crate::schema::quote;
use crate::schema::task_record::{CapabilityDecision, CapabilityDecisionKind, VerificationSummary};

const DECISION_VALUES: [&str; 4] = ["selected", "skipped", "unavailable", "unsupported"];

/// Parse `ref=result` or `ref:result` (delimiter-optional) into a summary.
///
/// The split is on the FIRST `=` or `:`, and neither may appear in the
/// reference — which is what `^([^=:]+)[=:](.*)$` says. A token with no
/// delimiter is a reference with no result, not a refusal: `--verification
/// cargo-test` records that the check was named, and the result can arrive on a
/// later transition.
pub fn parse_verification(raw: &str) -> VerificationSummary {
    let cut = raw
        .find(['=', ':'])
        // `.` in a non-`s` JavaScript regex does not cross a line terminator,
        // so a result that spans lines makes the whole pattern fail and the
        // token falls back to being a bare reference. The reference itself may
        // contain one, because `[^=:]` can.
        .filter(|at| !raw[at + 1..].contains(['\n', '\r', '\u{2028}', '\u{2029}']));
    match cut.filter(|at| *at > 0) {
        Some(at) => VerificationSummary {
            reference: raw[..at].trim().to_string(),
            result: raw[at + 1..].trim().to_string(),
        },
        None => VerificationSummary {
            reference: raw.to_string(),
            result: String::new(),
        },
    }
}

/// Parse `capId|decision|reason|snapshot?`. Refuses an invalid decision token.
pub fn parse_capability_decision(raw: &str) -> Result<CapabilityDecision, String> {
    let fields: Vec<&str> = raw.split('|').map(str::trim).collect();
    let capability_id = fields.first().copied().unwrap_or_default();
    let decision = fields.get(1).copied().unwrap_or_default();
    if capability_id.is_empty() || decision.is_empty() {
        return Err(format!(
            "--capability-decision needs \"capId|decision|reason\": got {}",
            quote(raw)
        ));
    }
    let Some(kind) = kind_of(decision) else {
        return Err(format!(
            "invalid capability decision \"{decision}\" — expected {}",
            DECISION_VALUES.join("|")
        ));
    };
    Ok(CapabilityDecision {
        capability_id: capability_id.to_string(),
        decision: kind,
        reason: fields.get(2).copied().unwrap_or_default().to_string(),
        // An empty snapshot field is no snapshot: the record omits the key
        // rather than storing a reference to nothing.
        adapter_snapshot_id: fields
            .get(3)
            .copied()
            .filter(|s| !s.is_empty())
            .map(str::to_string),
    })
}

fn kind_of(token: &str) -> Option<CapabilityDecisionKind> {
    match token {
        "selected" => Some(CapabilityDecisionKind::Selected),
        "skipped" => Some(CapabilityDecisionKind::Skipped),
        "unavailable" => Some(CapabilityDecisionKind::Unavailable),
        "unsupported" => Some(CapabilityDecisionKind::Unsupported),
        _ => None,
    }
}
