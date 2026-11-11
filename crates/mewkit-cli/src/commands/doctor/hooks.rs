//! Can an installed runtime's hooks run: every kit script its hook file
//! names exists, Codex trusts the project, and which kit hook behaviours the
//! runtime does not carry (`hooks/hook-coverage.json` in the installed kit).
use std::path::{Path, PathBuf};

use mewkit_adapters::ScopeKind;
use mewkit_adapters::contract::{OwnershipIndex, RelPath, Runtime};
use serde_json::Value;

use super::hook_commands::{ROOT, kit_scripts, normalize, script_token};
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

fn hook_file(runtime: Runtime) -> &'static str {
    match runtime {
        Runtime::ClaudeCode => ".claude/settings.json",
        Runtime::Codex => ".codex/hooks.json",
        Runtime::Cursor => ".cursor/hooks.json",
    }
}

/// Every kit hook script the hook file names must exist.
fn scripts(place: &Place, runtime: Runtime) -> Check {
    let name = format!("{} hooks ({})", runtime.name(), place.label());
    let file = place
        .scope
        .resolve(&RelPath::new(hook_file(runtime)).expect("static path"));
    let Ok(text) = std::fs::read_to_string(&file) else {
        return Check::new(
            name,
            Status::Warn,
            format!(
                "{} is missing, so no kit hook runs; `mewkit-next upgrade --force` registers them again",
                file.display()
            ),
        );
    };
    let Ok(doc) = serde_json::from_str::<Value>(&text) else {
        return Check::new(
            name,
            Status::Fail,
            format!("{} is not valid JSON", file.display()),
        );
    };
    let mut strings = Vec::new();
    collect(&doc["hooks"], &mut strings);
    let scripts: Vec<String> = strings
        .iter()
        .flat_map(|(s, whole)| {
            if *whole {
                script_token(&normalize(s)).into_iter().collect()
            } else {
                kit_scripts(s)
            }
        })
        .collect();
    let missing: Vec<&String> = scripts
        .iter()
        .filter(|s| !resolve(&place.scope.root, s).is_file())
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
                "registered but missing: {}; `mewkit-next upgrade --force` restores them",
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

fn resolve(root: &Path, token: &str) -> PathBuf {
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
