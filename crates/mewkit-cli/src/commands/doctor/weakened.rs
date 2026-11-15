//! The `checks: weakened` row: a check that is installed, registered and still
//! not doing what its name says.
//!
//! Two of the kit's hooks cannot be switched off by configuration — the privacy
//! block and the ship check are protected keys, and a config file naming either
//! is refused whole. Everything else can be weakened, and legitimately: an
//! observer has a `hooks.<name>` toggle, the fast hook profile skips the
//! observers and the ship check's test block, Cursor's kill switch downgrades
//! its shell, MCP and tool gates to allow, and a host setting can stop every
//! hook from running at all.
//!
//! Each of those exists for a reason, so none of them is a failure. But a report
//! that stayed green through them would be claiming the checks run when they do
//! not, and that claim is worse than no report. Hence one row, `warn`, naming
//! what is off and where it is set.
use std::collections::BTreeMap;

use mewkit_adapters::ScopeKind;
use mewkit_core::config::{
    ConfigScope, ConfigValue, load_config_file, observer_names, project_config_path,
    user_config_path,
};
use serde_json::Value;

use super::coexistence::at;
use super::host_config::{ConfigRead, config_text};
use super::{Check, Status};
use crate::place::Place;

const NAME: &str = "checks: weakened";
/// The profile that skips the observers and the ship check's test block.
const PROFILE: &str = "MEOWKIT_HOOK_PROFILE";
/// Cursor's guard kill switch. Read from the environment only: a file an agent
/// can write must not be able to switch a gate off.
const KILL_SWITCH: &str = "MEWKIT_CURSOR_HOOKS_KILL_SWITCH";
/// The spellings the Cursor hook runtime itself accepts for the kill switch.
const KILL_SWITCH_ON: [&str; 4] = ["1", "true", "yes", "on"];
/// Claude Code settings files, nearest last: the value after precedence decides,
/// so a project `false` overrides a user `true`.
const CLAUDE_SETTINGS: [&str; 2] = [".claude/settings.json", ".claude/settings.local.json"];
/// Codex's own config, and the file that can narrow it to managed hooks.
const CODEX_CONFIG: &str = ".codex/config.toml";
const CODEX_REQUIREMENTS: &str = ".codex/requirements.toml";

pub fn check(places: &[&Place]) -> Check {
    let mut weak: Vec<String> = Vec::new();
    weak.extend(toggles(places));
    weak.extend(environment());
    let (from_host, unreadable) = host_settings(places);
    weak.extend(from_host);
    // A file that could not be read is not evidence either way, so it never
    // changes the status — but a row that silently skipped it would claim to
    // have checked something it did not.
    let unread = if unreadable.is_empty() {
        String::new()
    } else {
        format!(
            "; could not read {} (not a regular file, or past the size cap), so what it says is \
             not counted",
            unreadable.join(", ")
        )
    };
    if weak.is_empty() {
        return Check::new(
            NAME,
            Status::Ok,
            format!(
                "no observer is toggled off, no hook profile or kill switch is set in this \
                 environment, and no host setting here stops a kit hook from running; the privacy \
                 block and the ship check cannot be switched off by config at all{unread}"
            ),
        );
    }
    Check::new(
        NAME,
        Status::Warn,
        format!(
            "{} — the privacy block and the ship check still cannot be switched off by \
             config{unread}",
            weak.join("; ")
        ),
    )
}

/// Observer toggles set to `false` in either config file.
///
/// The files are read directly rather than through the resolver because the row
/// names the file a reader has to edit, and a merged answer cannot. A file the
/// rules reject applies no keys at all, so it weakens nothing and is skipped.
fn toggles(places: &[&Place]) -> Vec<String> {
    let place = places
        .iter()
        .find(|p| p.scope.kind == ScopeKind::Project)
        .or(places.first());
    let Some(place) = place else {
        return Vec::new();
    };
    let names = observer_names(&place.scope.root);
    let home = mewkit_core::config::home_dir();
    let files = [
        home.as_deref()
            .map(|h| (user_config_path(h), ConfigScope::UserConfig)),
        Some((
            project_config_path(&place.scope.root),
            ConfigScope::ProjectConfig,
        )),
    ];
    let mut off: BTreeMap<String, &'static str> = BTreeMap::new();
    for (file, scope) in files.into_iter().flatten() {
        let Ok(loaded) = load_config_file(&file, &names, scope) else {
            continue;
        };
        for (key, value) in loaded.values.iter() {
            if key.starts_with("hooks.") && matches!(value, ConfigValue::Bool(false)) {
                off.insert(key.to_owned(), scope.as_str());
            }
        }
    }
    off.into_iter()
        .map(|(key, scope)| format!("{key} is off in the {scope}, so that observer does not run"))
        .collect()
}

