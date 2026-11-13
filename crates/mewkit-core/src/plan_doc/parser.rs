//! The read-only parser for the canonical plan shape, ported from
//! `core/plan-parser.ts`.
//!
//! ```text
//! tasks/plans/YYMMDD-name/
//!   plan.md              — overview, under 80 lines
//!   phase-XX-name.md     — the executable detail
//! ```
//!
//! It reports what the files SAY. It never judges whether a phase is truly
//! done: an unchecked box on finished work and a checked box on unfinished work
//! are both real states the plan owner reconciles, not the parser.
//!
//! The frontmatter values come from [`super::frontmatter_scan`], the line
//! scanner the npm CLI uses, rather than from a YAML reader — see that module
//! for why.
use std::path::{Path, PathBuf};
use std::sync::LazyLock;

use regex::Regex;
use serde::Serialize;

use super::frontmatter_scan::{array_field, field, frontmatter_lines};

/// Required sections in a phase file, as `plan check` reports them.
pub const REQUIRED_PHASE_SECTIONS: [&str; 5] = [
    "Overview",
    "Requirements",
    "Implementation Steps",
    "Success Criteria",
    "Risk Assessment",
];

/// `- [ ]` / `- [x]` task boxes anywhere in a document.
///
/// `\s*` after `^` can span blank lines, exactly as the JavaScript source does;
/// it never swallows a box, because `[` is not whitespace.
static BOX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?m)^\s*[-*]\s+\[[ xX]\]").expect("static checkbox pattern"));

/// A `## ` heading. The trailing `\r` a CRLF file leaves in the capture is
/// removed by the same `trim` the TypeScript applies.
static HEADING: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?m)^##\s+(.+)$").expect("static heading pattern"));

static PHASE_FILE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^phase-\d+.*\.md$").expect("static phase filename pattern"));

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct PhaseChecklist {
    pub total: usize,
    pub checked: usize,
}

/// One phase file as the inspector sees it. Field ORDER is the JSON key order
/// the npm CLI prints, so `--json` output stays byte-comparable.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PhaseFile {
    /// Basename, the way the npm CLI reports it.
    pub file: String,
    pub title: Option<String>,
    pub status: Option<String>,
    pub phase: Option<String>,
    pub dependencies: Vec<String>,
    /// Every `## ` heading present.
    pub sections: Vec<String>,
    pub missing_sections: Vec<String>,
    pub checklist: PhaseChecklist,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanSummary {
    pub dir: String,
    pub title: Option<String>,
    pub status: Option<String>,
    pub plan_md_present: bool,
    pub plan_md_lines: usize,
    pub phases: Vec<PhaseFile>,
    /// Aggregate across every phase file.
    pub checklist: PhaseChecklist,
    pub issues: Vec<String>,
}

fn checklist(body: &str) -> PhaseChecklist {
    let boxes: Vec<&str> = BOX.find_iter(body).map(|m| m.as_str()).collect();
    PhaseChecklist {
        checked: boxes
            .iter()
            .filter(|b| b.contains("[x]") || b.contains("[X]"))
            .count(),
        total: boxes.len(),
    }
}

fn headings(body: &str) -> Vec<String> {
    HEADING
        .captures_iter(body)
        .filter_map(|c| c.get(1))
        .map(|m| m.as_str().trim().to_string())
        .collect()
}

/// Parse one phase file. The error carries the unreadable-file problem the
/// caller prints; no fabricated empty phase.
pub fn parse_phase_file(abs: &Path) -> std::io::Result<PhaseFile> {
    let body = std::fs::read_to_string(abs)?;
    let fm = frontmatter_lines(&body);
    let sections = headings(&body);
    // A heading matches when the required name appears in it: real plans write
    // "## Risk Assessment" but also "## Success Criteria (Phase 2)".
    let missing_sections = REQUIRED_PHASE_SECTIONS
        .iter()
        .filter(|req| {
            let wanted = req.to_lowercase();
            !sections.iter().any(|s| s.to_lowercase().contains(&wanted))
        })
        .map(|req| (*req).to_string())
        .collect();
    Ok(PhaseFile {
        file: abs
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default(),
        title: field(&fm, "title"),
        status: field(&fm, "status"),
        phase: field(&fm, "phase"),
        dependencies: array_field(&fm, "dependencies"),
        sections,
        missing_sections,
        checklist: checklist(&body),
    })
}

/// Phase files in a plan dir, sorted by filename (which encodes phase order).
pub fn list_phase_files(plan_dir: &Path) -> Vec<PathBuf> {
    let Ok(entries) = std::fs::read_dir(plan_dir) else {
        return Vec::new();
    };
    let mut names: Vec<String> = entries
        .filter_map(Result::ok)
        .map(|e| e.file_name().to_string_lossy().into_owned())
        .filter(|name| PHASE_FILE.is_match(name))
        .collect();
    names.sort();
    names.into_iter().map(|name| plan_dir.join(name)).collect()
}

/// Parse a plan directory into a summary.
///
/// `issues` names what a reader should know before trusting the numbers. They
/// are observations, not verdicts: this is an inspector, and Gate 1 belongs to
/// the human.
pub fn parse_plan(plan_dir: &Path) -> std::io::Result<PlanSummary> {
    let mut issues: Vec<String> = Vec::new();
    let plan_md = plan_dir.join("plan.md");
    let plan_md_present = plan_md.exists();
    let mut title = None;
    let mut status = None;
    let mut plan_md_lines = 0;

    if plan_md_present {
        let body = std::fs::read_to_string(&plan_md)?;
        let fm = frontmatter_lines(&body);
        title = field(&fm, "title");
        status = field(&fm, "status");
        plan_md_lines = body.split('\n').count();
        // The overview stays under 80 lines. Reported, never enforced: the CLI
        // does not gate.
        if plan_md_lines > 80 {
            issues.push(format!(
                "plan.md is {plan_md_lines} lines (overview should stay under 80)"
            ));
        }
    } else {
        issues.push("no plan.md — Gate 1 expects one at the plan root".to_string());
    }

    let mut phases = Vec::new();
    for path in list_phase_files(plan_dir) {
        phases.push(parse_phase_file(&path)?);
    }
    if phases.is_empty() {
        issues.push("no phase-XX-*.md files found".to_string());
    }
    for phase in &phases {
        if !phase.missing_sections.is_empty() {
            issues.push(format!(
                "{} is missing: {}",
                phase.file,
                phase.missing_sections.join(", ")
            ));
        }
    }
    let checklist = phases.iter().fold(
        PhaseChecklist {
            total: 0,
            checked: 0,
        },
        |acc, p| PhaseChecklist {
            total: acc.total + p.checklist.total,
            checked: acc.checked + p.checklist.checked,
        },
    );
    Ok(PlanSummary {
        dir: plan_dir.to_string_lossy().into_owned(),
        title,
        status,
        plan_md_present,
        plan_md_lines,
        phases,
        checklist,
        issues,
    })
}

#[cfg(test)]
#[path = "parser_tests.rs"]
mod tests;
