//! The gate-authority scan as rows, over a tree of prose.
//!
//! `root` is the directory the scan is relative to and `scan_dirs` are subtrees
//! within it — the same function serves the canonical `.claude` tree and a
//! generated one, which is how canonical↔projection parity is proved.
use std::path::Path;

use super::gate_authority::{GateAuthorityViolation, scan_for_gate_authority};
use super::result::{CheckResult, Section, Status};

/// Every `.md` file under `dir`, relative to `root`, as `/`-joined paths.
fn collect_markdown(root: &Path, dir: &str, acc: &mut Vec<String>) {
    let abs = dir.split('/').fold(root.to_path_buf(), |a, p| a.join(p));
    for entry in super::dir_order::sorted_entries(&abs) {
        let name = entry.file_name().to_string_lossy().into_owned();
        let rel = format!("{dir}/{name}");
        if entry.path().is_dir() {
            if name == "node_modules" || name.starts_with(".git") {
                continue;
            }
            collect_markdown(root, &rel, acc);
        } else if entry.path().is_file() && name.ends_with(".md") {
            acc.push(rel);
        }
    }
}

/// Run the check over a tree of prose. `scan_dirs` are subtrees of `root`;
/// the default is the canonical `.claude` tree.
pub fn check_gate_authority(
    root: &Path,
    scan_dirs: &[&str],
    missing_root_severity: Status,
) -> Vec<CheckResult> {
    let present: Vec<&str> = scan_dirs
        .iter()
        .copied()
        .filter(|dir| {
            dir.split('/')
                .fold(root.to_path_buf(), |a, p| a.join(p))
                .exists()
        })
        .collect();

    if present.is_empty() {
        return vec![CheckResult::new(
            "Gate-authority scan target",
            missing_root_severity,
            format!(
                "No scan target found under {}: {}",
                root.display(),
                scan_dirs.join(", ")
            ),
            Section::Gates,
        )];
    }

    let mut files = Vec::new();
    for dir in &present {
        collect_markdown(root, dir, &mut files);
    }
    let violations: Vec<GateAuthorityViolation> = files
        .iter()
        .flat_map(|rel| scan_for_gate_authority(root, rel))
        .collect();

    if violations.is_empty() {
        return vec![CheckResult::new(
            "No automated gate-approval claims",
            Status::Pass,
            format!(
                "{} prose files scanned across {}",
                files.len(),
                present.join(", ")
            ),
            Section::Gates,
        )];
    }

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
    vec![CheckResult::new(
        format!("Automated gate-approval claims ({})", violations.len()),
        Status::Fail,
        detail,
        Section::Gates,
    )]
}
