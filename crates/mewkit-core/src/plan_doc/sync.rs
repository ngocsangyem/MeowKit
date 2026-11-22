//! `plan sync <plan-dir|plan.md> [--check] [--json]` — bring a plan's DERIVED
//! state in line with its checkboxes.
//!
//! The boxes in each phase's `## Todo List` are the one thing a human (or the
//! agent working for them) authors. Everything else that restates progress is
//! derived from them and rewritten here: each phase's frontmatter `status:`,
//! its `**Status:**` Overview line, the plan.md Phases-table cell for the
//! phase, the plan.md frontmatter `status:`, and `.plan-state.json`. Sync never
//! ticks or unticks a box, never archives and never moves a file.
//!
//! A phase whose status a human set (`failed`, `abandoned`, `active`) or that
//! has no todos keeps its status; its checkpoint task counts still follow the
//! boxes, because they are facts. Running sync twice changes nothing the second
//! time. The hook core `plan-state-sync.cjs` applies the same rule.
use std::collections::BTreeMap;
use std::path::Path;

use serde::Serialize;

use super::Output;
use super::archive::{PHASE_FILE, resolve_plan_dir};
use super::phase_structure::count_checkboxes;
use super::sync_fields::{
    KEPT, PLAN_KEPT, derive, frontmatter_status, norm, rewrite_overview, rewrite_table_cell,
};
use super::sync_plan_state::{self, PlanState};

/// One derived value that differs from what the checkboxes imply.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct SyncChange {
    pub file: String,
    pub field: String,
    pub from: String,
    pub to: String,
}

/// What a sync found (and, unless it was a check, wrote).
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct SyncReport {
    pub plan: String,
    pub dir: String,
    pub changes: Vec<SyncChange>,
    /// Every phase that is not abandoned is completed, and there is one.
    pub complete: bool,
}

fn change(file: &str, field: &str, from: &str, to: &str) -> SyncChange {
    SyncChange {
        file: file.to_string(),
        field: field.to_string(),
        from: from.to_string(),
        to: to.to_string(),
    }
}

fn phase_files(plan_dir: &Path) -> Vec<String> {
    let mut names: Vec<String> = std::fs::read_dir(plan_dir)
        .map(|entries| {
            entries
                .filter_map(Result::ok)
                .map(|e| e.file_name().to_string_lossy().into_owned())
                .filter(|name| PHASE_FILE.is_match(name))
                .collect()
        })
        .unwrap_or_default();
    names.sort();
    names
}

