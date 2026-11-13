//! The frontmatter report as `validate` rows.
//!
//! Errors fail the Structure section; the advisory fields warn. Only the first
//! ten of each are listed, because the count is in the summary and nobody reads
//! a hundred-line detail block.
use std::path::Path;

use super::frontmatter::check_skill_frontmatter;
use super::result::{CheckResult, Section, Status};

/// The report as `validate` rows.
pub fn check_frontmatter_contract(project_root: &Path) -> Vec<CheckResult> {
    let report = check_skill_frontmatter(project_root);
    if let Some(fatal) = report.fatal {
        return vec![CheckResult::new(
            "Skill frontmatter",
            Status::Fail,
            fatal,
            Section::Structure,
        )];
    }
    let mut results = Vec::new();
    if !report.errors.is_empty() {
        let listed: Vec<String> = report.errors.iter().take(10).cloned().collect();
        results.push(CheckResult::new(
            "Skill frontmatter",
            Status::Fail,
            format!(
                "{} error(s)\n         {}",
                report.errors.len(),
                listed.join("\n         ")
            ),
            Section::Structure,
        ));
    } else if report.valid == 0 {
        results.push(CheckResult::new(
            "Skill frontmatter",
            Status::Fail,
            "Zero SKILL.md files found under .claude/skills/",
            Section::Structure,
        ));
    } else {
        results.push(CheckResult::new(
            "Skill frontmatter",
            Status::Pass,
            format!(
                "{} skill(s) validated against skill-schema.json",
                report.valid
            ),
            Section::Structure,
        ));
    }
    if !report.warnings.is_empty() {
        let listed: Vec<String> = report.warnings.iter().take(10).cloned().collect();
        results.push(CheckResult::new(
            "Skill frontmatter advisories",
            Status::Warn,
            format!(
                "{} warning(s)\n         {}",
                report.warnings.len(),
                listed.join("\n         ")
            ),
            Section::Structure,
        ));
    }
    results
}
