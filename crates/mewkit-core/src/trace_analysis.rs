//! Pure analysis over the append trace log, ported from the npm CLI's
//! `core/trace-analysis.ts`: quality tier per lane, entropy and drift audit,
//! advisory proposals. No filesystem and no clock (the caller passes `now`).
//! Everything here REPORTS; nothing gates.
//!
//! Records stay `serde_json::Value` because the log is best-effort and the
//! TypeScript reads its fields loosely: an `event` that is a number still
//! counts as a type and is still tested against the verify pattern as its
//! `String(...)`. One deliberate simplification: a `run_id` that is not a
//! string (the TS would key a lane by an array's identity) joins the
//! `(unattributed)` lane.
use std::cmp::Ordering;
use std::collections::{BTreeMap, HashSet};
use std::sync::LazyLock;

use regex::Regex;
use serde_json::{Map, Value, json};

use crate::js_regex::{compile_ci, is_js_whitespace};
use crate::js_value::{js_date_parse_millis, js_object_order, js_string, js_truthy};

static VERIFY: LazyLock<Regex> =
    LazyLock::new(|| compile_ci("verif|test|review|evaluat|pass|lint|typecheck").expect("valid"));
static WORK: LazyLock<Regex> =
    LazyLock::new(|| compile_ci("edit|build|implement|write|generat|fix|refactor").expect("valid"));

const UNATTRIBUTED: &str = "(unattributed)";
const DAY_MILLIS: i64 = 24 * 60 * 60 * 1000;

/// JSONL → records. Blank and malformed lines are skipped (an append-only log
/// can end in a half-written line); any JSON object or array is a record.
pub fn parse_trace_log(content: &str) -> Vec<Value> {
    content
        .split('\n')
        .map(|line| line.trim_matches(is_js_whitespace))
        .filter(|line| !line.is_empty())
        .filter_map(|line| serde_json::from_str::<Value>(line).ok())
        .filter(|v| v.is_object() || v.is_array())
        .collect()
}

/// `record.key`, with `null` read as absent (the TS reaches fields through `??`).
fn field<'a>(record: &'a Value, key: &str) -> Option<&'a Value> {
    record.get(key).filter(|v| !v.is_null())
}

/// The identity a `Set`/`Map` would key `event ?? "unknown"` by: strings and
/// numbers by value (kept apart by type), objects by reference (`index`).
fn event_key(record: &Value, index: usize) -> String {
    match field(record, "event") {
        None => "s:unknown".into(),
        Some(Value::String(s)) => format!("s:{s}"),
        Some(v @ (Value::Array(_) | Value::Object(_))) => format!("o{index}:{v}"),
        Some(v) => format!("p:{v}"),
    }
}

fn event_matches(record: &Value, pattern: &Regex) -> bool {
    pattern.is_match(&field(record, "event").map(js_string).unwrap_or_default())
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Score {
    pub tier: &'static str,
    pub events: usize,
    pub types: usize,
    pub has_verification: bool,
}

impl Score {
    pub fn to_json(&self) -> Map<String, Value> {
        let value = json!({ "tier": self.tier, "events": self.events,
            "types": self.types, "hasVerification": self.has_verification });
        value.as_object().cloned().unwrap_or_default()
    }
}

/// Richer, more diverse and verified records score a higher tier.
pub fn score_tier(records: &[&Value]) -> Score {
    let events = records.len();
    let types = records
        .iter()
        .enumerate()
        .map(|(i, r)| event_key(r, i))
        .collect::<HashSet<_>>()
        .len();
    let tier = if events >= 10 && types >= 4 {
        "detailed"
    } else if events >= 3 && types >= 2 {
        "standard"
    } else {
        "minimal"
    };
    Score {
        tier,
        events,
        types,
        has_verification: records.iter().any(|r| event_matches(r, &VERIFY)),
    }
}

/// Records grouped by `run_id` (a lane), in first-seen order, each scored.
pub fn score_by_run(records: &[Value]) -> Vec<(String, Score)> {
    let mut lanes: Vec<(String, Vec<&Value>)> = Vec::new();
    for record in records {
        let id = match field(record, "run_id") {
            Some(Value::String(s)) if !s.is_empty() => s.clone(),
            _ => UNATTRIBUTED.to_string(),
        };
        match lanes.iter_mut().find(|(lane, _)| *lane == id) {
            Some((_, list)) => list.push(record),
            None => lanes.push((id, vec![record])),
        }
    }
    lanes
        .into_iter()
        .map(|(id, list)| (id, score_tier(&list)))
        .collect()
}

/// `scoreByRun` as `Object.fromEntries` would serialise it.
pub fn score_by_run_json(lanes: &[(String, Score)]) -> Value {
    let map: Map<String, Value> = lanes
        .iter()
        .map(|(id, s)| (id.clone(), Value::Object(s.to_json())))
        .collect();
    Value::Object(js_object_order(map))
}

/// Shannon entropy in bits over event types, rounded to 3 places.
pub fn shannon_entropy(records: &[Value]) -> f64 {
    if records.is_empty() {
        return 0.0;
    }
    let mut counts: BTreeMap<String, usize> = BTreeMap::new();
    for (i, r) in records.iter().enumerate() {
        *counts.entry(event_key(r, i)).or_default() += 1;
    }
    let n = records.len() as f64;
    let h: f64 = counts
        .values()
        .map(|&c| c as f64 / n)
        .map(|p| -p * p.log2())
        .sum();
    // `Math.round` rounds half up, which `f64::round` does not for negatives;
    // entropy is never negative, so floor(x + 0.5) is the same function here.
    (h * 1000.0 + 0.5).floor() / 1000.0
}

#[path = "trace_friction.rs"]
mod friction;
pub use friction::{
    Audit, FrictionGroup, Proposal, audit_traces, group_friction, locale_compare,
    normalize_friction, propose_improvements, redact_friction_note,
};

#[cfg(test)]
#[path = "trace_analysis_tests.rs"]
mod tests;

// Shared with the friction module.
fn is_friction(record: &Value) -> bool {
    field(record, "event").and_then(Value::as_str) == Some("friction")
}

fn data_string(record: &Value, key: &str) -> Option<String> {
    match record.get("data")?.get(key)? {
        Value::String(s) => Some(s.clone()),
        _ => None,
    }
}

fn is_stale(record: &Value, cutoff: i64) -> bool {
    let Some(ts) = record.get("ts").filter(|v| js_truthy(v)) else {
        return false;
    };
    js_date_parse_millis(&js_string(ts)).is_some_and(|t| t < cutoff)
}

fn cmp_count_then_message(a: &FrictionGroup, b: &FrictionGroup) -> Ordering {
    b.count
        .cmp(&a.count)
        .then_with(|| locale_compare(&a.message, &b.message))
}
