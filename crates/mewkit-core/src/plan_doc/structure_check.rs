//! Structural validation of a plan directory: `plan.md` plus every sibling
//! `phase-*.md`. Port of `core/check-plan-structure.ts`.
//!
//! This is the check the planning flow runs before presenting Gate 1, which is
//! why it lives in the CLI and not in a language the project may not have
//! installed: a mandatory gate step that only works where an interpreter
//! happens to exist is a gate that silently stops being mandatory.
//!
//! The verdict line is a stable marker — `PLAN_COMPLETE` or `PLAN_INCOMPLETE` —
//! because callers match on it rather than on an exit code alone.
use std::path::{Path, PathBuf};

use serde::Serialize;

use super::phase_frontmatter::js_string;
use super::phase_structure::{check_phase_file, parse_frontmatter, section_body};

const PLAN_REQUIRED_SECTIONS: [&str; 1] = ["## Goal"];
const PLAN_REQUIRED_FRONTMATTER: [&str; 4] = ["title", "type", "status", "priority"];

/// `handoff.next` is enum-validated when the optional `handoff:` block is
/// present.
const HANDOFF_NEXT_VALID: [&str; 5] = ["autobuild", "cook", "end", "red-team", "validate"];

/// A goal is an outcome, so it must not open with an activity verb.
const ACTIVITY_VERBS: [&str; 7] = [
    "implement",
    "create",
    "build",
    "add",
    "write",
    "set up",
    "configure",
];

const MAX_PLAN_LINES: usize = 100;

/// Field order is the JSON key order the npm CLI prints.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanStructureReport {
    /// Every issue in print order; warnings carry a `WARN ` prefix.
    pub issues: Vec<String>,
    pub warning_count: usize,
    pub error_count: usize,
    pub phase_count: usize,
    pub complete: bool,
}

fn check_plan_file(content: &str) -> Vec<String> {
    let mut issues = Vec::new();
    if !content.starts_with("---") {
        issues.push("plan.md: Missing YAML frontmatter".to_string());
    } else {
        // `split("---")[1]`: the text between the first two fences, which is
        // scanned for a bare `key:` rather than parsed — a field commented out
        // inside the block still counts as present, there as here.
        let block = content.split("---").nth(1).unwrap_or("");
        for field in PLAN_REQUIRED_FRONTMATTER {
            if !block.contains(&format!("{field}:")) {
                issues.push(format!("plan.md: Missing frontmatter: {field}"));
            }
        }
    }

    if let Some(next) = content
        .starts_with("---")
        .then(|| parse_frontmatter(content))
        .flatten()
        .and_then(|fm| fm.get("handoff").and_then(|h| h.as_object().cloned()))
        .and_then(|handoff| handoff.get("next").cloned())
        .filter(|next| !next.is_null())
    {
        let spelled = js_string(&next);
        if !HANDOFF_NEXT_VALID.contains(&spelled.as_str()) {
            let allowed: Vec<String> = HANDOFF_NEXT_VALID
                .iter()
                .map(|v| format!("'{v}'"))
                .collect();
            issues.push(format!(
                "plan.md: handoff.next '{spelled}' not in [{}]",
                allowed.join(", ")
            ));
        }
    }

    for section in PLAN_REQUIRED_SECTIONS {
        if !content.contains(section) {
            issues.push(format!("plan.md: Missing section: {section}"));
        }
    }

    if let Some(goal) = section_body(content, "## Goal")
        .map(|body| body.trim().to_lowercase())
        .filter(|goal| !goal.is_empty())
        && let Some(verb) = ACTIVITY_VERBS.iter().find(|v| goal.starts_with(**v))
    {
        issues.push(format!(
            "plan.md: Goal starts with activity verb '{verb}' — rewrite as outcome"
        ));
    }

    let lines = content.trim().split('\n').count();
    if lines > MAX_PLAN_LINES {
        issues.push(format!(
            "plan.md: {lines} lines (max 80 recommended) — move detail to phase files"
        ));
    }
    issues
}

fn phase_files_in(dir: &Path) -> Vec<String> {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut names: Vec<String> = entries
        .filter_map(Result::ok)
        .map(|e| e.file_name().to_string_lossy().into_owned())
        .filter(|name| name.starts_with("phase-") && name.ends_with(".md"))
        .collect();
    names.sort();
    names
}

/// Validate `plan.md` and every `phase-*.md` beside it. A plan DIRECTORY names
/// its own `plan.md`.
///
/// `plan_path` is reported verbatim in the not-found issue, so a caller that
/// resolved the path first sees the resolved one — which is what the `plan`
/// command does.
pub fn check_plan_structure(plan_path: &Path) -> PlanStructureReport {
    let resolved: PathBuf = if plan_path.is_dir() {
        plan_path.join("plan.md")
    } else {
        plan_path.to_path_buf()
    };
    let Ok(content) = std::fs::read_to_string(&resolved) else {
        return PlanStructureReport {
            issues: vec![format!("File not found: {}", plan_path.display())],
            warning_count: 0,
            error_count: 1,
            phase_count: 0,
            complete: false,
        };
    };

    let mut issues = check_plan_file(&content);
    let plan_dir = resolved.parent().unwrap_or(Path::new("."));
    let phase_files = phase_files_in(plan_dir);

    for name in &phase_files {
        match std::fs::read_to_string(plan_dir.join(name)) {
            Ok(phase) => issues.extend(check_phase_file(&phase, name)),
            // An unreadable phase file is a structural problem of its own; the
            // TypeScript throws here, and the command prints the throw.
            Err(error) => issues.push(format!("{name}: {error}")),
        }
    }
    for name in &phase_files {
        if !content.contains(name) {
            issues.push(format!(
                "plan.md: Phase file '{name}' exists but not linked in plan"
            ));
        }
    }

    // Only a non-WARN issue fails the plan. Legacy issues carry no prefix and
    // still count as errors, so an older caller's expectations do not change.
    let warning_count = issues.iter().filter(|i| i.starts_with("WARN ")).count();
    let error_count = issues.len() - warning_count;
    PlanStructureReport {
        issues,
        warning_count,
        error_count,
        phase_count: phase_files.len(),
        complete: error_count == 0,
    }
}

fn plural(n: usize, word: &str) -> String {
    format!("{word}{}", if n == 1 { "" } else { "s" })
}

/// The report's printable lines, verdict marker first.
pub fn render_plan_structure(report: &PlanStructureReport) -> Vec<String> {
    if !report.complete {
        let mut lines = vec![format!(
            "PLAN_INCOMPLETE: {} error(s), {} warning(s)",
            report.error_count, report.warning_count
        )];
        lines.extend(report.issues.iter().map(|i| format!("  - {i}")));
        return lines;
    }
    let suffix = if report.warning_count > 0 {
        format!(
            " ({} {})",
            report.warning_count,
            plural(report.warning_count, "warning")
        )
    } else {
        String::new()
    };
    let mut lines = vec![format!(
        "PLAN_COMPLETE ({} {} validated){suffix}",
        report.phase_count,
        plural(report.phase_count, "phase file")
    )];
    lines.extend(
        report
            .issues
            .iter()
            .filter(|i| i.starts_with("WARN "))
            .map(|i| format!("  - {i}")),
    );
    lines
}

#[cfg(test)]
#[path = "structure_check_tests.rs"]
mod tests;
