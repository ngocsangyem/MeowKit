//! The generated Codex agents: Codex identifies a custom agent by its `name`
//! field and AUTO-LOADS every `.codex/agents/*.toml`, so a missing or duplicate
//! name makes the agent selector ambiguous.
use std::path::Path;

use serde_json::Value;

use super::result::{CheckResult, Status};
use super::target_helpers::{list_files, parse_toml, row};

/// Agent TOMLs parse, each declares a name (its auto-load identity), carries
/// the two required fields, and no name is used twice.
pub(super) fn check_agents(dir: &Path) -> Vec<CheckResult> {
    let files = list_files(&dir.join(".codex").join("agents"), ".toml");
    if files.is_empty() {
        // A target with no agents is valid.
        return Vec::new();
    }
    let mut broken = Vec::new();
    let mut nameless = Vec::new();
    let mut missing_fields = Vec::new();
    let mut names: Vec<(String, Vec<String>)> = Vec::new();

    for file in &files {
        let base = file
            .file_name()
            .map(|name| name.to_string_lossy().into_owned())
            .unwrap_or_default();
        let Ok(parsed) = parse_toml(file) else {
            broken.push(base);
            continue;
        };
        let name = parsed
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .trim()
            .to_string();
        if name.is_empty() {
            nameless.push(base);
            continue;
        }
        match names.iter_mut().find(|(known, _)| *known == name) {
            Some((_, files)) => files.push(base.clone()),
            None => names.push((name, vec![base.clone()])),
        }
        let missing: Vec<&str> = ["description", "developer_instructions"]
            .iter()
            .copied()
            .filter(|key| {
                !parsed
                    .get(*key)
                    .and_then(Value::as_str)
                    .is_some_and(|text| !text.trim().is_empty())
            })
            .collect();
        if !missing.is_empty() {
            missing_fields.push(format!("{base} ({})", missing.join(", ")));
        }
    }

    let mut out = vec![if broken.is_empty() {
        row(
            "Codex agent TOMLs parse",
            Status::Pass,
            format!("{} agent file(s) parse", files.len()),
        )
    } else {
        row(
            "Codex agent TOMLs parse",
            Status::Fail,
            format!("parse errors in: {}", broken.join(", ")),
        )
    }];
    out.push(if nameless.is_empty() {
        row(
            "Codex agent name field",
            Status::Pass,
            "every agent declares a name (auto-load identity)".to_string(),
        )
    } else {
        row(
            "Codex agent name field",
            Status::Fail,
            format!("missing name field: {}", nameless.join(", ")),
        )
    });
    out.push(if missing_fields.is_empty() {
        row(
            "Codex agent required fields",
            Status::Pass,
            "every agent declares description + developer_instructions".to_string(),
        )
    } else {
        row(
            "Codex agent required fields",
            Status::Fail,
            format!("missing required field(s): {}", missing_fields.join("; ")),
        )
    });
    let duplicates: Vec<String> = names
        .iter()
        .filter(|(_, files)| files.len() > 1)
        .map(|(name, files)| format!("\"{name}\" in {}", files.join(", ")))
        .collect();
    out.push(if duplicates.is_empty() {
        row(
            "Codex agent name uniqueness",
            Status::Pass,
            format!(
                "{} unique auto-loaded agent name(s); no config.toml wiring needed",
                names.len()
            ),
        )
    } else {
        row(
            "Codex agent name uniqueness",
            Status::Fail,
            format!("duplicate agent name(s): {}", duplicates.join("; ")),
        )
    });
    out
}
