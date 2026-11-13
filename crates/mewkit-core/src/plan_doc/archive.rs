//! `plan archive <plan-dir|plan.md>` — finish and archive a plan. Port of
//! `commands/plan-archive.ts`.
//!
//! What it does, in order:
//!   1. Stamp `status: completed` across `plan.md` and every `phase-*.md`
//!      frontmatter, and every `phases[*].status` in `.plan-state.json` (the
//!      plan-creator checkpoint).
//!   2. Clear a dangling active-task pointer that still points at this plan.
//!   3. Move the whole plan directory into `tasks/plans/archive/<name>/`.
//!
//! Every other `.plan-state.json` key and every other file in the plan dir is
//! preserved verbatim and travels with the directory. Only per-phase `status`
//! fields are rewritten.
use std::path::{Path, PathBuf};
use std::sync::LazyLock;

use regex::Regex;

use super::archive_writes::{
    clear_pointer_if_here, mark_plan_state_completed, set_frontmatter_status_completed,
};
use super::{Output, resolve_against};

static PHASE_FILE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^phase-.*\.md$").expect("static phase filename pattern"));

struct Report {
    plan_dir: PathBuf,
    dest: PathBuf,
    plan_md_updated: bool,
    phases_updated: usize,
    phase_files_total: usize,
    plan_state_updated: bool,
    pointer_cleared: bool,
}

/// Resolve a plan directory from a dir path or a `plan.md` path. The result is
/// symlink-resolved, so the containment check below compares like with like.
fn resolve_plan_dir(project_root: &Path, target: &str) -> Result<PathBuf, String> {
    let resolved = resolve_against(project_root, target);
    if !resolved.exists() {
        return Err(format!("not found: {target}"));
    }
    let dir = if resolved.is_dir() {
        resolved
    } else {
        resolved.parent().unwrap_or(Path::new(".")).to_path_buf()
    };
    if !dir.join("plan.md").exists() {
        return Err(format!(
            "no plan.md in {} — not a plan directory",
            dir.display()
        ));
    }
    Ok(dir.canonicalize().unwrap_or(dir))
}

fn render(report: &Report, project_root: &Path, dry_run: bool) -> String {
    let rel = |p: &Path| {
        p.strip_prefix(project_root)
            .map(|r| r.to_string_lossy().replace('\\', "/"))
            .unwrap_or_else(|_| p.to_string_lossy().into_owned())
    };
    let mut out = vec![
        if dry_run {
            "Plan archive (dry-run)".to_string()
        } else {
            "Plan archived".to_string()
        },
        format!("  plan:    {}", rel(&report.plan_dir)),
        format!("  → dest:  {}", rel(&report.dest)),
        format!(
            "  plan.md: {}",
            if report.plan_md_updated {
                "status → completed"
            } else {
                "no status field"
            }
        ),
        format!(
            "  phases:  {}/{} set to completed",
            report.phases_updated, report.phase_files_total
        ),
    ];
    if report.plan_state_updated {
        out.push(
            "  .plan-state.json: phase statuses → completed (other keys preserved)".to_string(),
        );
    }
    if report.pointer_cleared {
        out.push("  active pointer: cleared".to_string());
    }
    if dry_run {
        out.push("\n  (dry-run — no files written or moved)".to_string());
    }
    out.join("\n")
}

pub fn plan_archive(project_root: &Path, target: Option<&str>, dry_run: bool) -> Output {
    let Some(target) = target else {
        return Output::code(1, "plan archive: missing <plan-dir>");
    };
    // The canonical project root so the containment check compares
    // symlink-resolved paths — `/var` versus `/private/var` otherwise.
    let project_root = project_root
        .canonicalize()
        .unwrap_or_else(|_| project_root.to_path_buf());
    let archive_root = project_root.join("tasks").join("plans").join("archive");

    let plan_dir = match resolve_plan_dir(&project_root, target) {
        Ok(dir) => dir,
        Err(problem) => return Output::code(1, format!("plan archive: {problem}")),
    };

    let name = plan_dir
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    // Already under archive/ → nothing to do (idempotent, not an error).
    if plan_dir.starts_with(&archive_root) {
        return Output::code(
            0,
            format!("plan archive: {name} is already archived — nothing to do."),
        );
    }
    let dest = archive_root.join(&name);
    if dest.exists() {
        let shown = dest
            .strip_prefix(&project_root)
            .map(|r| r.to_string_lossy().replace('\\', "/"))
            .unwrap_or_else(|_| dest.to_string_lossy().into_owned());
        return Output::code(
            1,
            format!("plan archive: {shown} already exists — refusing to overwrite."),
        );
    }

    let mut phase_files: Vec<String> = std::fs::read_dir(&plan_dir)
        .map(|entries| {
            entries
                .filter_map(Result::ok)
                .map(|e| e.file_name().to_string_lossy().into_owned())
                .filter(|name| PHASE_FILE.is_match(name))
                .collect()
        })
        .unwrap_or_default();
    phase_files.sort();
    let plan_md_updated = set_frontmatter_status_completed(&plan_dir.join("plan.md"), !dry_run);
    let phases_updated = phase_files
        .iter()
        .filter(|file| set_frontmatter_status_completed(&plan_dir.join(file), !dry_run))
        .count();
    let plan_state_updated =
        mark_plan_state_completed(&plan_dir.join(".plan-state.json"), !dry_run);
    let pointer_cleared = clear_pointer_if_here(&project_root, &name, !dry_run);

    if !dry_run
        && let Err(error) =
            std::fs::create_dir_all(&archive_root).and_then(|()| std::fs::rename(&plan_dir, &dest))
    {
        return Output::code(1, format!("plan archive: {error}"));
    }
    Output::code(
        0,
        render(
            &Report {
                plan_dir,
                dest,
                plan_md_updated,
                phases_updated,
                phase_files_total: phase_files.len(),
                plan_state_updated,
                pointer_cleared,
            },
            &project_root,
            dry_run,
        ),
    )
}

#[cfg(test)]
#[path = "archive_tests.rs"]
mod tests;
