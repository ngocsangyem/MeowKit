//! Does any prose CONTRADICT the lifecycle spec?
//!
//! A phase id bound to the wrong name, a required-output path typo, an output
//! glob bound to the wrong gate, an `applies_to` list that drops a phase, or a
//! Reflect lead list that disagrees. Port of the scanning half of
//! `core/check-workflow-drift.ts`.
//!
//! Boundary (honest): this is a TOKEN/LINE detector, not a prose parser. It
//! guarantees phase names, gate-to-output binding and output-path patterns
//! never disagree across files; it does NOT catch a wording contradiction that
//! uses no canonical token. That is the documented trade-off.
use std::path::Path;
use std::sync::LazyLock;

use regex::Regex;

use super::workflow_line_scan::scan_line;
use super::workflow_spec::{CanonicalSpec, SPEC_FILENAME};

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Violation {
    /// Path relative to the project root.
    pub file: String,
    /// 1-based; 0 for a whole-file finding.
    pub line: usize,
    pub found: String,
    pub expected: String,
}

static REFLECT: LazyLock<Regex> =
    LazyLock::new(|| crate::js_regex::compile(r"\bReflect\b").expect("a static reflect pattern"));

/// A glob as a loose substring probe: regex metacharacters escaped, `*` → `.*`.
fn glob_to_probe(glob: &str) -> String {
    let mut out = String::with_capacity(glob.len() * 2);
    for ch in glob.chars() {
        match ch {
            '.' | '+' | '?' | '^' | '$' | '{' | '}' | '(' | ')' | '|' | '[' | ']' | '\\' => {
                out.push('\\');
                out.push(ch);
            }
            '*' => out.push_str(".*"),
            other => out.push(other),
        }
    }
    out
}

pub(super) fn matches_glob(text: &str, glob: &str) -> bool {
    Regex::new(&glob_to_probe(glob)).is_ok_and(|probe| probe.is_match(text))
}

/// Scan one prose file for tokens that contradict the spec.
pub fn scan_for_violations(
    spec: &CanonicalSpec,
    project_root: &Path,
    rel_path: &str,
    lifecycle_render: bool,
) -> Vec<Violation> {
    let abs = rel_path
        .split('/')
        .fold(project_root.to_path_buf(), |acc, part| acc.join(part));
    if !abs.exists() {
        return vec![Violation {
            file: rel_path.to_string(),
            line: 0,
            found: "missing source file".to_string(),
            expected: "file listed in workflow.yaml sources must exist".to_string(),
        }];
    }
    let body = std::fs::read(&abs)
        .map(|bytes| String::from_utf8_lossy(&bytes).into_owned())
        .unwrap_or_default();
    let mut violations = Vec::new();

    let canonical_pointer = format!("Canonical source: {SPEC_FILENAME}");
    if !body.contains(&canonical_pointer) {
        violations.push(Violation {
            file: rel_path.to_string(),
            line: 0,
            found: "missing canonical source pointer".to_string(),
            expected: canonical_pointer,
        });
    }
    if lifecycle_render {
        let sequence: Vec<String> = spec
            .name_by_id
            .iter()
            .map(|(id, name)| format!("{id}:{name}"))
            .collect();
        let marker = format!("<!-- Workflow phase sequence: {} -->", sequence.join(" > "));
        if !body.contains(&marker) {
            violations.push(Violation {
                file: rel_path.to_string(),
                line: 0,
                found: "missing or reordered workflow phase sequence marker".to_string(),
                expected: marker,
            });
        }
    }

    // The confusable SINGULAR form of each canonical output dir — the realistic
    // typo (`tasks/review/` for `tasks/reviews/`).
    let dir_typos: Vec<(String, String)> = spec
        .output_dirs
        .iter()
        .filter_map(|dir| {
            dir.strip_suffix('s')
                .map(|singular| (singular.to_string(), dir.clone()))
        })
        .collect();

    for (index, text) in body.split('\n').enumerate() {
        let line_no = index + 1;
        scan_line(spec, rel_path, text, line_no, &dir_typos, &mut violations);
    }

    // A file that ENUMERATES the Reflect leads (mentions Reflect and at least
    // two of them) must carry all of them. Gating on two avoids flagging a file
    // that mentions one agent incidentally.
    if REFLECT.is_match(&body) {
        let present: Vec<&String> = spec
            .reflect_leads
            .iter()
            .filter(|lead| body.contains(lead.as_str()))
            .collect();
        if present.len() >= 2 && present.len() < spec.reflect_leads.len() {
            let missing: Vec<&str> = spec
                .reflect_leads
                .iter()
                .filter(|lead| !body.contains(lead.as_str()))
                .map(String::as_str)
                .collect();
            violations.push(Violation {
                file: rel_path.to_string(),
                line: 0,
                found: format!("Reflect leads missing {}", missing.join(", ")),
                expected: format!("Reflect leads = {}", spec.reflect_leads.join(" + ")),
            });
        }
    }
    violations
}

#[cfg(test)]
#[path = "workflow_drift_tests.rs"]
mod workflow_drift_tests;
