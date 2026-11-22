//! The guards row of an Antigravity install: the hook file registers the
//! privacy guard and the ship check in the form the hooks page documents
//! (https://antigravity.google/docs/hooks, read 2026-11-22), their scripts are
//! installed, and the scripts are configured for Antigravity. Read-only.
//!
//! A row that finds all of that still warns: the guards were built from the
//! page alone and no live run has shown them deny.
use std::path::Path;

use serde_json::Value;

use super::result::{CheckResult, Status};
use super::target_helpers::row;

const HOOK_FILE: &str = ".agents/hooks.json";
const HOOK_SCRIPTS: &str = ".agents/meowkit-antigravity/hooks";
/// The guard scripts the hook file must register.
const GUARDS: [&str; 2] = ["/privacy-block.cjs", "/pre-ship.cjs"];
/// The only event whose answer can stop a tool call.
const BLOCKING_EVENT: &str = "PreToolUse";

pub fn guards(dir: &Path) -> CheckResult {
    let name = "Antigravity guards";
    let text = match std::fs::read_to_string(dir.join(HOOK_FILE)) {
        Ok(text) => text,
        Err(_) => {
            return row(
                name,
                Status::Fail,
                format!(
                    "guards not installed: {HOOK_FILE} is missing, so no privacy guard and no ship check run; `mewkit upgrade --force` writes it again"
                ),
            );
        }
    };
    let Ok(doc) = serde_json::from_str::<Value>(&text) else {
        return row(name, Status::Fail, format!("{HOOK_FILE} is not valid JSON"));
    };
    let mut registered = Vec::new();
    for hook in doc.as_object().into_iter().flat_map(|m| m.values()) {
        if hook["enabled"] == Value::Bool(false) {
            continue;
        }
        for handler in hook[BLOCKING_EVENT]
            .as_array()
            .into_iter()
            .flatten()
            .flat_map(|group| group["hooks"].as_array().into_iter().flatten())
        {
            let command = handler["command"].as_str().unwrap_or_default();
            if let Some(script) = command
                .split_whitespace()
                .find(|word| word.starts_with(HOOK_SCRIPTS))
            {
                if !dir.join(script).is_file() {
                    return row(
                        name,
                        Status::Fail,
                        format!("{HOOK_FILE}: the script of `{command}` is not installed"),
                    );
                }
                registered.push(script.to_owned());
            }
        }
    }
    if let Some(guard) = GUARDS
        .iter()
        .find(|guard| !registered.iter().any(|script| script.ends_with(*guard)))
    {
        return row(
            name,
            Status::Fail,
            format!(
                "{HOOK_FILE}: {guard} is not registered on {BLOCKING_EVENT}, or its hook is disabled"
            ),
        );
    }
    let config = std::fs::read_to_string(dir.join(HOOK_SCRIPTS).join("hook-runtime-config.json"))
        .ok()
        .and_then(|t| serde_json::from_str::<Value>(&t).ok());
    if !config.is_some_and(|c| c["runtime"] == "antigravity") {
        return row(
            name,
            Status::Fail,
            format!(
                "{HOOK_SCRIPTS}/hook-runtime-config.json does not name antigravity, so the guards deny every call"
            ),
        );
    }
    row(
        name,
        Status::Warn,
        "privacy guard and ship check registered on PreToolUse with their scripts; unverified: built from Antigravity's documentation, not yet seen to deny in a live run".into(),
    )
}