fn environment() -> Vec<String> {
    let mut out = Vec::new();
    let value = |name: &str| {
        std::env::var(name)
            .unwrap_or_default()
            .trim()
            .to_lowercase()
    };
    if value(PROFILE) == "fast" {
        out.push(format!(
            "{PROFILE}=fast is set in this environment, so the observers and the ship check's \
             test block do not run"
        ));
    }
    if KILL_SWITCH_ON.contains(&value(KILL_SWITCH).as_str()) {
        out.push(format!(
            "{KILL_SWITCH} is set in this environment, so Cursor's shell, MCP and tool gates \
             allow what they would otherwise deny (its privacy read gate never consults it)"
        ));
    }
    out
}

/// Host settings that stop a registered hook from running, and the files that
/// could not be read to find out.
///
/// The row names the scope and the relative path, not the absolute one: a home
/// directory's name is not needed to say which file to edit.
fn host_settings(places: &[&Place]) -> (Vec<String>, Vec<String>) {
    let mut out = Vec::new();
    let mut unreadable = Vec::new();
    // Both keys follow settings precedence, so the nearest file to decide wins
    // and a project `false` overrides a user `true`. Keeping only the last
    // answer is what implements that; reporting each file as it was read would
    // warn about a setting the host has already overridden.
    let mut disabled: Option<(bool, String)> = None;
    let mut managed_only: Option<(bool, String)> = None;
    let ordered = {
        let mut ordered: Vec<&&Place> = places.iter().collect();
        ordered.sort_by_key(|p| p.scope.kind == ScopeKind::Project);
        ordered
    };
    for place in ordered {
        for rel in CLAUDE_SETTINGS {
            let shown = format!("{} {rel}", place.label());
            let doc = match config_text(&at(place, rel)) {
                ConfigRead::Text(text) => serde_json::from_str::<Value>(&text).ok(),
                ConfigRead::Absent => continue,
                ConfigRead::Unusable => {
                    unreadable.push(shown);
                    continue;
                }
            };
            let Some(doc) = doc else { continue };
            if let Some(value) = doc.get("disableAllHooks").and_then(Value::as_bool) {
                disabled = Some((value, shown.clone()));
            }
            if let Some(value) = doc.get("allowManagedHooksOnly").and_then(Value::as_bool) {
                managed_only = Some((value, shown));
            }
        }
    }
    if let Some((true, file)) = disabled {
        out.push(format!(
            "{file} sets disableAllHooks, so no kit hook runs in Claude Code at all"
        ));
    }
    if let Some((true, file)) = managed_only {
        out.push(format!(
            "{file} sets allowManagedHooksOnly, so only a managed hook runs and no kit hook is \
             managed"
        ));
    }
    for place in places {
        if codex_toml(place, CODEX_CONFIG, &["features", "hooks"], &mut unreadable) == Some(false) {
            out.push(format!(
                "{} {CODEX_CONFIG} turns the Codex hooks feature off, so no kit hook runs in Codex",
                place.label()
            ));
        }
        if codex_toml(
            place,
            CODEX_REQUIREMENTS,
            &["hooks", "allow_managed_hooks_only"],
            &mut unreadable,
        ) == Some(true)
        {
            out.push(format!(
                "{} {CODEX_REQUIREMENTS} sets allow_managed_hooks_only, so Codex runs managed \
                 hooks only and no kit hook is managed",
                place.label()
            ));
        }
    }
    (out, unreadable)
}

/// One boolean at `keys` in a Codex TOML file at `place`, read under the cap.
///
/// `None` covers absent, unusable, unparsable and "the key says something other
/// than a boolean" alike, because none of them is a weakened check — but a file
/// that could not be read is still added to `unreadable`, so the row says it
/// looked and could not tell rather than implying the answer was no.
fn codex_toml(
    place: &Place,
    rel: &str,
    keys: &[&str],
    unreadable: &mut Vec<String>,
) -> Option<bool> {
    let text = match config_text(&at(place, rel)) {
        ConfigRead::Text(text) => text,
        ConfigRead::Absent => return None,
        ConfigRead::Unusable => {
            unreadable.push(format!("{} {rel}", place.label()));
            return None;
        }
    };
    let doc = text.parse::<toml_edit::DocumentMut>().ok()?;
    keys.iter()
        .try_fold(doc.as_item(), |item, key| item.get(key))?
        .as_bool()
}
