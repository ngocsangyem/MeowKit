//! The three packet schemas' SHAPE refusals, in zod 3's own wording and order.
//!
//! `validate-packet` prints these verbatim and a skill reads them, so a serde
//! error message is not a substitute: it names a different field, in a different
//! order, with different words. The typed models and every CONTENT rule (byte
//! caps, pointer budget, secret and authority scans) stay in
//! [`crate::schema`] — only the shape half is reproduced here, and only because
//! zod's text is part of the contract.
//!
//! zod's order, reproduced below: fields in schema-declaration order, array
//! length before array items, items by index, and a strict object's unrecognised
//! keys LAST, because zod collects them after parsing every known key.

use serde_json::{Map, Value};

use super::zod_issues::{
    Issues, array_of, enum_field, expected, max_length, object_at, string_array, string_field,
    unrecognised_keys,
};
use crate::schema::strategy_brief::FORBIDDEN_BRIEF_FIELDS;
use crate::schema::supervision_output::MAX_REQUIRED_CORRECTIONS;
use crate::schema::supervision_packet::{MAX_EVIDENCE_POINTERS, MAX_POINTER_PATH_LENGTH};

const STAGES: &[&str] = &["GUIDE", "RESCUE", "REVIEW", "RECHECK"];
const CONFIDENCE: &[&str] = &["low", "medium", "high"];
const DISPOSITIONS: &[&str] = &[
    "CONTINUE_WITH_DIRECTIVE",
    "READY_FOR_EXISTING_GATE",
    "RETURN_TO_EXECUTOR",
    "ESCALATE_TO_HUMAN",
    "BLOCKED_MISSING_EVIDENCE",
];

/// Which schema a candidate is checked against.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PacketKind {
    Input,
    Output,
    Brief,
}

impl PacketKind {
    /// The word the refusal and the success line both use.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Input => "input",
            Self::Output => "output",
            Self::Brief => "brief",
        }
    }

    pub fn parse(raw: &str) -> Option<Self> {
        match raw {
            "input" => Some(Self::Input),
            "output" => Some(Self::Output),
            "brief" => Some(Self::Brief),
            _ => None,
        }
    }
}

/// Every shape issue for `candidate`, as `<path>: <message>`.
pub fn shape_issues(kind: PacketKind, candidate: &Map<String, Value>) -> Vec<String> {
    let mut issues = Issues::default();
    match kind {
        PacketKind::Input => input_packet(candidate, &mut issues),
        PacketKind::Output => output_packet(candidate, &mut issues),
        PacketKind::Brief => brief(candidate, &mut issues),
    }
    issues.0
}

/// The forbidden-field findings a brief reports BEFORE its shape is narrowed —
/// "you tried to return a disposition from a stateless consult" is the message
/// that matters, and `.strict()` would only say the key was unrecognised.
pub fn forbidden_brief_fields(candidate: &Map<String, Value>) -> Vec<String> {
    FORBIDDEN_BRIEF_FIELDS
        .iter()
        .filter(|field| candidate.contains_key(**field))
        .map(|field| {
            format!(
                "\"{field}\" belongs to embedded supervision — a direct consult is stateless and routes no workflow"
            )
        })
        .collect()
}

fn input_packet(object: &Map<String, Value>, issues: &mut Issues) {
    let known = [
        "runId",
        "skill",
        "stage",
        "checkpointId",
        "mission",
        "lockedDecisions",
        "currentState",
        "workerSummary",
        "evidenceRefs",
        "priorDirective",
        "question",
        "riskAndReversibility",
    ];
    for key in ["runId", "skill"] {
        string_field(object.get(key), key, true, issues);
    }
    enum_field(object.get("stage"), "stage", STAGES, issues);
    for key in ["checkpointId", "mission"] {
        string_field(object.get(key), key, true, issues);
    }
    string_array(object.get("lockedDecisions"), "lockedDecisions", issues);
    string_field(object.get("currentState"), "currentState", true, issues);
    string_field(object.get("workerSummary"), "workerSummary", false, issues);
    array_of(
        object.get("evidenceRefs"),
        "evidenceRefs",
        Some(MAX_EVIDENCE_POINTERS),
        issues,
        evidence_pointer,
    );
    // `z.string().nullable()`: null is accepted, anything else is a string.
    if let Some(value) = object.get("priorDirective").filter(|v| !v.is_null()) {
        string_field(Some(value), "priorDirective", false, issues);
    }
    for key in ["question", "riskAndReversibility"] {
        string_field(object.get(key), key, true, issues);
    }
    unrecognised_keys(object, &known, issues);
}

