//! Reading a rendered dossier back.
//!
//! Deliberately narrow: it reads only the keys [`super::dossier_doc`] writes
//! rather than accepting arbitrary YAML. A general parser would be a larger
//! surface for a file whose only writer is this crate, and the round-trip test
//! is the contract.
//!
//! It FAILS CLOSED. A record that cannot be parsed is reported CORRUPT, never as
//! an absent run — treating a damaged dossier as "no history" would reset every
//! cap and hand the run an unbounded supervision budget.

use std::sync::LazyLock;

use regex::Regex;
use serde_json::{Value, json};

use super::dossier::Dossier;
use crate::js_number::js_number;

/// Reading a dossier back. A corrupt record is a REFUSAL, never an empty run.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DossierRead {
    Found(Box<Dossier>),
    Absent,
    Corrupt(String),
}

static FRONTMATTER_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?s)^---\n(.*?)\n---\n").expect("static frontmatter pattern"));

/// Pull one frontmatter scalar line's raw value (everything after the first colon).
fn frontmatter_value<'a>(frontmatter: &'a str, key: &str) -> Option<&'a str> {
    frontmatter
        .lines()
        .find(|l| l.starts_with(&format!("{key}:")))
        .map(|l| l[key.len() + 1..].trim())
}

/// Undo [`super::dossier_doc::yaml_scalar`]: the scalar it writes is valid JSON
/// whenever the value holds no control character, so a JSON parse reads it back.
/// A value that carried one reads as `None` here and the record is CORRUPT.
fn unquote(raw: Option<&str>) -> Option<String> {
    let raw = raw?;
    if !raw.starts_with('"') {
        return Some(raw.to_string());
    }
    match serde_json::from_str::<Value>(raw) {
        Ok(Value::String(s)) => Some(s),
        _ => None,
    }
}

fn body_field(body: &str, label: &str) -> String {
    let marker = format!("**{label}:** ");
    let line = body
        .lines()
        .find(|l| l.starts_with(&marker))
        .map(|l| &l[marker.len()..])
        .unwrap_or("");
    if line == "(none yet)" || line == "(none recorded)" {
        String::new()
    } else {
        line.to_string()
    }
}

/// Parse a dossier this module rendered.
pub fn parse_dossier(text: &str) -> DossierRead {
    let Some(matched) = FRONTMATTER_RE.captures(text) else {
        return DossierRead::Corrupt("no frontmatter block".to_string());
    };
    let frontmatter = matched.get(1).expect("capture group 1").as_str();
    let body = &text[matched.get(0).expect("whole match").end()..];

    let history = match frontmatter_value(frontmatter, "history") {
        None | Some("") => json!([]),
        Some(raw) => match serde_json::from_str::<Value>(raw) {
            Ok(v) => v,
            Err(_) => return DossierRead::Corrupt("history is not valid JSON".to_string()),
        },
    };

    let checkpoint = match frontmatter_value(frontmatter, "checkpoint") {
        None | Some("") | Some("null") => Value::Null,
        Some(raw) => {
            // `{ key: "value", … }` — the inline form the renderer emits. Read
            // the known keys only.
            let read = |key: &str| -> Option<String> {
                let re = Regex::new(&format!(r#"{key}:\s*("(?:[^"\\]|\\.)*")"#)).ok()?;
                unquote(re.captures(raw)?.get(1).map(|m| m.as_str()))
            };
            let mut marker = serde_json::Map::new();
            for key in ["checkpointId", "stage", "state"] {
                match read(key) {
                    Some(value) => {
                        marker.insert(key.to_string(), Value::String(value));
                    }
                    // A marker missing a known key is corrupt, not absent: the
                    // schema refuses it below rather than reading it as "no
                    // open checkpoint".
                    None => {
                        marker.insert(key.to_string(), Value::Null);
                    }
                }
            }
            // Omit the key entirely when absent: an explicitly-present-yet-empty
            // key reads as "this run has no budget partition" rather than "this
            // render had none".
            if let Some(partition) = read("partition") {
                marker.insert("partition".to_string(), Value::String(partition));
            }
            Value::Object(marker)
        }
    };

    let mut pointers = json!([]);
    let mut receipts = json!([]);
    for (key, slot) in [
        ("lockedDecisionPointers", &mut pointers),
        ("receiptPointers", &mut receipts),
    ] {
        if let Some(raw) = frontmatter_value(frontmatter, key).filter(|r| !r.is_empty()) {
            match serde_json::from_str::<Value>(raw) {
                Ok(v) => *slot = v,
                Err(_) => {
                    return DossierRead::Corrupt("pointer list is not valid JSON".to_string());
                }
            }
        }
    }

    // `Number(raw)` then the schema, the same two steps the TypeScript takes.
    // `"abc"`, `"-3"` and `"1.5"` must all read as CORRUPT: a reader that
    // substituted 0 would reset the counter every supervision cap keys off, and
    // a damaged dossier would hand the run an unbounded budget.
    let correction_count = match frontmatter_value(frontmatter, "correctionCount") {
        None => json!(0),
        Some(raw) => match js_number(raw) {
            Some(number) => Value::Number(number),
            None => {
                return DossierRead::Corrupt("correctionCount is not a number".to_string());
            }
        },
    };

    let candidate = json!({
        "runId": unquote(frontmatter_value(frontmatter, "runId")),
        "skill": unquote(frontmatter_value(frontmatter, "skill")),
        "stage": unquote(frontmatter_value(frontmatter, "stage")),
        "lockedDecisionPointers": pointers,
        "latestDirective": body_field(body, "Latest directive"),
        "correctionCount": correction_count,
        "receiptPointers": receipts,
        "nextSafeAction": body_field(body, "Next safe action"),
        "checkpoint": checkpoint,
        "history": history,
        "escalatedToHuman": frontmatter_value(frontmatter, "escalatedToHuman") == Some("true"),
    });

    match serde_json::from_value::<Dossier>(candidate) {
        Ok(dossier) => DossierRead::Found(Box::new(dossier)),
        Err(e) => DossierRead::Corrupt(e.to_string()),
    }
}

#[cfg(test)]
#[path = "dossier_parse_tests.rs"]
mod tests;
