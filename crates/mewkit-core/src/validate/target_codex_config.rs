//! The generated Codex `config.toml`: it parses, its refs resolve, and no
//! secret-like key carries a value.
use serde_json::Value;
use std::path::Path;

use super::result::{CheckResult, Status};
use super::target_helpers::{is_secret_like_key, parse_toml, row};

/// `config.toml` parses, any declared agent ref resolves, and no secret-like
/// key carries a value.
pub(super) fn check_config(dir: &Path) -> Vec<CheckResult> {
    let config_path = dir.join(".codex").join("config.toml");
    if !config_path.exists() {
        return vec![row(
            "Codex config.toml present",
            Status::Fail,
            format!("Missing: {}", config_path.display()),
        )];
    }
    let parsed = match parse_toml(&config_path) {
        Ok(parsed) => parsed,
        Err(message) => {
            return vec![row(
                "Codex config.toml parses",
                Status::Fail,
                format!("TOML parse error: {message}"),
            )];
        }
    };
    let mut out = vec![row(
        "Codex config.toml parses",
        Status::Pass,
        "valid TOML".to_string(),
    )];

    // Agents AUTO-LOAD from `.codex/agents/*.toml`, so `config.toml` needs no
    // wiring — but a declared `config_file` that dangles is still a defect.
    if let Some(agents) = parsed.get("agents").and_then(Value::as_object)
        && !agents.is_empty()
    {
        {
            let dangling: Vec<&String> = agents
                .iter()
                .filter(|(_, value)| {
                    value
                        .get("config_file")
                        .and_then(Value::as_str)
                        .is_some_and(|file| !dir.join(".codex").join(file).exists())
                })
                .map(|(name, _)| name)
                .collect();
            out.push(if dangling.is_empty() {
                row(
                    "Codex config.toml agent refs",
                    Status::Pass,
                    format!(
                        "{} optional [agents] entr{} resolve (auto-load needs no wiring)",
                        agents.len(),
                        if agents.len() == 1 { "y" } else { "ies" }
                    ),
                )
            } else {
                row(
                    "Codex config.toml agent refs",
                    Status::Fail,
                    format!(
                        "config_file missing for: {}",
                        dangling
                            .iter()
                            .map(|name| name.as_str())
                            .collect::<Vec<_>>()
                            .join(", ")
                    ),
                )
            });
        }
    }

    let mut leaked = Vec::new();
    collect_secret_keys(&parsed, "", &mut leaked);
    out.push(if leaked.is_empty() {
        row(
            "Codex config.toml secret-free",
            Status::Pass,
            "no secret-like key carries a value".to_string(),
        )
    } else {
        row(
            "Codex config.toml secret-free",
            Status::Fail,
            format!("secret-like keys with values: {}", leaked.join(", ")),
        )
    });
    out
}

/// Secret-like keys that carry a non-empty STRING value, prefixed by their
/// path. A nested table is walked; a non-string value is not a leak.
fn collect_secret_keys(value: &Value, prefix: &str, leaked: &mut Vec<String>) {
    let Some(table) = value.as_object() else {
        return;
    };
    for (key, child) in table {
        match child {
            Value::String(text) if is_secret_like_key(key) && !text.trim().is_empty() => {
                leaked.push(format!("{prefix}{key}"));
            }
            Value::Object(_) | Value::Array(_) => {
                collect_secret_keys(child, &format!("{prefix}{key}."), leaked);
            }
            _ => {}
        }
    }
}
