//! One cost-log entry, read as a printable row.
//!
//! The log carries two generations of entry side by side: a LEGACY one a
//! command wrote (`command`/`tier`/`estimated_tokens`) and a SESSION one the
//! hook writes (`tokens_in`/`tokens_out`/`cache_*`/`model`). Both are read
//! here, legacy field first, so a log written across an upgrade still totals.
use serde_json::Value;

use super::number_format::to_locale_string;

/// A printable row: what the table and the monthly aggregate both consume.
#[derive(Clone, Debug, PartialEq)]
pub struct BudgetRow {
    pub date: String,
    pub command: String,
    pub tier: String,
    pub tokens: f64,
    pub task: String,
}

/// The live session accumulator, summed.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct LiveBudgetSummary {
    pub input_tokens: f64,
    pub output_tokens: f64,
    pub total_tokens: f64,
    pub human_reads: f64,
    pub estimated_cost: f64,
}

/// `Number(value)` with a non-finite result read as 0, for the shapes a log
/// field can carry. A missing field, a boolean and an object are all 0.
pub fn coerce_number(value: Option<&Value>) -> f64 {
    match value {
        Some(Value::Number(number)) => number.as_f64().filter(|n| n.is_finite()).unwrap_or(0.0),
        Some(Value::String(text)) => crate::js_number::js_number(text)
            .and_then(|number| number.as_f64())
            .filter(|n| n.is_finite())
            .unwrap_or(0.0),
        _ => 0.0,
    }
}

/// A trimmed, non-empty string field, or `None` — the `(x && x.trim()) || …`
/// chain the npm CLI falls through for every label.
fn trimmed(entry: &Value, key: &str) -> Option<String> {
    let text = entry.get(key)?.as_str()?.trim();
    (!text.is_empty()).then(|| text.to_string())
}

/// `entry.date`, which both generations declare as a string.
fn date(entry: &Value) -> String {
    entry
        .get("date")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string()
}

pub fn to_budget_row(entry: &Value) -> BudgetRow {
    let legacy_tokens = coerce_number(entry.get("estimated_tokens"));
    let computed_tokens = coerce_number(entry.get("tokens_in"))
        + coerce_number(entry.get("tokens_out"))
        + coerce_number(entry.get("cache_write_tokens"))
        + coerce_number(entry.get("cache_read_tokens"));
    BudgetRow {
        date: date(entry),
        command: trimmed(entry, "command").unwrap_or_else(|| "session".to_string()),
        tier: trimmed(entry, "tier")
            .or_else(|| trimmed(entry, "model"))
            .unwrap_or_else(|| "unknown".to_string()),
        tokens: if legacy_tokens > 0.0 {
            legacy_tokens
        } else {
            computed_tokens
        },
        task: trimmed(entry, "task")
            .or_else(|| trimmed(entry, "task_summary"))
            .or_else(|| trimmed(entry, "session_id").map(|id| format!("session {id}")))
            .unwrap_or_else(|| "session snapshot".to_string()),
    }
}

/// Keep the entries a `--session` and/or `--day` selection asks for. An entry
/// without the field is excluded, never silently kept.
pub fn filter_budget_entries<'a>(
    entries: &'a [Value],
    session_id: Option<&str>,
    day: Option<&str>,
) -> Vec<&'a Value> {
    entries
        .iter()
        .filter(|entry| {
            let session_matches = session_id.is_none_or(|wanted| {
                entry
                    .get("session_id")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .trim()
                    == wanted
            });
            // `date.slice(0, 10)` — the YYYY-MM-DD head of an ISO instant.
            let day_matches =
                day.is_none_or(|wanted| date(entry).chars().take(10).collect::<String>() == wanted);
            session_matches && day_matches
        })
        .collect()
}

pub fn summarize_live_budget_state(state: &Value) -> LiveBudgetSummary {
    let input_tokens = coerce_number(state.get("estimated_input_tokens"));
    let output_tokens = coerce_number(state.get("estimated_output_tokens"));
    LiveBudgetSummary {
        input_tokens,
        output_tokens,
        total_tokens: input_tokens + output_tokens,
        human_reads: coerce_number(state.get("turn_count")),
        estimated_cost: coerce_number(state.get("estimated_cost_usd")),
    }
}

/// Entries grouped by `YYYY-MM`, in first-seen order — the insertion order a
/// `Map` keeps, which is what decides the printed row order.
pub fn aggregate_by_month(rows: &[BudgetRow]) -> Vec<(String, f64, usize)> {
    let mut months: Vec<(String, f64, usize)> = Vec::new();
    for row in rows {
        let month: String = row.date.chars().take(7).collect();
        match months.iter_mut().find(|(name, _, _)| *name == month) {
            Some(entry) => {
                entry.1 += row.tokens;
                entry.2 += 1;
            }
            None => months.push((month, row.tokens, 1)),
        }
    }
    months
}

/// The total the footer prints, already spelled the way it is printed.
pub fn total_tokens_text(rows: &[BudgetRow]) -> String {
    to_locale_string(rows.iter().map(|row| row.tokens).sum())
}
