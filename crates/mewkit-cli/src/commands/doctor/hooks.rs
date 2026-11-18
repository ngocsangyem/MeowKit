//! Can an installed runtime's hooks run: every kit script its hook file
//! names exists, Codex trusts the project, and which kit hook behaviours the
//! runtime does not carry (`hooks/hook-coverage.json` in the installed kit).
use std::path::{Path, PathBuf};

use mewkit_adapters::ScopeKind;
use mewkit_adapters::contract::{OwnershipIndex, RelPath, Runtime};
use serde_json::Value;

use super::hook_commands::{ROOT, kit_scripts, normalize, script_token};
use super::host_config::{ConfigRead, config_text};
use super::{Check, Status};
use crate::kit_args::installed_kit;
use crate::place::Place;

const COVERAGE: &str = ".claude/hooks/hook-coverage.json";

pub fn checks(place: &Place, runtime: Runtime, index: &OwnershipIndex) -> Vec<Check> {
    let mut out = vec![scripts(place, runtime)];
    if runtime == Runtime::Codex && place.scope.kind == ScopeKind::Project {
        out.push(super::codex_trust::check(&place.scope.root));
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
        Runtime::Grok => ".grok/hooks",
        Runtime::Pi => ".pi/extensions",
        Runtime::Omp => ".omp/hooks",
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
    Some((file, doc))
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
    let scripts = registered(&doc);
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

/// Kit hook behaviours this runtime does not carry, from the installed kit.
fn coverage(place: &Place, runtime: Runtime, index: &OwnershipIndex) -> Check {
    let name = format!("{} hook coverage", runtime.name());
    let doc = installed_kit(place, index)
        .and_then(|k| std::fs::read_to_string(k.dir.join(COVERAGE)).ok())
        .and_then(|t| serde_json::from_str::<Value>(&t).ok());
    let Some(doc) = doc else {
        return Check::new(
            name,
            Status::Ok,
            "unknown: the installed kit is not in the cache",
        );
    };
    let rt = runtime.name();
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
    if safety.is_empty() {
        Check::new(
            name,
            Status::Ok,
            format!("every safety behaviour carried; {handlers} advisory handlers not ported"),
        )
    } else {
        Check::new(
            name,
            Status::Warn,
            format!(
                "safety behaviours not carried: {}; {handlers} advisory handlers not ported",
                safety.join(", ")
            ),
        )
    }
}
