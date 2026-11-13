//! Is the install THERE: the directories, the always-on rules, the config.
//!
//! Every row here is consumer-actionable — a flat-copy install is as broken
//! without `agents/` or without `rules/injection-rules.md` as the source
//! checkout is, so these run in both modes.
use std::path::Path;

use crate::config::{ConfigScope, load_config_file, observer_names};

use super::result::{CheckResult, Section, Status, display_join, ok};

/// The `.claude/rules/*.md` files a session auto-loads on every turn, in load
/// order. Mirrors `core/always-on-rules.ts`: each file carries enforcement no
/// other file repeats, so a missing one silently drops it.
pub const ALWAYS_ON_RULES: [&str; 7] = [
    "meowkit-core.md",
    "security-rules.md",
    "injection-rules.md",
    "gate-rules.md",
    "core-behaviors.md",
    "development-rules.md",
    "agent-conduct.md",
];

/// The same set as `.claude/`-relative paths.
pub fn always_on_rule_paths() -> Vec<String> {
    ALWAYS_ON_RULES
        .iter()
        .map(|file| format!("rules/{file}"))
        .collect()
}

pub fn check_file_exists(base_dir: &Path, relative: &str, section: Section) -> CheckResult {
    let full = display_join(base_dir, relative);
    let exists = Path::new(&full).exists();
    CheckResult::new(
        format!("File exists: {relative}"),
        ok(exists),
        if exists {
            full
        } else {
            format!("Missing: {full}")
        },
        section,
    )
}

pub fn check_dir_exists(meowkit_dir: &Path, relative: &str) -> CheckResult {
    let full = display_join(meowkit_dir, relative);
    let exists = Path::new(&full).is_dir();
    CheckResult::new(
        format!("Directory exists: {relative}"),
        ok(exists),
        if exists {
            full
        } else {
            format!("Missing: {full}")
        },
        Section::Structure,
    )
}

/// `<root>/.meowkit/config.yaml` — the only config path.
fn config_write_path(project_root: &Path) -> std::path::PathBuf {
    project_root.join(".meowkit").join("config.yaml")
}

/// True when the project still carries the v2 install descriptor and not yet the
/// committed config, which is an upgrade to run rather than a defect.
fn migration_pending(project_root: &Path) -> bool {
    if config_write_path(project_root).exists() {
        return false;
    }
    [
        [".meowkit", "config.json"],
        [".claude", "meowkit.config.json"],
    ]
    .iter()
    .any(|rel| project_root.join(rel[0]).join(rel[1]).exists())
}

/// The committed project config, validated by the one reader.
///
/// An ABSENT config is a WARN, not a failure: a project with no config runs on
/// its defaults, and one that still has the v2 descriptor has an upgrade to run.
/// `meowkit_dir` is the provider install dir; the config lives beside it.
pub fn check_config(meowkit_dir: &Path) -> CheckResult {
    let name = "Project config valid";
    let root = meowkit_dir.parent().unwrap_or(meowkit_dir);
    let config_path = config_write_path(root);
    let shown = config_path.display().to_string();
    if !config_path.exists() {
        let detail = if migration_pending(root) {
            format!("{shown} absent — the v2 descriptor is still in place; run `mewkit upgrade`")
        } else {
            format!("{shown} absent — every setting is at its default")
        };
        return CheckResult::new(name, Status::Warn, detail, Section::Structure);
    }
    match load_config_file(
        &config_path,
        &observer_names(root),
        ConfigScope::ProjectConfig,
    ) {
        Ok(_) => CheckResult::new(name, Status::Pass, shown, Section::Structure),
        Err(failure) => CheckResult::new(
            name,
            Status::Fail,
            format!("{} [{}]", failure.message, failure.code),
            Section::Structure,
        ),
    }
}

#[cfg(test)]
#[path = "structure_tests.rs"]
mod structure_tests;
