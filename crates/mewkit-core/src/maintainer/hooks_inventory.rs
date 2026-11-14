//! The registered lifecycle hooks, derived from `.claude/settings.json`.
//!
//! `settings.json` is the registration, so anything registered appears in the
//! published list whether or not anyone remembered to document it. What is
//! published is a deliberate subset: lifecycle event, purpose, and whether the
//! hook can block. Script paths, timeouts and matcher chains stay in source —
//! publishing them would turn an inventory into a map of which script to
//! disable to get past a gate.
use std::path::Path;

use regex::Regex;
use serde_json::Value;

use super::locale_order::locale_compare;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct HookEntry {
    pub event: String,
    pub purpose: String,
    /// True when the hook can veto the action rather than only observing it.
    pub blocking: bool,
}

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct HooksInventory {
    pub entries: Vec<HookEntry>,
    /// Events registered with no hooks, kept so the page shows the full surface.
    pub empty_events: Vec<String>,
}

fn rx(pattern: &str) -> Regex {
    Regex::new(pattern).expect("a static pattern")
}

/// The hook script a registration names, in either shape: exec form carries the
/// path in `args`, shell form inside the `command` string. An unidentifiable
/// registration is reported as unnamed rather than guessed at.
fn script_name(hook: &Value) -> Option<String> {
    let pattern = rx(r"\.claude/hooks/((?:handlers/|lib/)?[A-Za-z0-9._-]+)");
    let mut candidates: Vec<&str> = hook
        .get("args")
        .and_then(Value::as_array)
        .map(|args| args.iter().filter_map(Value::as_str).collect())
        .unwrap_or_default();
    candidates.push(hook.get("command").and_then(Value::as_str).unwrap_or(""));
    candidates
        .into_iter()
        .find_map(|c| pattern.captures(c).map(|m| m[1].to_string()))
}

fn read_text(path: &Path) -> Option<String> {
    std::fs::read(path)
        .ok()
        .map(|bytes| String::from_utf8_lossy(&bytes).into_owned())
}

fn body_blocks(body: &str) -> bool {
    rx(r"\bexit 2\b").is_match(body)
        || rx(r"process\.exit\(\s*2\s*\)").is_match(body)
        || rx(r#""decision"\s*:\s*"block""#).is_match(body)
        || rx(r#""permissionDecision"\s*:\s*"deny""#).is_match(body)
}

/// Does any registered observer carry a veto? A dispatcher only forwards, so
/// asking whether its own source blocks would call every chain advisory.
fn registry_blocks(hooks_dir: &Path) -> bool {
    let Some(text) = read_text(&hooks_dir.join("handlers.json")) else {
        return false;
    };
    let Ok(registry) = serde_json::from_str::<Value>(&text) else {
        return false;
    };
    let handlers = registry.get("handlers").and_then(Value::as_array);
    handlers.into_iter().flatten().any(|entry| {
        let Some(handler) = entry.get("handler").and_then(Value::as_str) else {
            return false;
        };
        read_text(&hooks_dir.join(handler)).is_some_and(|body| {
            rx(r"\bexitCode:\s*2\b").is_match(&body)
                || rx(r#""decision"\s*:\s*"block""#).is_match(&body)
                || body.contains("decision: \"block\"")
        })
    })
}

/// Whether a hook can veto, read from the script and not assumed from the
/// event: a Stop-time completion gate blocks even though Stop sounds passive.
fn is_blocking(hooks_dir: &Path, hook: &Value) -> bool {
    let Some(name) = script_name(hook) else {
        return false;
    };
    if name == "dispatch.cjs" {
        return registry_blocks(hooks_dir);
    }
    read_text(&hooks_dir.join(name)).is_some_and(|body| body_blocks(&body))
}

/// A script name as a readable phrase, when no `statusMessage` is declared.
fn purpose_from(hook: &Value) -> String {
    if let Some(message) = hook
        .get("statusMessage")
        .and_then(Value::as_str)
        .filter(|m| !m.is_empty())
    {
        let trimmed = message.strip_suffix("...").unwrap_or(message);
        return trimmed.trim().to_string();
    }
    let Some(name) = script_name(hook) else {
        return "Unnamed hook".to_string();
    };
    let name = rx(r"^(?:handlers|lib)/").replace(&name, "").into_owned();
    let name = rx(r"\.(sh|cjs|js|mjs|py)$").replace(&name, "").into_owned();
    let phrase = name.split(['-', '_']).collect::<Vec<_>>().join(" ");
    let mut chars = phrase.chars();
    match chars.next() {
        Some(first) => first.to_uppercase().chain(chars).collect(),
        None => phrase,
    }
}

pub fn build_hooks_inventory(claude_dir: &Path) -> Result<HooksInventory, String> {
    let settings_path = claude_dir.join("settings.json");
    let Some(text) = read_text(&settings_path) else {
        return Ok(HooksInventory::default());
    };
    let settings: Value =
        serde_json::from_str(&text).map_err(|e| format!("{}: {e}", settings_path.display()))?;
    let hooks_dir = claude_dir.join("hooks");

    let mut entries: Vec<HookEntry> = Vec::new();
    let mut empty_events: Vec<String> = Vec::new();
    let events = settings.get("hooks").and_then(Value::as_object);
    for (event, matchers) in events.into_iter().flatten() {
        let flat: Vec<&Value> = matchers
            .as_array()
            .into_iter()
            .flatten()
            .flat_map(|m| {
                m.get("hooks")
                    .and_then(Value::as_array)
                    .into_iter()
                    .flatten()
            })
            .collect();
        if flat.is_empty() {
            empty_events.push(event.clone());
            continue;
        }
        for hook in flat {
            entries.push(HookEntry {
                event: event.clone(),
                purpose: purpose_from(hook),
                blocking: is_blocking(&hooks_dir, hook),
            });
        }
    }

    // One row per distinct published fact: a script registered under several
    // matchers is one thing a reader needs, and the matcher chains are the
    // detail deliberately withheld.
    let mut deduped: Vec<HookEntry> = Vec::new();
    for entry in entries {
        if !deduped.contains(&entry) {
            deduped.push(entry);
        }
    }
    deduped.sort_by(|a, b| {
        locale_compare(&a.event, &b.event).then_with(|| locale_compare(&a.purpose, &b.purpose))
    });
    empty_events.sort();
    Ok(HooksInventory {
        entries: deduped,
        empty_events,
    })
}
