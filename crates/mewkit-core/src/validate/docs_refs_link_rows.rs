//! The skill-link scan as `validate` rows: one per defect class.
//!
//! One row per class, not one for the whole scan, so a reader sees which kind
//! of dead reference dominates and a fix can be tracked class by class. The
//! severity is the caller's: the default run passes WARN, because the kit
//! carries references that predate the check and a build break would hide the
//! rest of the report.
use std::path::Path;

use super::docs_refs_links::{LinkFinding, LinkKind, check_skill_links};
use super::result::{CheckResult, Section, Status};

/// Findings listed per row; the row's first line carries the full count.
const LISTED: usize = 10;

const CLASSES: [(LinkKind, &str, &str); 4] = [
    (
        LinkKind::DeadMkPath,
        "No `mk:name/` used as a file path",
        "the folder is `.claude/skills/name/`, not `mk:name/`",
    ),
    (
        LinkKind::MissingSkill,
        "Skill links point at an existing skill",
        "no such directory under `.claude/skills/`",
    ),
    (
        LinkKind::MissingReference,
        "Skill links point at an existing file",
        "the skill exists but the linked file does not",
    ),
    (
        LinkKind::UnknownCommand,
        "Slash commands name an existing skill",
        "no skill defines this command",
    ),
];

fn row(findings: &[&LinkFinding], name: &str, why: &str, severity: Status) -> CheckResult {
    if findings.is_empty() {
        return CheckResult::new(name, Status::Pass, "none found", Section::Docs);
    }
    let listed: Vec<String> = findings
        .iter()
        .take(LISTED)
        .map(|f| format!("{}:{}: {}", f.file, f.line, f.token))
        .collect();
    let more = findings.len().saturating_sub(LISTED);
    let tail = if more > 0 {
        format!("\n         ... and {more} more")
    } else {
        String::new()
    };
    let detail = format!(
        "{} found — {why}\n         {}{tail}",
        findings.len(),
        listed.join("\n         ")
    );
    CheckResult::new(name, severity, detail, Section::Docs)
}

pub fn check_skill_link_rows(claude_dir: &Path, severity: Status) -> Vec<CheckResult> {
    let findings = check_skill_links(claude_dir);
    CLASSES
        .iter()
        .map(|(kind, name, why)| {
            let of_kind: Vec<&LinkFinding> = findings.iter().filter(|f| f.kind == *kind).collect();
            row(&of_kind, name, why, severity)
        })
        .collect()
}
