//! Can an installed runtime's hooks run: every kit script its hook file
//! names exists, Codex trusts the project, and which kit hook behaviours the
//! runtime does not carry or carries unverified (`hooks/hook-coverage.json` in
//! the installed kit).
use std::path::{Path, PathBuf};

use mewkit_adapters::ScopeKind;
use mewkit_adapters::contract::{OwnershipIndex, RelPath, Runtime};
use mewkit_adapters::hook_coverage;
use serde_json::{Map, Value};

use super::hook_commands::{ROOT, kit_scripts, normalize, script_token};
use super::host_config::{ConfigRead, config_text};
use super::{Check, Status};
use crate::kit_args::installed_kit;
use crate::place::Place;

pub fn checks(place: &Place, runtime: Runtime, index: &OwnershipIndex) -> Vec<Check> {
    let mut out = vec![scripts(place, runtime)];
    if place.scope.kind == ScopeKind::Project {
        match runtime {
            Runtime::Codex => out.push(super::codex_trust::check(&place.scope.root)),
            // https://code.claude.com/docs/en/permissions#project-allow-rules-and-workspace-trust
            Runtime::ClaudeCode => out.push(Check::new(
                "claude-code trust",
                Status::Ok,
                "Claude Code asks to trust this folder on its first interactive start here; whether you accepted is not read here",
            )),
            // https://cursor.com/docs/agent/hooks
            Runtime::Cursor => out.push(Check::new(
                "cursor trust",
                Status::Ok,
                "Cursor runs project hooks only in a trusted workspace; whether this one is trusted is not readable here",
            )),
            // https://docs.x.ai/build/features/hooks
            Runtime::Grok => out.push(Check::new(
                "grok trust",
                Status::Ok,
                "Grok runs project hooks only after /hooks-trust or a start with --trust; whether this project is trusted is not read here",
            )),
            // https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/docs/security.md
            Runtime::Pi => out.push(Check::new(
                "pi trust",
                Status::Ok,
                "Pi loads .pi/extensions and the project's .agents/skills only in a project you trusted (/trust); whether this one is trusted is not read here",
            )),
            // OMP has no trust step: its hook module runs from the first session.
            Runtime::Omp | Runtime::Antigravity => {}
        }
    }
    if runtime != Runtime::ClaudeCode {
        out.push(coverage(place, runtime, index));
    }
    out
}

pub(super) fn hook_file(runtime: Runtime) -> &'static str {
    match runtime {
        Runtime::ClaudeCode => ".claude/settings.json",
        Runtime::Codex => ".codex/hooks.json",
        Runtime::Cursor => ".cursor/hooks.json",
        Runtime::Grok => ".grok/hooks/meowkit.json",
        Runtime::Pi => ".pi/extensions/meowkit.ts",
        Runtime::Omp => ".omp/hooks/pre/meowkit.ts",
        Runtime::Antigravity => ".agents/hooks.json",
    }
}

/// Where `runtime`'s hook registrations live at `place`, whether or not the
/// file is there.
pub(super) fn hook_path(place: &Place, runtime: Runtime) -> PathBuf {
    place
        .scope
        .resolve(&RelPath::new(hook_file(runtime)).expect("static path"))
}

/// The hook file at `place` and what it says, or `None` when there is no file,
/// it cannot be read under the cap, or it is not JSON. The rows that report on
/// registrations each say that in their own words, so the distinction is theirs
/// to draw and not this reader's.
///
/// The read is bounded: this is called for the hook file of every runtime at
/// every scope, installed or not, so it reaches `~/.claude/settings.json` on a
/// machine where nothing was installed — a path whose contents are entirely
/// outside this project's control.
pub(super) fn hook_doc(place: &Place, runtime: Runtime) -> Option<(PathBuf, Value)> {
    let file = hook_path(place, runtime);
    let doc = serde_json::from_str::<Value>(&config_text(&file).text()?).ok()?;
    Some((file, hooks_shape(runtime, doc)))
}

