//! The opt-in diagnostics: `--state` (the state taxonomy), `--providers` (what
//! each provider adapter can enforce) and the shareable `--report` block.
//!
//! `--providers` reports the adapter truth `providers --lifecycle` prints,
//! because that is what this binary projects. The npm CLI's per-surface
//! contract diagnostics come from its retired migrate layer and are not
//! ported; that difference is on purpose.
use std::path::Path;

use mewkit_core::capability::adapter::{ADAPTED_PROVIDERS, describe_provider};
use mewkit_core::state_paths::{LEGACY_SESSION_STATE_RELS, StateClass, resolve_state_dir};
use mewkit_core::time_utc::now_millis;

use super::{Check, Status};

/// The project root the npm CLI's doctor uses: the working directory when it
/// looks like a MeowKit project, with no walk up to a parent project.
pub fn project_root() -> Option<std::path::PathBuf> {
    let cwd = std::env::current_dir().ok()?;
    let looks_like_project = cwd.join(".claude").exists()
        || cwd.join(".meowkit/config.yaml").exists()
        || cwd.join(".claude/meowkit.manifest.json").exists()
        || cwd.join("CLAUDE.md").exists();
    looks_like_project.then_some(cwd)
}

pub fn state_checks(root: Option<&Path>) -> Vec<Check> {
    let Some(root) = root else {
        return vec![Check::new(
            "State taxonomy",
            Status::Warn,
            "Project root not found; skipped state path checks.",
        )];
    };
    let has_legacy = LEGACY_SESSION_STATE_RELS.iter().any(|rel| {
        rel.split('/')
            .fold(root.to_path_buf(), |acc, part| acc.join(part))
            .exists()
    });
    vec![
        Check::new(
            "Runtime state directory",
            if resolve_state_dir(root, StateClass::State).exists() {
                Status::Ok
            } else {
                Status::Warn
            },
            "Ephemeral session markers use .meowkit/state/.",
        ),
        // Pre-move locations are still READ, so residue is not a failure: it is
        // a directory that will never be written again and is safe to delete.
        Check::new(
            "Pre-move session state",
            if has_legacy { Status::Warn } else { Status::Ok },
            "session-state/ and .claude/session-state/ are read-only leftovers; move anything you need into .meowkit/state/ and delete them.",
        ),
    ]
}

/// One row per adapted provider: ok when it can gate on something, warn when
/// it can gate on nothing, with the safety events it cannot guarantee named.
pub fn provider_checks() -> Vec<Check> {
    ADAPTED_PROVIDERS
        .iter()
        .map(|provider| {
            let view = describe_provider(provider);
            let gaps: Vec<&str> = view.enforcement_gaps.iter().map(|g| g.event).collect();
            let name = format!("Provider adapter: {provider}");
            if view.gating_events.is_empty() {
                Check::new(name, Status::Warn, format!(
                    "{}: no proven deny/block, so no safety hook is enforced; cannot guarantee a block on {} (see `mewkit-next providers {provider} --lifecycle`)",
                    view.projection.status, gaps.join(", ")
                ))
            } else {
                let note = if gaps.is_empty() { String::new() } else { format!("; cannot guarantee a block on {}", gaps.join(", ")) };
                Check::new(name, Status::Ok, format!("{}: gates on {}{note}", view.projection.status, view.gating_events.join(", ")))
            }
        })
        .collect()
}

/// The shareable report block, ready to paste into an issue.
pub fn report(checks: &[Check], project: Option<&Path>) -> String {
    let tag = |s: Status| match s {
        Status::Ok => "OK",
        Status::Warn => "WARN",
        Status::Fail => "FAIL",
    };
    let count = |s: Status| checks.iter().filter(|c| c.status == s).count();
    let mut lines = vec![
        "# MeowKit Doctor Report".to_string(),
        format!("Date: {}", mewkit_core::snapshot::iso_millis(now_millis())),
        format!("Version: {}", mewkit_core::VERSION),
        format!(
            "Platform: {} {}",
            std::env::consts::OS,
            std::env::consts::ARCH
        ),
        format!(
            "Project: {}",
            project.map_or("not found".to_string(), |p| p.display().to_string())
        ),
        String::new(),
        "## Results".to_string(),
    ];
    lines.extend(
        checks
            .iter()
            .map(|c| format!("- [{}] {}: {}", tag(c.status), c.name, c.detail)),
    );
    lines.push(String::new());
    lines.push(format!(
        "## Summary: {} passed, {} warnings, {} failed",
        count(Status::Ok),
        count(Status::Warn),
        count(Status::Fail)
    ));
    lines.join("\n")
}
