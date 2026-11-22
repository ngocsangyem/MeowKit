//! `validate --skill-rubric`: score every skill and write the report.
//!
//! A run of its own rather than a row in the default run: the rows record
//! where each skill stands and gate nothing, so they stay out of the report
//! CI and the pre-ship hook read.
use std::path::{Path, PathBuf};

use mewkit_core::validate::{CheckResult, score_skills, skill_rubric_report, skill_rubric_rows};

use crate::failure::Failure;

/// Where the report goes when no path is given. `.meowkit/telemetry/` is
/// machine-local and git-ignored, so a run never dirties the tree.
const DEFAULT_REPORT_REL: &str = ".meowkit/telemetry/skill-rubric.json";

/// Score the skills, write the JSON report and return the rows to print.
pub(super) fn skill_rubric_run(
    report_path: Option<&Path>,
    meowkit_dir: &Path,
    project_root: &Path,
) -> Result<Vec<CheckResult>, Failure> {
    let rows = score_skills(meowkit_dir);
    let path: PathBuf =
        report_path.map_or_else(|| project_root.join(DEFAULT_REPORT_REL), Path::to_path_buf);
    let body = serde_json::to_string_pretty(&skill_rubric_report(&rows)).map_err(|e| {
        Failure::failed(format!("could not serialise the skill rubric report: {e}"))
    })?;
    if let Some(dir) = path.parent().filter(|d| !d.as_os_str().is_empty()) {
        std::fs::create_dir_all(dir)
            .map_err(|e| Failure::failed(format!("could not create {}: {e}", dir.display())))?;
    }
    std::fs::write(&path, format!("{body}\n"))
        .map_err(|e| Failure::failed(format!("could not write {}: {e}", path.display())))?;
    println!(
        "Skill rubric report: {} ({} skills)",
        path.display(),
        rows.len()
    );
    println!();
    Ok(skill_rubric_rows(&rows))
}
