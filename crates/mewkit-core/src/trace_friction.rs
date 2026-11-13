//! Friction grouping, the drift audit and advisory proposals over trace
//! records — the half of `trace-analysis.ts` that reads `data.message`.
use std::cmp::Ordering;
use std::collections::HashMap;

use serde_json::{Map, Value, json};

use super::{
    DAY_MILLIS, VERIFY, WORK, cmp_count_then_message, data_string, event_matches, field,
    is_friction, is_stale, shannon_entropy,
};
use crate::js_regex::{compile, compile_ci, is_js_whitespace};
use crate::js_value::{js_json_number, js_object_order, js_truthy};

static SECRETS: std::sync::LazyLock<[(regex::Regex, &str); 3]> = std::sync::LazyLock::new(|| {
    [
        (
            compile(r"\b(sk|pk|ghp|gho|xox[baprs])[-_][A-Za-z0-9_-]{8,}\b").expect("valid"),
            "[redacted]",
        ),
        (
            compile(r"\b[A-Fa-f0-9]{32,}\b").expect("valid"),
            "[redacted]",
        ),
        (
            compile_ci(r"((?:api[_-]?key|token|secret|password)\s*[=:]\s*)\S+").expect("valid"),
            "${1}[redacted]",
        ),
    ]
});

/// The `trace --friction` CLI's own light redaction of a note, applied before
/// the append primitive scrubs the whole record again (the hooks scrub on
/// their own path).
pub fn redact_friction_note(message: &str) -> String {
    SECRETS
        .iter()
        .fold(message.to_string(), |text, (re, with)| {
            re.replace_all(&text, *with).into_owned()
        })
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FrictionGroup {
    /// The first-seen original text, for display.
    pub message: String,
    pub count: usize,
    pub responsibility: Option<String>,
}

impl FrictionGroup {
    fn to_json(&self) -> Value {
        let mut out = Map::new();
        out.insert("message".into(), self.message.clone().into());
        out.insert("count".into(), self.count.into());
        if let Some(r) = &self.responsibility {
            out.insert("responsibility".into(), r.clone().into());
        }
        Value::Object(out)
    }
}

/// Lowercase, collapse whitespace, strip wrapping quotes and trailing
/// punctuation, so lines identical in meaning group under one key.
pub fn normalize_friction(message: &str) -> String {
    let lower = message.to_lowercase();
    let mut collapsed = String::with_capacity(lower.len());
    let mut in_space = false;
    for c in lower.chars() {
        if is_js_whitespace(c) {
            if !in_space {
                collapsed.push(' ');
            }
            in_space = true;
        } else {
            collapsed.push(c);
            in_space = false;
        }
    }
    let quote = |c: char| matches!(c, '"' | '\'' | '`');
    let unquoted = collapsed.trim_start_matches(quote).trim_end_matches(quote);
    unquoted
        .trim_end_matches(['.', '!', '?', ',', ';', ':'])
        .trim_matches(is_js_whitespace)
        .to_string()
}

/// An approximation of ICU's root-locale `localeCompare` for friction text:
/// case-insensitive first, then lowercase before uppercase. Exotic scripts and
/// punctuation weights can order differently than Node; only display order of
/// equal-count groups depends on it.
pub fn locale_compare(a: &str, b: &str) -> Ordering {
    a.to_lowercase().cmp(&b.to_lowercase()).then_with(|| {
        let tertiary = |s: &str| s.chars().map(|c| c.is_uppercase()).collect::<Vec<_>>();
        tertiary(a).cmp(&tertiary(b))
    })
}

/// Friction records grouped by normalised message: count desc, then message.
pub fn group_friction(records: &[Value]) -> Vec<FrictionGroup> {
    let mut groups: Vec<(String, FrictionGroup)> = Vec::new();
    for record in records.iter().filter(|r| is_friction(r)) {
        let Some(raw) = data_string(record, "message").filter(|m| !m.is_empty()) else {
            continue;
        };
        let key = normalize_friction(&raw);
        match groups.iter_mut().find(|(k, _)| *k == key) {
            Some((_, group)) => group.count += 1,
            None => groups.push((
                key,
                FrictionGroup {
                    message: raw,
                    count: 1,
                    responsibility: data_string(record, "responsibility").filter(|r| !r.is_empty()),
                },
            )),
        }
    }
    let mut out: Vec<FrictionGroup> = groups.into_iter().map(|(_, g)| g).collect();
    out.sort_by(cmp_count_then_message);
    out
}

#[derive(Debug, Clone, PartialEq)]
pub struct Audit {
    pub total: usize,
    pub orphaned: usize,
    pub stale: usize,
    pub unverified_runs: usize,
    pub entropy: f64,
    pub repeated_friction: Vec<FrictionGroup>,
    /// Insertion order; serialised in JavaScript key order.
    pub friction_by_responsibility: Vec<(String, usize)>,
}

impl Audit {
    pub fn to_json(&self) -> Value {
        let by_resp: Map<String, Value> = self
            .friction_by_responsibility
            .iter()
            .map(|(k, v)| (k.clone(), Value::from(*v)))
            .collect();
        json!({
            "total": self.total,
            "orphaned": self.orphaned,
            "stale": self.stale,
            "unverifiedRuns": self.unverified_runs,
            "entropy": js_json_number(self.entropy),
            "repeatedFriction": self.repeated_friction.iter().map(FrictionGroup::to_json).collect::<Vec<_>>(),
            "frictionByResponsibility": Value::Object(js_object_order(by_resp)),
        })
    }
}

/// Entropy and drift: orphaned (no `run_id`), stale (older than `stale_days`
/// before `now_millis`), runs with work but no verification, repeated friction.
pub fn audit_traces(records: &[Value], now_millis: i64, stale_days: i64) -> Audit {
    let cutoff = now_millis - stale_days * DAY_MILLIS;
    let (mut orphaned, mut stale) = (0, 0);
    // Keyed the way a JS `Map` keys `run_id ?? ""`: by value, type-tagged.
    let mut runs: HashMap<String, Vec<&Value>> = HashMap::new();
    let mut by_resp: Vec<(String, usize)> = Vec::new();
    for record in records {
        let run_id = record.get("run_id");
        if !run_id.is_some_and(js_truthy) {
            orphaned += 1;
        }
        if is_stale(record, cutoff) {
            stale += 1;
        }
        if let Some(id) = field(record, "run_id").filter(|v| js_truthy(v)) {
            runs.entry(id.to_string()).or_default().push(record);
        }
        if is_friction(record)
            && let Some(resp) = data_string(record, "responsibility").filter(|r| !r.is_empty())
        {
            match by_resp.iter_mut().find(|(k, _)| *k == resp) {
                Some((_, n)) => *n += 1,
                None => by_resp.push((resp, 1)),
            }
        }
    }
    let unverified_runs = runs
        .values()
        .filter(|list| {
            list.iter().any(|r| event_matches(r, &WORK))
                && !list.iter().any(|r| event_matches(r, &VERIFY))
        })
        .count();
    Audit {
        total: records.len(),
        orphaned,
        stale,
        unverified_runs,
        entropy: shannon_entropy(records),
        repeated_friction: group_friction(records)
            .into_iter()
            .filter(|g| g.count >= 2)
            .collect(),
        friction_by_responsibility: by_resp,
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Proposal {
    pub kind: &'static str,
    pub title: String,
    pub evidence_count: usize,
    pub responsibility: Option<String>,
}

impl Proposal {
    pub fn to_json(&self) -> Value {
        let mut out = Map::new();
        out.insert("kind".into(), self.kind.into());
        out.insert("title".into(), self.title.clone().into());
        out.insert("evidenceCount".into(), self.evidence_count.into());
        if let Some(r) = &self.responsibility {
            out.insert("responsibility".into(), r.clone().into());
        }
        Value::Object(out)
    }
}

/// Advisory backlog items: repeated friction, then each kind of drift found.
pub fn propose_improvements(audit: &Audit) -> Vec<Proposal> {
    let mut items: Vec<Proposal> = audit
        .repeated_friction
        .iter()
        .map(|g| Proposal {
            kind: "friction",
            title: g.message.clone(),
            evidence_count: g.count,
            responsibility: g.responsibility.clone(),
        })
        .collect();
    let drift = [
        (
            audit.unverified_runs,
            "Runs with work but no verification event",
        ),
        (audit.orphaned, "Unattributed trace records (no run_id)"),
        (audit.stale, "Stale trace records"),
    ];
    for (count, title) in drift.into_iter().filter(|(n, _)| *n > 0) {
        items.push(Proposal {
            kind: "drift",
            title: title.to_string(),
            evidence_count: count,
            responsibility: None,
        });
    }
    items
}