/// The document in the `{ "hooks": { <event>: [...] } }` shape every reader
/// here walks. Antigravity's file names each hook first and its events inside
/// it (`{ "<name>": { "enabled": bool, "PreToolUse": [...] } }`,
/// https://antigravity.google/docs/hooks, read 2026-11-22), so its events are
/// gathered under `hooks`, leaving out a hook switched off with
/// `"enabled": false`. Every other runtime's file already has the shape.
pub(super) fn hooks_shape(runtime: Runtime, doc: Value) -> Value {
    if runtime != Runtime::Antigravity {
        return doc;
    }
    let mut events: Map<String, Value> = Map::new();
    for hook in doc.as_object().into_iter().flat_map(|m| m.values()) {
        let Some(hook) = hook.as_object() else {
            continue;
        };
        if hook.get("enabled") == Some(&Value::Bool(false)) {
            continue;
        }
        for (event, handlers) in hook.iter().filter(|(k, _)| *k != "enabled") {
            let slot = events
                .entry(event.clone())
                .or_insert_with(|| Value::Array(Vec::new()));
            if let (Value::Array(all), Some(more)) = (slot, handlers.as_array()) {
                all.extend(more.iter().cloned());
            }
        }
    }
    serde_json::json!({ "hooks": events })
}

/// Every kit script path the document registers, root forms normalized.
pub(super) fn registered(doc: &Value) -> Vec<String> {
    let mut strings = Vec::new();
    collect(&doc["hooks"], &mut strings);
    strings
        .iter()
        .flat_map(|(s, whole)| {
            if *whole {
                script_token(&normalize(s)).into_iter().collect()
            } else {
                kit_scripts(s)
            }
        })
        .collect()
}

/// Where a registration's relative path starts. Cursor runs user hooks from
/// `~/.cursor/`, so a global install's relative paths begin there; every other
/// hook file runs from the root.
pub(super) fn base_dir<'a>(place: &'a Place, runtime: Runtime, file: &'a Path) -> &'a Path {
    match (runtime, place.scope.kind) {
        (Runtime::Cursor, ScopeKind::Global) => file.parent().unwrap_or(&place.scope.root),
        _ => &place.scope.root,
    }
}

/// Every kit hook script the hook file names must exist.
fn scripts(place: &Place, runtime: Runtime) -> Check {
    let name = format!("{} hooks ({})", runtime.name(), place.label());
    let file = hook_path(place, runtime);
    // Pi and OMP run code, not a hook file: the module and the guard it runs.
    if matches!(runtime, Runtime::Pi | Runtime::Omp) {
        let guard = place
            .scope
            .resolve(&RelPath::new(mewkit_adapters::agents_tree::GUARD).expect("static path"));
        let missing: Vec<String> = [&file, &guard]
            .iter()
            .filter(|path| !path.is_file())
            .map(|path| path.display().to_string())
            .collect();
        return if missing.is_empty() {
            Check::new(
                name,
                Status::Ok,
                "the guard module and its script are found",
            )
        } else {
            Check::new(
                name,
                Status::Fail,
                format!(
                    "missing: {}; `mewkit upgrade --force` restores them",
                    missing.join(", ")
                ),
            )
        };
    }
    let text = match config_text(&file) {
        ConfigRead::Text(text) => text,
        // Absent and unusable are one answer here — a named pipe or a file
        // past the cap registers nothing, exactly as a missing file does — but
        // the message says which, because the fixes differ.
        other => {
            let why = match other {
                ConfigRead::Absent => "is missing",
                _ => "is not a readable file of a sane size",
            };
            return Check::new(
                name,
                Status::Warn,
                format!(
                    "{} {why}, so no kit hook runs; `mewkit upgrade --force` registers them again",
                    file.display()
                ),
            );
        }
    };
    let Ok(doc) = serde_json::from_str::<Value>(&text) else {
        return Check::new(
            name,
            Status::Fail,
            format!("{} is not valid JSON", file.display()),
        );
    };
    let scripts = registered(&hooks_shape(runtime, doc));
    let base = base_dir(place, runtime, &file);
    let missing: Vec<&String> = scripts
        .iter()
        .filter(|s| !resolve(base, s).is_file())
        .collect();
    if missing.is_empty() {
        Check::new(
            name,
            Status::Ok,
            format!("{} kit hook scripts found", scripts.len()),
        )
    } else {
        let list: Vec<&str> = missing.iter().map(|s| s.as_str()).collect();
        Check::new(
            name,
            Status::Fail,
            format!(
                "registered but missing: {}; `mewkit upgrade --force` restores them",
                list.join(", ")
            ),
        )
    }
}