/// Derive and (when `write`) apply every change for the plan in `plan_dir`.
/// Returns the changes and whether the plan is complete.
pub(super) fn sync_plan(plan_dir: &Path, write: bool) -> std::io::Result<(Vec<SyncChange>, bool)> {
    let mut changes = Vec::new();
    let mut files: BTreeMap<String, String> = BTreeMap::new();
    let mut plan_text = std::fs::read_to_string(plan_dir.join("plan.md")).ok();
    let mut state = PlanState::load(&plan_dir.join(sync_plan_state::FILE));
    let mut effective: Vec<String> = Vec::new();

    for file in phase_files(plan_dir) {
        let Ok(mut text) = std::fs::read_to_string(plan_dir.join(&file)) else {
            continue;
        };
        let key = file.trim_end_matches(".md");
        let digits: String = key
            .trim_start_matches("phase-")
            .chars()
            .take_while(char::is_ascii_digit)
            .collect();
        let short = if key.starts_with("phase-") && !digits.is_empty() {
            format!("phase-{digits}")
        } else {
            key.to_string()
        };
        let num = digits.parse::<f64>().ok();
        // The Todo List section is the same in either line ending.
        let (total, checked) = count_checkboxes(&text.replace("\r\n", "\n"));
        let fm = frontmatter_status(&text);
        let current = fm.as_ref().map(|f| norm(&f.value)).unwrap_or_default();
        let kept = KEPT.contains(&current.as_str());
        let mut derived = None;
        if total == 0 || kept {
            effective.push(current.clone());
        } else {
            let status = derive(checked, total);
            derived = Some(status);
            effective.push(status.to_string());
            let before = text.clone();
            if let Some(fm) = fm.as_ref().filter(|_| current != status) {
                changes.push(change(&file, "status", &fm.value, status));
                text = fm.set(&text, status);
            }
            if let Some(r) = rewrite_overview(&text, status) {
                changes.push(change(&file, "overview-status", &r.from, &r.to));
                text = r.content;
            }
            if text != before {
                files.insert(file.clone(), text);
            }
            if let Some(r) = plan_text
                .as_deref()
                .and_then(|p| rewrite_table_cell(p, &file, num, status))
            {
                changes.push(change(
                    "plan.md",
                    &format!("table-status:{short}"),
                    &r.from,
                    &r.to,
                ));
                files.insert("plan.md".to_string(), r.content.clone());
                plan_text = Some(r.content);
            }
        }
        if let Some(state) = state.as_mut().filter(|_| total > 0) {
            let status = if kept { None } else { derived };
            state.update(key, (checked, total), status, &mut changes);
        }
    }

    let counted: Vec<&String> = effective.iter().filter(|s| *s != "abandoned").collect();
    let complete = !counted.is_empty() && counted.iter().all(|s| *s == "completed");
    let moved = effective.iter().any(|s| !s.is_empty() && s != "pending");
    if let Some(plan) = plan_text.as_deref()
        && let Some(fm) = frontmatter_status(plan)
        && moved
        && !PLAN_KEPT.contains(&norm(&fm.value).as_str())
    {
        let target = if complete { "completed" } else { "in-progress" };
        if norm(&fm.value) != norm(target) {
            changes.push(change("plan.md", "status", &fm.value, target));
            files.insert("plan.md".to_string(), fm.set(plan, target));
        }
    }
    if let Some(state) = &state
        && changes.iter().any(|c| c.file == sync_plan_state::FILE)
    {
        files.insert(sync_plan_state::FILE.to_string(), state.render());
    }
    if write {
        for (name, text) in &files {
            std::fs::write(plan_dir.join(name), text)?;
        }
    }
    Ok((changes, complete))
}

/// True when the plan's derived state is behind its checkboxes. Read-only.
pub(super) fn has_drift(plan_dir: &Path) -> bool {
    plan_dir.join("plan.md").is_file()
        && sync_plan(plan_dir, false).is_ok_and(|(c, _)| !c.is_empty())
}

pub fn plan_sync(project_root: &Path, target: Option<&str>, check: bool, json: bool) -> Output {
    let Some(target) = target else {
        return Output::code(1, "plan sync: missing <plan-dir>");
    };
    let project_root = project_root
        .canonicalize()
        .unwrap_or_else(|_| project_root.to_path_buf());
    let plan_dir = match resolve_plan_dir(&project_root, target) {
        Ok(dir) => dir,
        Err(problem) => return Output::code(1, format!("plan sync: {problem}")),
    };
    let (changes, complete) = match sync_plan(&plan_dir, !check) {
        Ok(result) => result,
        Err(error) => return Output::code(1, format!("plan sync: {error}")),
    };
    let report = SyncReport {
        plan: plan_dir
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default(),
        dir: plan_dir
            .strip_prefix(&project_root)
            .map(|r| r.to_string_lossy().replace('\\', "/"))
            .unwrap_or_else(|_| plan_dir.to_string_lossy().into_owned()),
        complete,
        changes,
    };
    let code = u8::from(check && !report.changes.is_empty());
    let stdout = if json {
        serde_json::to_string_pretty(&report).unwrap_or_default()
    } else {
        super::render::render_sync(&report, check)
    };
    Output::code(code, stdout)
}

#[cfg(test)]
#[path = "sync_tests.rs"]
mod tests;
