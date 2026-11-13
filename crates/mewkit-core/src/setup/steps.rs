//! The three file-writing steps that need no environment: `mcp`, `env`,
//! `project-context`.
use std::io;
use std::path::Path;

use super::templates::{DEFAULT_ENV, DEFAULT_MCP};
use super::{Changes, StepOptions, StepResult, StepStatus};
use crate::js_regex::is_js_whitespace;

/// `.mcp.json`, from the shipped example when there is one.
pub(super) fn mcp(dir: &Path, options: &StepOptions<'_>) -> io::Result<StepResult> {
    let target = dir.join(".mcp.json");
    let mut w = Changes::new(dir, options.dry_run);
    if target.exists() {
        return Ok(
            StepResult::new(StepStatus::Skip, ".mcp.json already exists").with_changes(w.changes),
        );
    }
    // The template moved into `.meowkit/`; an install made before the move
    // still has the old copy.
    let canonical = dir.join(".meowkit").join("mcp.json.example");
    let example = if canonical.exists() {
        canonical
    } else {
        dir.join(".claude").join("mcp.json.example")
    };
    if example.exists() {
        w.copy(&example, &target)?;
    } else {
        w.write(&target, DEFAULT_MCP)?;
    }
    Ok(StepResult::new(
        StepStatus::Pass,
        "Created .mcp.json \u{2014} edit API keys inside.",
    )
    .with_changes(w.changes))
}

/// `.meowkit/.env`. A pre-move `.claude/.env` still counts as configured (the
/// loaders read both), so this never overwrites or duplicates an existing setup.
pub(super) fn env(dir: &Path, options: &StepOptions<'_>) -> io::Result<StepResult> {
    let target = dir.join(".meowkit").join(".env");
    let legacy = dir.join(".claude").join(".env");
    let mut w = Changes::new(dir, options.dry_run);
    for existing in [&target, &legacy] {
        if !existing.exists() {
            continue;
        }
        if !std::fs::read_to_string(existing)?
            .trim_matches(is_js_whitespace)
            .is_empty()
        {
            let message = format!("{} already exists", w.rel(existing));
            return Ok(StepResult::new(StepStatus::Skip, message).with_changes(w.changes));
        }
    }
    w.mkdir(&dir.join(".meowkit"))?;
    w.write(&target, DEFAULT_ENV)?;
    Ok(StepResult::new(
        StepStatus::Pass,
        "Created .meowkit/.env \u{2014} add your API keys.",
    )
    .with_changes(w.changes))
}

/// A hint only: the context file is written by a skill in the first session.
pub(super) fn project_context(dir: &Path) -> StepResult {
    if dir.join("docs").join("project-context.md").exists() {
        return StepResult::new(StepStatus::Skip, "docs/project-context.md already exists");
    }
    let has_codebase = ["package.json", "pyproject.toml", "Cargo.toml", "go.mod"]
        .iter()
        .any(|f| dir.join(f).exists());
    let action = if has_codebase { "generate" } else { "init" };
    StepResult::new(
        StepStatus::Warn,
        format!(
            "Run `/mk:project-context {action}` in your first session to create docs/project-context.md"
        ),
    )
}
