//! The `plan` verb: the plan MARKDOWN as the sole authority.
//!
//! Named `plan_doc` because [`crate::plan`] is already the installer's change
//! plan — a different noun entirely. This module is about the planning
//! DOCUMENT under `tasks/plans/YYMMDD-name/`.
//!
//! Four subcommands, two of them read-only:
//!
//! | subcommand | effect |
//! |---|---|
//! | `status`  | progress across `plan.md` + its phase files |
//! | `check`   | required sections for one phase, or `--structural` for the whole plan |
//! | `approve` | stamp the Gate 1 approval receipt, optionally activating the task |
//! | `archive` | complete every status and move the plan under `tasks/plans/archive/` |
//!
//! `status` and `check` are read-only BY CONSTRUCTION: [`parser`],
//! [`frontmatter_scan`], [`phase_structure`], [`phase_frontmatter`],
//! [`structure_check`] and [`render`] import no write API.
//! The moment a CLI can edit a plan, the plan has two authors and the
//! checkboxes stop meaning what the human meant by them. The mutating pair
//! lives in [`approve`] and [`archive`], named so a reader can see which is
//! which.
//!
//! Every entry point returns an [`Output`] rather than printing: the CLI owns
//! the streams, and a renderer that returns text is testable without a TTY.
mod approve;
mod archive;
mod archive_writes;
mod frontmatter_scan;
mod parser;
mod phase_frontmatter;
mod phase_structure;
mod receipt;
mod render;
mod structure_check;

use std::path::{Path, PathBuf};

pub use approve::{ApproveOptions, plan_approve};
pub use archive::plan_archive;
pub use parser::{
    PhaseChecklist, PhaseFile, PlanSummary, REQUIRED_PHASE_SECTIONS, list_phase_files,
    parse_phase_file, parse_plan,
};
/// One phase file against the full template, for a caller holding the content
/// already. [`check_plan_structure`] is the whole-directory entry point.
pub use phase_structure::check_phase_file;
pub use receipt::{
    FRESH, NO_RECEIPT, Receipt, STALE, UNREADABLE, plan_body, plan_hash, stamp, verify,
};
/// The structural check `validate` also runs. It is public for that caller:
/// one implementation of the Gate 1 structure rules, not two.
pub use structure_check::{PlanStructureReport, check_plan_structure, render_plan_structure};

/// What a `plan` subcommand produced: the two streams and the exit code.
///
/// The npm CLI prints its own errors to STDOUT and sets `process.exitCode`,
/// rather than throwing — so a failed `plan status` is a normal line on stdout,
/// not a diagnostic on stderr. That is the contract callers read, so it is
/// reproduced here instead of being tidied up.
#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct Output {
    pub stdout: String,
    pub stderr: String,
    pub code: u8,
}

impl Output {
    pub fn code(code: u8, stdout: impl Into<String>) -> Self {
        Self {
            stdout: stdout.into(),
            stderr: String::new(),
            code,
        }
    }

    /// Append one line to stdout.
    pub fn push(&mut self, line: impl AsRef<str>) {
        if !self.stdout.is_empty() {
            self.stdout.push('\n');
        }
        self.stdout.push_str(line.as_ref());
    }
}

/// `path.resolve(target)` relative to the project root: an absolute target wins,
/// a relative one joins.
fn resolve_against(project_root: &Path, target: &str) -> PathBuf {
    let path = Path::new(target);
    if path.is_absolute() {
        return path.to_path_buf();
    }
    project_root.join(path)
}

/// `plan status <plan-dir>` — progress across `plan.md` and its phase files.
///
/// It reports; it does not judge. A plan with observations is not a failed
/// command: the exit code is non-zero only when the plan could not be read.
pub fn plan_status(project_root: &Path, target: Option<&str>, json: bool) -> Output {
    let Some(target) = target else {
        return Output::code(1, "plan status: missing <plan-dir>");
    };
    let resolved = resolve_against(project_root, target);
    match parse_plan(&resolved) {
        Err(error) => Output::code(1, format!("plan status: {error}")),
        Ok(summary) if json => Output::code(
            0,
            serde_json::to_string_pretty(&summary).unwrap_or_default(),
        ),
        Ok(summary) => Output::code(0, render::render_status(&summary)),
    }
}

/// `plan check <phase-file>`, or `plan check --structural <plan.md|plan-dir>`.
pub fn plan_check(
    project_root: &Path,
    target: Option<&str>,
    json: bool,
    structural: bool,
) -> Output {
    let Some(target) = target else {
        return Output::code(1, "plan check: missing <phase-file>");
    };
    let resolved = resolve_against(project_root, target);
    if structural {
        let report = check_plan_structure(&resolved);
        let stdout = if json {
            serde_json::to_string_pretty(&report).unwrap_or_default()
        } else {
            render_plan_structure(&report).join("\n")
        };
        return Output::code(u8::from(!report.complete), stdout);
    }
    match parse_phase_file(&resolved) {
        Err(error) => Output::code(1, format!("plan check: {error}")),
        Ok(phase) => {
            // The human report prints first and the JSON follows it, which is
            // what `--json` does here: the npm CLI renders both.
            let mut out = Output::code(
                u8::from(!phase.missing_sections.is_empty()),
                render::render_check(&phase, &resolved.to_string_lossy()),
            );
            if json {
                out.push(serde_json::to_string_pretty(&phase).unwrap_or_default());
            }
            out
        }
    }
}
