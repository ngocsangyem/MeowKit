//! The `gitignore` step: the deny-all `.meowkit/.gitignore`, the root ignore
//! entries, and removal of lines a previous version wrote that now describe the
//! same paths twice.
use std::io;
use std::path::Path;
use std::sync::LazyLock;

use regex::Regex;

use super::templates::{DEFAULT_GITIGNORE, KIT_DIR_GITIGNORE};
use super::{Changes, StepOptions, StepResult, StepStatus};
use crate::js_regex;

static STALE_MEMORY: LazyLock<Regex> = LazyLock::new(|| {
    js_regex::compile(r"^\s*\.?/?\.meowkit/memory/?\*{0,2}\s*$").expect("a valid pattern")
});
static SUPERSEDED: LazyLock<Regex> = LazyLock::new(|| {
    js_regex::compile(
        r"^\s*\.?/?\.meowkit/(?:telemetry|state|cache|envs|backups)/?\*{0,2}\s*$|^\s*\.?/?\.meowkit/\.env\s*$",
    )
    .expect("a valid pattern")
});

/// Strip a stale `.meowkit/memory/` ignore line. In v2 the whole memory
/// directory was ignored; now the team store is COMMITTED and reviewed in the
/// PR diff, so a project set up by the old version must not keep ignoring it.
/// Only an exact MeowKit-shaped line goes.
pub fn strip_stale_memory_ignore(content: &str) -> (String, bool) {
    let lines: Vec<&str> = content.split('\n').collect();
    let kept: Vec<&str> = lines
        .iter()
        .copied()
        .filter(|l| !STALE_MEMORY.is_match(l))
        .collect();
    if kept.len() == lines.len() {
        return (content.to_string(), false);
    }
    (kept.join("\n"), true)
}

/// Strip the per-class `.meowkit/*` ignores the deny-all file supersedes. A
/// line the user negated with `!` is left alone: that is a decision.
pub fn strip_superseded_meowkit_ignores(content: &str) -> (String, Vec<String>) {
    let mut stripped = Vec::new();
    let kept: Vec<&str> = content
        .split('\n')
        .filter(|line| {
            if line
                .trim_start_matches(js_regex::is_js_whitespace)
                .starts_with('!')
                || !SUPERSEDED.is_match(line)
            {
                return true;
            }
            stripped.push(line.trim_matches(js_regex::is_js_whitespace).to_string());
            false
        })
        .collect();
    if stripped.is_empty() {
        return (content.to_string(), stripped);
    }
    (kept.join("\n"), stripped)
}

/// Write the deny-all ignore file unless the project's copy already matches.
fn write_kit_dir_gitignore(dir: &Path, dry_run: bool) -> io::Result<bool> {
    let target = dir.join(".meowkit").join(".gitignore");
    if std::fs::read_to_string(&target).is_ok_and(|c| c == KIT_DIR_GITIGNORE) {
        return Ok(false);
    }
    if !dry_run {
        std::fs::create_dir_all(dir.join(".meowkit"))?;
        std::fs::write(&target, KIT_DIR_GITIGNORE)?;
    }
    Ok(true)
}

pub(super) fn run(dir: &Path, options: &StepOptions<'_>) -> io::Result<StepResult> {
    let gitignore = dir.join(".gitignore");
    let mut w = Changes::new(dir, options.dry_run);
    let mut notes: Vec<String> = Vec::new();
    if write_kit_dir_gitignore(dir, w.dry_run)? {
        w.record("create", &dir.join(".meowkit").join(".gitignore"), None);
        notes.push("Wrote .meowkit/.gitignore (deny-all + the shared allowlist)".to_string());
    }

    if gitignore.exists() {
        let mut content = std::fs::read_to_string(&gitignore)?;
        // Before the "already present" skip: a stale or superseded line has to
        // go even when everything else is in place.
        let (text, memory_stripped) = strip_stale_memory_ignore(&content);
        if memory_stripped {
            content = text;
            notes.push(
                "Removed the stale .meowkit/memory/ ignore \u{2014} the v3 team store is committed"
                    .to_string(),
            );
        }
        let (text, superseded) = strip_superseded_meowkit_ignores(&content);
        if !superseded.is_empty() {
            content = text;
            notes.push(format!(
                "Removed {} .meowkit/ line(s) now covered by .meowkit/.gitignore",
                superseded.len()
            ));
        }
        if memory_stripped || !superseded.is_empty() {
            w.write(&gitignore, &content)?;
        }
        if content.contains("session-state/") {
            let (status, message) = if notes.is_empty() {
                (
                    StepStatus::Skip,
                    "MeowKit entries already in .gitignore".to_string(),
                )
            } else {
                (StepStatus::Pass, notes.join("; "))
            };
            return Ok(StepResult::new(status, message).with_changes(w.changes));
        }
    }

    // The shipped template when it exists, otherwise the built-in entries.
    let additions = std::fs::read_to_string(dir.join(".meowkit").join("gitignore.meowkit"))
        .unwrap_or_else(|_| DEFAULT_GITIGNORE.to_string());
    w.append(&gitignore, &format!("\n{additions}"))?;
    notes.push("Appended MeowKit entries to .gitignore".to_string());
    Ok(StepResult::new(StepStatus::Pass, notes.join("; ")).with_changes(w.changes))
}
