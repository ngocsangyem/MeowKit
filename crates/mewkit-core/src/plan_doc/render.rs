//! The human output of `plan status` and `plan check`.
//!
//! Colour is the one thing deliberately NOT ported: the npm CLI dims and
//! colours through picocolors, which emits nothing when stdout is not a
//! terminal — which is every piped run, every hook and every parity case. So
//! the plain text below IS the comparable output, and adding colour here would
//! be the only difference between the two CLIs.
use std::path::Path;

use super::parser::{PhaseChecklist, PhaseFile, PlanSummary, REQUIRED_PHASE_SECTIONS};

/// The ratio as a whole percent, or an em dash when there is nothing to divide.
fn pct(c: &PhaseChecklist) -> String {
    if c.total == 0 {
        return "—".to_string();
    }
    format!("{}%", round(c.checked as f64 / c.total as f64 * 100.0))
}

/// `Math.round`: halves go up, which for non-negative ratios is what Rust's
/// `round` (half away from zero) does too.
fn round(value: f64) -> usize {
    value.round() as usize
}

/// A compact progress bar. Purely presentational.
fn bar(c: &PhaseChecklist, width: usize) -> String {
    if c.total == 0 {
        return "─".repeat(width);
    }
    let filled = round(c.checked as f64 / c.total as f64 * width as f64).min(width);
    format!("{}{}", "█".repeat(filled), "░".repeat(width - filled))
}

/// The frontmatter status token, or the npm CLI's placeholder for none.
fn status_tag(status: Option<&String>) -> &str {
    status.map(String::as_str).unwrap_or("(no status)")
}

/// Pad on the left to `width`, counting characters the way `String#padStart`
/// counts UTF-16 units — identical for the ASCII and em-dash values here.
fn pad_start(text: &str, width: usize) -> String {
    let len = text.chars().count();
    if len >= width {
        return text.to_string();
    }
    format!("{}{text}", " ".repeat(width - len))
}

pub fn render_status(summary: &PlanSummary) -> String {
    let fallback = Path::new(&summary.dir)
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    let mut out = Vec::new();
    out.push(summary.title.clone().unwrap_or(fallback));
    out.push(format!("  plan:   {}", summary.dir));
    out.push(format!("  status: {}", status_tag(summary.status.as_ref())));
    out.push(String::new());

    if !summary.phases.is_empty() {
        out.push("  Phases".to_string());
        for phase in &summary.phases {
            let c = &phase.checklist;
            let label: String = phase
                .title
                .clone()
                .unwrap_or_else(|| phase.file.clone())
                .chars()
                .take(58)
                .collect();
            out.push(format!(
                "    {} {} {}  {label}",
                bar(c, 14),
                pad_start(&pct(c), 4),
                pad_start(&format!("{}/{}", c.checked, c.total), 6),
            ));
            out.push(format!(
                "      {} · {}",
                phase.file,
                status_tag(phase.status.as_ref())
            ));
        }
        out.push(String::new());
    }

    let a = &summary.checklist;
    out.push(format!(
        "  Overall  {} {} ({}/{} boxes)",
        bar(a, 20),
        pct(a),
        a.checked,
        a.total
    ));
    // Checkboxes record what a human ticked. Saying so keeps the number honest
    // — it is a claim about the plan file, not about the code.
    out.push(
        "  Progress is what the plan's checkboxes say, not a verification of the work.".to_string(),
    );

    if !summary.issues.is_empty() {
        out.push(String::new());
        out.push(format!("  Observations ({})", summary.issues.len()));
        for issue in &summary.issues {
            out.push(format!("    • {issue}"));
        }
    }
    out.join("\n")
}

/// The per-phase report. `file` is the path as given on the command line; the
/// heading falls back to the basename the record carries.
pub fn render_check(phase: &PhaseFile, file: &str) -> String {
    let mut out = Vec::new();
    out.push(phase.title.clone().unwrap_or_else(|| phase.file.clone()));
    out.push(format!("  file:   {file}"));
    out.push(format!("  status: {}", status_tag(phase.status.as_ref())));
    if !phase.dependencies.is_empty() {
        out.push(format!("  deps:   {}", phase.dependencies.join(", ")));
    }
    let c = &phase.checklist;
    out.push(format!("  tasks:  {}/{} ({})", c.checked, c.total, pct(c)));
    out.push(String::new());
    out.push("  Required sections".to_string());
    for req in REQUIRED_PHASE_SECTIONS {
        let present = !phase.missing_sections.iter().any(|m| m == req);
        out.push(format!("    {} {req}", if present { "✓" } else { "✗" }));
    }
    if !phase.missing_sections.is_empty() {
        out.push(String::new());
        out.push(format!("  Missing: {}", phase.missing_sections.join(", ")));
        out.push(
            "  A phase file must be executable from a cold read — see documentation-management.md."
                .to_string(),
        );
    }
    out.join("\n")
}

#[cfg(test)]
#[path = "render_tests.rs"]
mod tests;
