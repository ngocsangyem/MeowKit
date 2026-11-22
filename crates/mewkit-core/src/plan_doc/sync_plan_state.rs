//! `.plan-state.json` as `plan sync` rewrites it: the per-phase status and
//! task counts follow the checkboxes, every other key and the file's own
//! indent, line ending and final newline stay as they were.
//!
//! A checkpoint that is absent, malformed or has no `phases` object is left
//! alone: the markdown is the authority, the JSON a cache.
use std::path::Path;

use serde::Serialize;
use serde_json::ser::{PrettyFormatter, Serializer};
use serde_json::{Map, Value};

use super::sync::SyncChange;

pub(super) const FILE: &str = ".plan-state.json";

pub(super) struct PlanState {
    raw: String,
    data: Map<String, Value>,
}

/// A JSON value as a change line shows it: a string bare, anything else as
/// JSON, an absent key as `(none)`.
fn shown(value: Option<&Value>) -> String {
    match value {
        None => "(none)".to_string(),
        Some(Value::String(s)) => s.clone(),
        Some(other) => other.to_string(),
    }
}

impl PlanState {
    pub fn load(path: &Path) -> Option<Self> {
        let raw = std::fs::read_to_string(path).ok()?;
        let data = serde_json::from_str::<Map<String, Value>>(&raw).ok()?;
        data.get("phases")?.as_object()?;
        Some(Self { raw, data })
    }

    /// Bring `phases[key]` in line: the task counts always, the status only
    /// when one is given (a human-set phase passes none). A phase with no
    /// record is not invented.
    pub fn update(
        &mut self,
        key: &str,
        (checked, total): (usize, usize),
        status: Option<&str>,
        changes: &mut Vec<SyncChange>,
    ) {
        let Some(record) = self
            .data
            .get_mut("phases")
            .and_then(Value::as_object_mut)
            .and_then(|phases| phases.get_mut(key))
            .and_then(Value::as_object_mut)
        else {
            return;
        };
        let mut wanted = vec![
            ("tasks_completed", Value::from(checked)),
            ("tasks_total", Value::from(total)),
        ];
        if let Some(status) = status {
            wanted.push(("status", Value::from(status)));
        }
        for (field, to) in wanted {
            let old = record.get(field);
            let same = match (old, &to) {
                (Some(Value::Number(a)), Value::Number(b)) => a.as_f64() == b.as_f64(),
                (Some(a), b) => a == b,
                (None, _) => false,
            };
            if same {
                continue;
            }
            changes.push(SyncChange {
                file: FILE.to_string(),
                field: format!("phases.{key}.{field}"),
                from: shown(old),
                to: shown(Some(&to)),
            });
            record.insert(field.to_string(), to);
        }
    }

    /// The checkpoint re-serialised with the indent, line ending and final
    /// newline the file had.
    pub fn render(&self) -> String {
        let eol = if self.raw.contains("\r\n") {
            "\r\n"
        } else {
            "\n"
        };
        let indent = self
            .raw
            .split('\n')
            .skip(1)
            .find_map(|line| {
                let ws = &line[..line.len() - line.trim_start_matches([' ', '\t']).len()];
                (!ws.is_empty() && line[ws.len()..].starts_with('"')).then_some(ws)
            })
            .unwrap_or("  ");
        let mut buf = Vec::new();
        let mut ser =
            Serializer::with_formatter(&mut buf, PrettyFormatter::with_indent(indent.as_bytes()));
        let _ = self.data.serialize(&mut ser);
        let mut text = String::from_utf8(buf).unwrap_or_default();
        if self.raw.ends_with('\n') {
            text.push('\n');
        }
        text.replace('\n', eol)
    }
}
