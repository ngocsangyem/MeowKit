//! The drift check as rows: one per prose source, or one failure for a spec
//! that cannot load.
use std::path::Path;

use super::result::{CheckResult, Section, Status};
use super::workflow_drift::scan_for_violations;
use super::workflow_spec::SpecErrorKind;
use super::workflow_spec_load::load_workflow_spec;

/// The full drift check: a hard FAIL when the spec cannot load, then a row per
/// source.
pub fn check_workflow_drift(
    project_root: &Path,
    missing_spec_severity: Status,
) -> Vec<CheckResult> {
    let spec = match load_workflow_spec(project_root) {
        Ok(spec) => spec,
        Err(error) => {
            // A wholly-absent spec may downgrade to WARN (an un-upgraded
            // install); a present-but-broken spec is always a FAIL.
            let status = if error.kind == SpecErrorKind::Missing {
                missing_spec_severity
            } else {
                Status::Fail
            };
            let detail = if error.kind == SpecErrorKind::Missing && status == Status::Warn {
                format!("{} — run `mewkit upgrade` to install it", error.message)
            } else {
                error.message
            };
            return vec![CheckResult::new(
                "Workflow spec loads",
                status,
                detail,
                Section::Workflow,
            )];
        }
    };

    spec.sources
        .iter()
        .map(|source| {
            let violations =
                scan_for_violations(&spec, project_root, &source.path, source.lifecycle_render);
            if violations.is_empty() {
                CheckResult::new(
                    format!("No drift: {}", source.path),
                    Status::Pass,
                    source.path.clone(),
                    Section::Workflow,
                )
            } else {
                let detail = violations
                    .iter()
                    .map(|v| {
                        format!(
                            "{}:{} found \"{}\" — expected \"{}\"",
                            v.file, v.line, v.found, v.expected
                        )
                    })
                    .collect::<Vec<_>>()
                    .join("\n         ");
                CheckResult::new(
                    format!("Drift in {}", source.path),
                    Status::Fail,
                    detail,
                    Section::Workflow,
                )
            }
        })
        .collect()
}
