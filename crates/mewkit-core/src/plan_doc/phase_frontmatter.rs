//! The frontmatter half of one phase file's structural check.
//!
//! Split from the section and line checks because the questions differ: those
//! read the document, these read its declared STATE — and state that disagrees
//! with the document (a `completed` phase with unchecked todos, a phase number
//! that contradicts its own filename) is the error class worth its own file.
//!
//! Severity is the contract. A missing block is a WARN, so plans authored
//! before the template existed keep validating; a block that LIES about the
//! phase is an ERROR.
use regex::Regex;
use serde_json::{Map, Value};
use std::sync::LazyLock;

use super::phase_structure::{count_checkboxes, parse_frontmatter};
use crate::js_number::js_number;

const VALID_STATUS: [&str; 6] = [
    "abandoned",
    "active",
    "completed",
    "failed",
    "in_progress",
    "pending",
];
const FRONTMATTER_FIELDS: [&str; 6] = [
    "phase",
    "title",
    "status",
    "priority",
    "effort",
    "dependencies",
];

static PHASE_FROM_NAME: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^phase-(\d+)").expect("static phase-number pattern"));

/// One phase file's frontmatter issues, by severity.
pub(super) struct Issues {
    pub warnings: Vec<String>,
    pub errors: Vec<String>,
}

fn list(values: &[&str]) -> String {
    let quoted: Vec<String> = values.iter().map(|v| format!("'{v}'")).collect();
    format!("[{}]", quoted.join(", "))
}

/// `String(value)` for the scalars a frontmatter field can hold. A float keeps
/// its fractional spelling where JavaScript would drop a trailing `.0`; a
/// `status:` that is a number at all is already outside the template.
pub(super) fn js_string(value: &Value) -> String {
    match value {
        Value::String(s) => s.clone(),
        Value::Bool(b) => b.to_string(),
        Value::Number(n) => n.to_string(),
        other => other.to_string(),
    }
}

/// `Number(value)`, which is how the TypeScript coerces `frontmatter.phase`
/// before asking whether it is an integer. `None` is JavaScript's `NaN`.
fn js_number_of(value: &Value) -> Option<f64> {
    match value {
        Value::String(s) => js_number(s).and_then(|n| n.as_f64()),
        Value::Number(n) => n.as_f64(),
        Value::Bool(b) => Some(if *b { 1.0 } else { 0.0 }),
        Value::Null => Some(0.0),
        // `Number([1])` is 1 and `Number({})` is NaN in JavaScript. A composite
        // `phase:` is pathological either way, and both land on an error.
        _ => None,
    }
}

fn check_status(fm: &Map<String, Value>, basename: &str, issues: &mut Issues) -> String {
    let raw = fm.get("status");
    let empty = match raw {
        None | Some(Value::Null) => true,
        Some(Value::String(s)) => s.is_empty(),
        Some(_) => false,
    };
    if empty {
        issues.warnings.push(format!(
            "{basename}: frontmatter 'status' has no value — author should set explicit status"
        ));
        return String::new();
    }
    let status = match raw {
        Some(Value::String(s)) => s.to_lowercase(),
        Some(other) => js_string(other),
        None => String::new(),
    };
    if status == "unknown" {
        issues.errors.push(format!(
            "{basename}: 'status: unknown' is reserved as parser sentinel — never write"
        ));
    } else if !status.is_empty() && !VALID_STATUS.contains(&status.as_str()) {
        issues.errors.push(format!(
            "{basename}: invalid status '{status}'; allowed: {}",
            list(&VALID_STATUS)
        ));
    }
    status
}

fn check_phase_number(fm: &Map<String, Value>, basename: &str, issues: &mut Issues) {
    let Some(caps) = PHASE_FROM_NAME.captures(basename) else {
        return;
    };
    let Some(phase) = fm.get("phase") else {
        return;
    };
    let expected: f64 = caps
        .get(1)
        .and_then(|m| m.as_str().parse::<f64>().ok())
        .unwrap_or(f64::NAN);
    match js_number_of(phase) {
        Some(actual) if actual.fract() == 0.0 && actual.is_finite() => {
            if actual != expected {
                issues.errors.push(format!(
                    "{basename}: frontmatter phase={} != filename phase={}",
                    actual as i64, expected as i64
                ));
            }
        }
        _ => issues
            .errors
            .push(format!("{basename}: frontmatter 'phase' is not an integer")),
    }
}

pub(super) fn check_frontmatter(content: &str, basename: &str) -> Issues {
    let mut issues = Issues {
        warnings: Vec::new(),
        errors: Vec::new(),
    };
    let Some(fm) = parse_frontmatter(content) else {
        issues.warnings.push(format!(
            "{basename}: missing or malformed frontmatter (legacy compat — add per phase-template.md)"
        ));
        return issues;
    };
    for key in FRONTMATTER_FIELDS {
        if !fm.contains_key(key) {
            issues
                .warnings
                .push(format!("{basename}: frontmatter missing field '{key}'"));
        }
    }
    let status = check_status(&fm, basename, &mut issues);
    check_phase_number(&fm, basename, &mut issues);

    if let Some(blocked) = fm.get("blocked_on") {
        match blocked.as_array() {
            None => issues.warnings.push(format!(
                "{basename}: frontmatter 'blocked_on' should be a list of strings"
            )),
            Some(items) if !items.iter().all(Value::is_string) => issues.warnings.push(format!(
                "{basename}: frontmatter 'blocked_on' items should all be strings"
            )),
            Some(_) => {}
        }
    }

    if status == "completed" {
        let (total, checked) = count_checkboxes(content);
        if total > 0 && checked < total {
            issues.errors.push(format!(
                "{basename}: status=completed but {}/{total} todos unchecked (drift)",
                total - checked
            ));
        }
    }
    issues
}
