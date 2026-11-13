//! Deterministic intent resolution, and the host-availability check for each
//! candidate.
//!
//! Each query term is credited ONCE at its highest-matching field class
//! (authored intent, inferred intent, alias, description), so a
//! keyword-heavy capability cannot inflate its score. Order is score
//! descending, then id ascending. Selection and invocability are surfaced
//! separately: every candidate keeps its own availability verdict while the
//! top-level `status` is the aggregate outcome.
use std::collections::BTreeSet;

use serde_json::{Value, json};

use super::entry::Entry;
use super::lifecycle::gating_events;
use super::projection::{Acquisition, Projection, get_acquisition, get_projection};

const WEIGHT_AUTHORED_INTENT: usize = 6;
const WEIGHT_INFERRED_INTENT: usize = 3;
const WEIGHT_ALIAS: usize = 2;
const WEIGHT_TEXT: usize = 1;
/// A top-two gap strictly below this is ambiguous.
const AMBIGUITY_EPSILON: usize = 2;

const STOPWORDS: [&str; 15] = [
    "the", "a", "an", "to", "of", "in", "on", "this", "that", "for", "and", "or", "my", "me", "it",
];

/// Lowercase terms: punctuation split, stopwords and one-character terms dropped.
fn terms(text: &str) -> BTreeSet<String> {
    text.to_lowercase()
        .split(|c: char| !(c.is_ascii_lowercase() || c.is_ascii_digit()))
        .filter(|t| t.chars().count() > 1 && !STOPWORDS.contains(t))
        .map(String::from)
        .collect()
}

fn field_terms<'a>(strings: impl IntoIterator<Item = &'a str>) -> BTreeSet<String> {
    strings.into_iter().flat_map(terms).collect()
}

pub struct Candidate {
    pub id: String,
    pub kind: String,
    pub score: usize,
    pub reason: String,
    pub support: Value,
    pub requirements: Vec<Value>,
    pub context_requirement: Value,
    pub verification: Value,
    pub context_reason: Option<String>,
    pub verification_kind: String,
    pub availability: Vec<Snapshot>,
    pub invocable: &'static str,
}

/// One requirement's availability, with the evidence that decided it.
pub struct Snapshot {
    pub requirement_type: String,
    pub id: String,
    pub status: &'static str,
    pub evidence: String,
}

/// Injected probes: real ones in the CLI, deterministic fakes in tests.
pub trait Probes {
    fn command_exists(&self, cmd: &str) -> bool;
    fn is_self(&self, binary: &str) -> bool;
    /// `None` when the id is not a checkable path.
    fn contained_file_exists(&self, id: &str) -> Option<bool>;
    /// `None` when there is no MCP config on disk to consult.
    fn mcp_server_configured(&self, id: &str) -> Option<bool>;
}

fn snapshot_for(req: &super::entry::Requirement, probes: &dyn Probes) -> Snapshot {
    let id = req.id.clone();
    let make = |status, evidence: String| Snapshot {
        requirement_type: req.kind.clone(),
        id: id.clone(),
        status,
        evidence,
    };
    match req.kind.as_str() {
        "external_binary" => {
            if probes.command_exists(&id) {
                make("available", format!("PATH lookup for \"{id}\": found"))
            } else if probes.is_self(&id) {
                make("available", format!("provided by the current CLI process (not on PATH): \"{id}\""))
            } else {
                make("unavailable", format!("PATH lookup for \"{id}\": not found"))
            }
        }
        "skill_script" | "file_or_config" => match probes.contained_file_exists(&id) {
            None => make("unknown", format!("\"{id}\" is a logical id with no path mapping — availability undetermined (not executed)")),
            Some(ok) => make(
                if ok { "available" } else { "unavailable" },
                format!("contained path \"{id}\": {} (not executed)", if ok { "present" } else { "absent" }),
            ),
        },
        "mcp_or_app" => match probes.mcp_server_configured(&id) {
            None => make("unknown", format!("no MCP config on disk to confirm \"{id}\"")),
            Some(c) => make(
                if c { "available" } else { "unavailable" },
                format!("MCP config {} \"{id}\"", if c { "declares" } else { "omits" }),
            ),
        },
        "host_tool" => make("unknown", "host does not expose a queryable tool contract to the CLI (never inferred from PATH)".into()),
        "subagent_surface" => make("unknown", "subagent availability is a provider-contract fact, undeclared until a provider manifest asserts it".into()),
        _ => make("unknown", "lifecycle enforcement mapping is deferred to Phase 6".into()),
    }
}

/// One verdict for the capability: any unavailable requirement blocks it, all
/// available proves it, anything else (including no requirements) is unknown.
fn roll_up(snapshots: &[Snapshot]) -> &'static str {
    if snapshots.iter().any(|s| s.status == "unavailable") {
        "unavailable"
    } else if !snapshots.is_empty() && snapshots.iter().all(|s| s.status == "available") {
        "available"
    } else {
        "unknown"
    }
}