fn evidence_pointer(value: &Value, path: &str, issues: &mut Issues) {
    let Some(object) = object_at(value, path, issues) else {
        return;
    };
    match object.get("path") {
        None => issues.push(&format!("{path}.path"), "Required"),
        Some(Value::String(text)) => {
            if text.is_empty() {
                issues.push(
                    &format!("{path}.path"),
                    "String must contain at least 1 character(s)",
                );
            }
            max_length(
                text,
                MAX_POINTER_PATH_LENGTH,
                &format!("{path}.path"),
                issues,
            );
            // `[^\n\r\t\0]+` — a path is a path, not a payload, and an empty
            // one fails the `+` as well as the `min(1)` above.
            if text.contains(['\n', '\r', '\t', '\0']) || text.is_empty() {
                issues.push(&format!("{path}.path"), "must be a single-line path");
            }
        }
        Some(other) => issues.push(&format!("{path}.path"), &expected("string", other)),
    }
    for key in ["relevance", "provenance", "summary"] {
        string_field(object.get(key), &format!("{path}.{key}"), true, issues);
    }
    // No unrecognised-key check: a pointer is a plain `z.object()`, which strips
    // unknown keys. Only the packet around it is strict.
}

fn output_packet(object: &Map<String, Value>, issues: &mut Issues) {
    enum_field(
        object.get("disposition"),
        "disposition",
        DISPOSITIONS,
        issues,
    );
    for key in [
        "strategicAssessment",
        "decisionRecommendation",
        "strategicDirective",
    ] {
        string_field(object.get(key), key, false, issues);
    }
    array_of(
        object.get("requiredCorrections"),
        "requiredCorrections",
        Some(MAX_REQUIRED_CORRECTIONS),
        issues,
        |value, path, issues| {
            let Some(object) = object_at(value, path, issues) else {
                return;
            };
            for key in ["change", "proofRequired"] {
                string_field(object.get(key), &format!("{path}.{key}"), true, issues);
            }
        },
    );
    for key in [
        "nextFalsifiableCheck",
        "risksAndRollback",
        "rejectedAlternatives",
        "assumptions",
    ] {
        string_field(object.get(key), key, false, issues);
    }
    enum_field(object.get("confidence"), "confidence", CONFIDENCE, issues);
    string_array(object.get("evidenceRead"), "evidenceRead", issues);
    // Deliberately no unrecognised-key check: the output schema is a plain
    // `z.object()`, which STRIPS unknown keys rather than refusing them.
}

fn brief(object: &Map<String, Value>, issues: &mut Issues) {
    let known = [
        "situation",
        "decisionRecommendation",
        "rejectedAlternatives",
        "nextFalsifiableCheck",
        "risksAndRollback",
        "escalationPoint",
        "assumptions",
        "confidence",
        "evidenceRead",
    ];
    for (key, non_empty) in [
        ("situation", true),
        ("decisionRecommendation", true),
        ("rejectedAlternatives", false),
        ("nextFalsifiableCheck", true),
        ("risksAndRollback", false),
        ("escalationPoint", true),
        ("assumptions", false),
    ] {
        string_field(object.get(key), key, non_empty, issues);
    }
    enum_field(object.get("confidence"), "confidence", CONFIDENCE, issues);
    string_array(object.get("evidenceRead"), "evidenceRead", issues);
    unrecognised_keys(object, &known, issues);
}

#[cfg(test)]
#[path = "packet_issues_tests.rs"]
mod tests;
