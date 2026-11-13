//! The post-migration quality gate for a GENERATED Codex project. Read-only.
//!
//! It validates the TARGET's own artifacts and never reads the source
//! `.claude/`: a fresh, correct Codex projection passes every row, and a broken
//! one fails the specific row by name. Port of
//! `validate/targets/codex-target.ts`.
use std::path::Path;

use serde_json::Value;

use super::result::{CheckResult, Status};
use super::target_codex_agents::check_agents;
use super::target_codex_config::check_config;
use super::target_codex_hooks::hooks_wrapper_rows;
use super::target_codex_rules::check_legacy_surfaces;
use super::target_codex_rules::check_rules;
use super::target_codex_skills::check_skills;
use super::target_helpers::{reference_graph_rows, row};

/// `.codex/` or a projected skills tree: the cheap layout sniff.
pub fn detects(dir: &Path) -> bool {
    dir.join(".codex").exists() || dir.join(".agents").join("skills").exists()
}

pub fn check(dir: &Path) -> Vec<CheckResult> {
    let mut results = vec![if dir.join("AGENTS.md").exists() {
        row(
            "Codex AGENTS.md present",
            Status::Pass,
            "instruction surface exists".to_string(),
        )
    } else {
        row(
            "Codex AGENTS.md present",
            Status::Fail,
            format!("Missing: {}", dir.join("AGENTS.md").display()),
        )
    }];
    results.extend(check_config(dir));
    results.extend(check_hooks(dir));
    results.extend(check_agents(dir));
    results.extend(reference_graph_rows(dir));
    results.extend(check_rules(dir));
    results.extend(check_skills(dir));
    results.extend(check_legacy_surfaces(dir));
    results
}

/// `hooks.json` parses, its wrappers exist and are executable, and at least one
/// wrapper actually gates a permission event.
fn check_hooks(dir: &Path) -> Vec<CheckResult> {
    let hooks_path = dir.join(".codex").join("hooks.json");
    if !hooks_path.exists() {
        return vec![row(
            "Codex hooks.json present",
            Status::Warn,
            format!(
                "No hooks.json at {} (target has no hooks)",
                hooks_path.display()
            ),
        )];
    }
    let text = std::fs::read(&hooks_path)
        .map(|bytes| String::from_utf8_lossy(&bytes).into_owned())
        .unwrap_or_default();
    let parsed: Value = match serde_json::from_str(&text) {
        Ok(parsed) => parsed,
        Err(error) => {
            return vec![row(
                "Codex hooks.json parses",
                Status::Fail,
                format!("JSON parse error: {error}"),
            )];
        }
    };
    let mut out = vec![row(
        "Codex hooks.json parses",
        Status::Pass,
        "valid JSON".to_string(),
    )];
    let mut commands = Vec::new();
    if let Some(groups) = parsed.get("hooks").and_then(Value::as_object) {
        for group in groups.values() {
            for entry in group.as_array().into_iter().flatten() {
                for hook in entry
                    .get("hooks")
                    .and_then(Value::as_array)
                    .into_iter()
                    .flatten()
                {
                    for key in ["command", "commandWindows"] {
                        if let Some(command) = hook.get(key).and_then(Value::as_str) {
                            commands.push(command.to_string());
                        }
                    }
                }
            }
        }
    }
    out.extend(hooks_wrapper_rows(dir, &commands));
    out
}
