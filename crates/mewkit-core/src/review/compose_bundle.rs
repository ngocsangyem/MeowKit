//! The artifacts `compose` leaves behind: the Gate 2 proof bundle, the review
//! body, and the inline anchors pinned into it.
//!
//! Separated from the stage that DECIDES because these are a rendering
//! contract: every byte here is compared against the npm CLI's output and read
//! by the Gate 2 coverage validator, so a change to a key name or a field
//! order is a change to an interface, not to formatting.
use serde_json::{Map, Value, json};

use super::anchors::resolve_anchor;
use super::coverage::CoverageReport;
use super::session::str_field;
use super::verdict::ComputedVerdict;
use crate::fsx::sha256_hex;
use crate::schema::review_session::EvidenceLevel;

/// The key order a schema-validated finding carries: the declared fields
/// first, then whatever else the finding brought with it.
///
/// The npm CLI writes the object its validator RETURNED, and that validator
/// emits its own field order before the passed-through extras. The bundle is
/// compared byte for byte, so the order is part of the contract rather than a
/// formatting detail.
const FINDING_FIELDS: [&str; 5] = [
    "location",
    "failureScenario",
    "severity",
    "confidence",
    "suggestedDirection",
];

fn validated_order(finding: &Value) -> Map<String, Value> {
    let Some(source) = finding.as_object() else {
        return Map::new();
    };
    let mut out = Map::new();
    for key in FINDING_FIELDS {
        if let Some(value) = source.get(key) {
            out.insert(key.to_string(), value.clone());
        }
    }
    for (key, value) in source {
        if !FINDING_FIELDS.contains(&key.as_str()) {
            out.insert(key.clone(), value.clone());
        }
    }
    out
}

/// Pin each finding that quoted a snippet, keeping the finding's own fields.
/// An unresolved anchor is RECORDED as unresolved and the finding stays in the
/// body, rather than being pinned to a line nobody wrote.
fn inline_findings(findings: &[Value], diff_text: &str) -> Vec<Value> {
    findings
        .iter()
        .filter(|f| f.get("snippet").and_then(Value::as_str).is_some())
        .map(|f| {
            let file = str_field(f, "location")
                .split(':')
                .next()
                .unwrap_or_default()
                .to_string();
            let snippet = str_field(f, "snippet").to_string();
            let mut out = validated_order(f);
            match resolve_anchor(diff_text, &file, &snippet) {
                Ok(anchor) => out.insert(
                    "anchor".into(),
                    json!({ "file": anchor.file, "line": anchor.line, "snippet": anchor.snippet }),
                ),
                Err(miss) => out.insert("anchorUnresolved".into(), json!(miss.as_str())),
            };
            Value::Object(out)
        })
        .collect()
}

pub fn evidence_level_text(level: EvidenceLevel) -> &'static str {
    match level {
        EvidenceLevel::SessionObserved => "session-observed",
        EvidenceLevel::Attested => "attested",
    }
}

/// The one-line review body: the decision, and every cap that held it there.
pub fn body_line(verdict: &ComputedVerdict) -> String {
    if verdict.reasons.is_empty() {
        verdict.decision.as_str().to_string()
    } else {
        format!(
            "{} — {}",
            verdict.decision.as_str(),
            verdict.reasons.join("; ")
        )
    }
}

/// The Gate 2 proof bundle. It embeds the coverage report AND a hash of it, so
/// a later edit of the embedded report is detectable — evidence a human reads
/// at the gate, never an approval.
pub fn proof_bundle(
    session: &str,
    manifest: &Value,
    report: &CoverageReport,
    verdict: &ComputedVerdict,
    findings: &[Value],
    diff_text: &str,
) -> Value {
    let note = verdict.reasons.join("; ");
    let mut dimension = Map::new();
    dimension.insert("name".into(), json!("Review"));
    dimension.insert(
        "verdict".into(),
        json!(verdict.decision.dimension_verdict()),
    );
    if !note.is_empty() {
        dimension.insert("note".into(), json!(note));
    }
    let coverage_json = serde_json::to_string(report).unwrap_or_default();
    json!({
        "schema_version": "1.0.0",
        "slug": session,
        "gate": "review",
        "decision": verdict.decision.as_str(),
        "dimensions": [Value::Object(dimension)],
        "evidence_refs": [
            format!("tasks/reviews/{session}/impact-map.json"),
            format!("tasks/reviews/{session}/evidence.jsonl"),
        ],
        // A valid manifest always carries one; the fallback keeps a bundle
        // timestamped rather than null if an older one does not.
        "created_at": manifest
            .get("createdAt")
            .cloned()
            .unwrap_or_else(|| json!(crate::time_utc::iso_seconds(crate::time_utc::now_millis()))),
        "review_session": session,
        "coverage": {
            "report": report,
            "sha256": sha256_hex(coverage_json.as_bytes()),
        },
        "findings": inline_findings(findings, diff_text),
    })
}
