//! The four per-line drift rules.
//!
//! Split from the file-level scan so each file answers one question: this one
//! is "what can one LINE contradict", the other is "what must a FILE carry".
use std::sync::LazyLock;

use regex::Regex;

use super::workflow_drift::{Violation, matches_glob};
use super::workflow_spec::CanonicalSpec;

static PHASE_NAME: LazyLock<Regex> = LazyLock::new(|| {
    crate::js_regex::compile(r"Phase\s+(\d+(?:\.\d+)?)\s+\(?([A-Za-z][A-Za-z]+)")
        .expect("a static phase-name pattern")
});

/// Only the inline flow-sequence form. A YAML block sequence (one id per line)
/// is not detected — an accepted token-level limit.
static APPLIES_TO: LazyLock<Regex> = LazyLock::new(|| {
    crate::js_regex::compile(r"applies_to:\s*\[([^\]]*)\]").expect("a static applies-to pattern")
});

static TASKS_PATH: LazyLock<Regex> = LazyLock::new(|| {
    crate::js_regex::compile(r"tasks/([A-Za-z0-9_-]+)/").expect("a static tasks-path pattern")
});

static DIGITS: LazyLock<Regex> =
    LazyLock::new(|| crate::js_regex::compile(r"\d+").expect("a static digit pattern"));

static GATE_1: LazyLock<Regex> =
    LazyLock::new(|| crate::js_regex::compile(r"\bGate\s*1\b").expect("a static gate-1 pattern"));

static GATE_2: LazyLock<Regex> =
    LazyLock::new(|| crate::js_regex::compile(r"\bGate\s*2\b").expect("a static gate-2 pattern"));

pub(super) fn scan_line(
    spec: &CanonicalSpec,
    rel_path: &str,
    text: &str,
    line_no: usize,
    dir_typos: &[(String, String)],
    violations: &mut Vec<Violation>,
) {
    // 1. Phase id ↔ name binding. Only a CONTRADICTION when the word after
    //    "Phase N" is itself an exact canonical phase name bound to another id;
    //    prose like "Phase 3 GREEN" is not a name claim.
    for capture in PHASE_NAME.captures_iter(text) {
        let id = capture.get(1).map(|m| m.as_str()).unwrap_or_default();
        let word = capture.get(2).map(|m| m.as_str()).unwrap_or_default();
        if spec.phase_names.contains(word) && spec.name_of(id) != Some(word) {
            let expected = match spec.name_of(id) {
                Some(name) => format!("Phase {id} {name}"),
                None => format!(
                    "{word} is canonical Phase {}, not {id}",
                    spec.id_of(word).unwrap_or("undefined")
                ),
            };
            violations.push(Violation {
                file: rel_path.to_string(),
                line: line_no,
                found: format!("Phase {id} {word}"),
                expected,
            });
        }
    }

    // 2. Required-output path typo.
    for capture in TASKS_PATH.captures_iter(text) {
        let dir = capture.get(1).map(|m| m.as_str()).unwrap_or_default();
        if let Some((_, canonical)) = dir_typos.iter().find(|(typo, _)| typo == dir) {
            violations.push(Violation {
                file: rel_path.to_string(),
                line: line_no,
                found: format!("tasks/{dir}/"),
                expected: format!("tasks/{canonical}/"),
            });
        }
    }

    // 3. An output glob bound to the wrong gate — only when a SINGLE gate is on
    //    the line, because a line naming both is a legitimate summary.
    let has_gate_1 = GATE_1.is_match(text);
    let has_gate_2 = GATE_2.is_match(text);
    if let Some(review_output) = spec.gate("gate_2")
        && has_gate_1
        && !has_gate_2
        && matches_glob(text, review_output)
    {
        violations.push(Violation {
            file: rel_path.to_string(),
            line: line_no,
            found: format!("Gate 1 referencing {review_output}"),
            expected: format!("Gate 2 owns {review_output}"),
        });
    }
    if let Some(plan_output) = spec.gate("gate_1")
        && has_gate_2
        && !has_gate_1
        && matches_glob(text, plan_output)
    {
        violations.push(Violation {
            file: rel_path.to_string(),
            line: line_no,
            found: format!("Gate 2 referencing {plan_output}"),
            expected: format!("Gate 1 owns {plan_output}"),
        });
    }

    // 4. `applies_to` must enumerate every integer phase id.
    if let Some(capture) = APPLIES_TO.captures(text) {
        let listed = capture.get(1).map(|m| m.as_str()).unwrap_or_default();
        let present: Vec<i64> = DIGITS
            .find_iter(listed)
            .filter_map(|m| m.as_str().parse::<i64>().ok())
            .collect();
        let missing: Vec<String> = spec
            .integer_phase_ids
            .iter()
            .filter(|id| !present.contains(id))
            .map(i64::to_string)
            .collect();
        if !missing.is_empty() {
            let all: Vec<String> = spec.integer_phase_ids.iter().map(i64::to_string).collect();
            violations.push(Violation {
                file: rel_path.to_string(),
                line: line_no,
                found: format!("applies_to omits Phase {}", missing.join(", ")),
                expected: format!("applies_to includes Phase {}", all.join(", ")),
            });
        }
    }
}