/// Every `command` string (`false`: still to be split into words) and
/// `args` entry (`true`: one word already, spaces and all) under the hooks object.
fn collect(v: &Value, out: &mut Vec<(String, bool)>) {
    match v {
        Value::Object(map) => {
            for (k, v) in map {
                match (k.as_str(), v) {
                    ("command" | "commandWindows", Value::String(s)) => {
                        out.push((s.clone(), false))
                    }
                    ("args", Value::Array(a)) => {
                        out.extend(
                            a.iter()
                                .filter_map(|x| x.as_str().map(|s| (s.to_owned(), true))),
                        );
                    }
                    _ => collect(v, out),
                }
            }
        }
        Value::Array(a) => a.iter().for_each(|x| collect(x, out)),
        _ => {}
    }
}

pub(super) fn resolve(root: &Path, token: &str) -> PathBuf {
    let t = token.trim_start_matches(ROOT).trim_start_matches("./");
    let p = Path::new(t);
    if p.is_absolute() {
        p.to_path_buf()
    } else {
        root.join(p)
    }
}

/// Kit hook behaviours this runtime does not carry, and guards it carries that
/// no live run has shown to deny, from the installed kit.
fn coverage(place: &Place, runtime: Runtime, index: &OwnershipIndex) -> Check {
    let name = format!("{} hook coverage", runtime.name());
    let doc = installed_kit(place, index).and_then(|k| hook_coverage::read(&k.dir));
    let Some(doc) = doc else {
        // Antigravity's guards are unverified whichever kit wrote them, so the
        // row says so even when the kit cannot be read.
        if runtime == Runtime::Antigravity {
            return Check::new(
                name,
                Status::Warn,
                mewkit_adapters::antigravity::guard_notice(Path::new("")),
            );
        }
        return Check::new(
            name,
            Status::Ok,
            "unknown: the installed kit is not in the cache",
        );
    };
    let rt = runtime.name();
    let unverified = hook_coverage::unverified(&doc, rt);
    let safety: Vec<&str> = doc["safety"]
        .as_object()
        .into_iter()
        .flatten()
        .filter(|(_, v)| v[rt]["status"] == "not-ported")
        .map(|(k, _)| k.as_str())
        .collect();
    let handlers = doc["handlers"]
        .as_object()
        .into_iter()
        .flatten()
        .filter(|(_, v)| v[rt] == "not-ported")
        .count();
    let mut parts = Vec::new();
    if !unverified.is_empty() {
        parts.push(format!(
            "unverified guards: {}, built from the runtime's documentation and not yet seen to deny in a live run, so do not count on them",
            hook_coverage::describe(&unverified)
        ));
    }
    if safety.is_empty() {
        parts.push("every other safety behaviour carried".to_owned());
    } else {
        parts.push(format!(
            "safety behaviours not carried: {}",
            safety.join(", ")
        ));
    }
    parts.push(format!("{handlers} advisory handlers not ported"));
    let detail = parts.join("; ");
    if safety.is_empty() && unverified.is_empty() {
        let detail =
            format!("every safety behaviour carried; {handlers} advisory handlers not ported");
        return Check::new(name, Status::Ok, detail);
    }
    Check::new(name, Status::Warn, detail)
}

#[cfg(test)]
mod tests {
    use super::{hooks_shape, registered};
    use mewkit_adapters::contract::Runtime;

    #[test]
    fn antigravity_hooks_are_read_by_event_and_a_disabled_hook_is_left_out() {
        let doc = serde_json::json!({
            "meowkit-privacy": { "PreToolUse": [ { "matcher": "*", "hooks": [
                { "type": "command", "command": "node .agents/meowkit-antigravity/hooks/privacy-block.cjs" } ] } ] },
            "off": { "enabled": false, "PreToolUse": [ { "hooks": [
                { "command": "node .agents/x/hooks/off.cjs" } ] } ] }
        });
        let shaped = hooks_shape(Runtime::Antigravity, doc.clone());
        assert_eq!(
            registered(&shaped),
            [".agents/meowkit-antigravity/hooks/privacy-block.cjs"]
        );
        // Every other runtime's file is read as it is.
        assert_eq!(hooks_shape(Runtime::Codex, doc.clone()), doc);
    }
}