pub struct Resolution {
    pub intent: String,
    pub provider: String,
    pub ambiguous: bool,
    pub status: &'static str,
    pub candidates: Vec<Candidate>,
    pub acquisition: Acquisition,
    pub projection: Projection,
    pub gating_events: Vec<&'static str>,
}

pub fn resolve_with_host(
    entries: &[Entry],
    intent: &str,
    provider: &str,
    probes: &dyn Probes,
) -> Resolution {
    let query = terms(intent);
    let mut scored: Vec<(&Entry, usize, String)> = entries
        .iter()
        .filter_map(|e| {
            let intent_set = field_terms(e.intents.iter().map(String::as_str));
            let alias_set = field_terms(e.aliases.iter().map(String::as_str));
            let text_set = field_terms([
                e.when_to_use.as_deref().unwrap_or(""),
                e.description.as_str(),
            ]);
            let authored = e.authored_intents();
            let weight = if authored {
                WEIGHT_AUTHORED_INTENT
            } else {
                WEIGHT_INFERRED_INTENT
            };
            let (mut i, mut a, mut t) = (0, 0, 0);
            for q in &query {
                if intent_set.contains(q) {
                    i += 1;
                } else if alias_set.contains(q) {
                    a += 1;
                } else if text_set.contains(q) {
                    t += 1;
                }
            }
            let score = i * weight + a * WEIGHT_ALIAS + t * WEIGHT_TEXT;
            if score == 0 {
                return None;
            }
            let mut parts = Vec::new();
            if i > 0 {
                parts.push(format!(
                    "{i} {}intent term(s)",
                    if authored { "authored " } else { "" }
                ));
            }
            if a > 0 {
                parts.push(format!("{a} alias term(s)"));
            }
            if t > 0 {
                parts.push(format!("{t} description term(s)"));
            }
            Some((e, score, format!("matched {}", parts.join(", "))))
        })
        .collect();
    scored.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| a.0.id.cmp(&b.0.id)));

    let ambiguous =
        scored.is_empty() || (scored.len() >= 2 && scored[0].1 - scored[1].1 < AMBIGUITY_EPSILON);
    let candidates: Vec<Candidate> = scored
        .into_iter()
        .map(|(e, score, reason)| {
            let availability: Vec<Snapshot> = e
                .requirements
                .iter()
                .map(|r| snapshot_for(r, probes))
                .collect();
            Candidate {
                id: e.id.clone(),
                kind: e.kind.clone(),
                score,
                reason,
                support: e.support.get(provider).cloned().unwrap_or(Value::Null),
                requirements: e.requirements.iter().map(|r| r.to_json()).collect(),
                context_requirement: e.context_requirement_json(),
                verification: e.verification_json(),
                context_reason: e.context_requirement.clone(),
                verification_kind: e.verification_kind.clone(),
                invocable: roll_up(&availability),
                availability,
            }
        })
        .collect();

    let status = match candidates.first() {
        None => "unavailable",
        Some(_) if ambiguous => "ambiguous",
        Some(top) if top.support.get("discoverable") == Some(&Value::Bool(false)) => "unsupported",
        Some(top) if top.invocable == "unavailable" => "unavailable",
        Some(_) => "selected",
    };
    Resolution {
        intent: intent.to_string(),
        provider: provider.to_string(),
        ambiguous,
        status,
        candidates,
        acquisition: get_acquisition(provider),
        projection: get_projection(provider),
        gating_events: gating_events(provider),
    }
}

impl Resolution {
    pub fn to_json(&self, checked_at: &str) -> Value {
        let candidates: Vec<Value> = self
            .candidates
            .iter()
            .map(|c| {
                let availability: Vec<Value> = c
                    .availability
                    .iter()
                    .map(|s| {
                        json!({
                            "requirementType": s.requirement_type,
                            "id": s.id,
                            "checkedAt": checked_at,
                            "provider": self.provider,
                            "status": s.status,
                            "evidence": s.evidence,
                        })
                    })
                    .collect();
                json!({
                    "id": c.id,
                    "kind": c.kind,
                    "score": c.score,
                    "reason": c.reason,
                    "support": c.support,
                    "requirements": c.requirements,
                    "contextRequirement": c.context_requirement,
                    "verification": c.verification,
                    "invocable": c.invocable,
                    "availability": availability,
                })
            })
            .collect();
        json!({
            "intent": self.intent,
            "provider": self.provider,
            "ambiguous": self.ambiguous,
            "status": self.status,
            "candidates": candidates,
            "acquisition": self.acquisition.to_json(),
            "adapterCitation": {
                "provider": self.provider,
                "projectionStatus": self.projection.status,
                "projectionEvidence": self.projection.evidence,
                "gatingEvents": self.gating_events,
            },
        })
    }
}
