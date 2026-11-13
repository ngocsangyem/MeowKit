//! The Codex hook wrappers: they exist, they run, and one of them gates.
use std::path::{Path, PathBuf};
use std::sync::LazyLock;

use regex::Regex;
use serde_json::Value;

use super::result::{CheckResult, Status};
use super::target_helpers::{is_executable, row};

static WRAPPER_REF: LazyLock<Regex> = LazyLock::new(|| {
    crate::js_regex::compile(r"\.codex[/\\]hooks[/\\][\w.-]+\.cjs")
        .expect("a static wrapper-path pattern")
});

static SCRUB_RULES: LazyLock<Regex> = LazyLock::new(|| {
    crate::js_regex::compile(r"(?m)^\s*const SCRUB_RULES\s*=\s*(.+);\s*$")
        .expect("a static scrub-rules pattern")
});

/// The wrapper rows: existence, executability, and the deny contract.
///
/// The wrapper path is extracted from the command however it computes the git
/// root, because Codex runs a hook from the session cwd while the target being
/// validated IS that root.
pub fn hooks_wrapper_rows(dir: &Path, commands: &[String]) -> Vec<CheckResult> {
    let mut wrappers: Vec<PathBuf> = Vec::new();
    for command in commands {
        if let Some(found) = WRAPPER_REF.find(command) {
            let path = dir.join(found.as_str().replace('\\', "/"));
            if !wrappers.contains(&path) {
                wrappers.push(path);
            }
        }
    }
    let mut out = Vec::new();
    let missing: Vec<&PathBuf> = wrappers.iter().filter(|path| !path.exists()).collect();
    let not_executable: Vec<&PathBuf> = wrappers
        .iter()
        .filter(|path| path.exists() && !is_executable(path))
        .collect();
    if wrappers.is_empty() {
        out.push(row(
            "Codex hook wrappers",
            Status::Warn,
            "hooks.json references no wrapper scripts".to_string(),
        ));
        return out;
    }
    if !missing.is_empty() {
        out.push(row(
            "Codex hook wrappers exist",
            Status::Fail,
            format!("missing: {}", base_names(&missing)),
        ));
    } else if !not_executable.is_empty() {
        out.push(row(
            "Codex hook wrappers executable",
            Status::Fail,
            format!("not executable: {}", base_names(&not_executable)),
        ));
    } else {
        out.push(row(
            "Codex hook wrappers exist + executable",
            Status::Pass,
            format!("{} wrapper script(s)", wrappers.len()),
        ));
    }

    // The DATA is inspected, not the boilerplate: every wrapper carries a
    // helper that mentions `allowedPermissionValues`, so grepping the source
    // would always match and the check would be a tautology.
    let deny_capable = wrappers
        .iter()
        .filter(|path| wrapper_declares_deny(path))
        .count();
    out.push(if deny_capable > 0 {
        row(
            "Codex hook deny contract",
            Status::Pass,
            format!(
                "{deny_capable} wrapper(s) carry the PreToolUse/PermissionRequest deny scrub rule"
            ),
        )
    } else {
        row(
            "Codex hook deny contract",
            Status::Warn,
            "no wrapper declares an allowedPermissionValues deny rule (no gating hook migrated?)"
                .to_string(),
        )
    });
    out
}

fn base_names(paths: &[&PathBuf]) -> String {
    paths
        .iter()
        .map(|path| {
            path.file_name()
                .map(|name| name.to_string_lossy().into_owned())
                .unwrap_or_default()
        })
        .collect::<Vec<_>>()
        .join(", ")
}

fn wrapper_declares_deny(path: &Path) -> bool {
    let Ok(bytes) = std::fs::read(path) else {
        return false;
    };
    let body = String::from_utf8_lossy(&bytes);
    let Some(capture) = SCRUB_RULES.captures(&body) else {
        return false;
    };
    let Some(serialized) = capture.get(1) else {
        return false;
    };
    let Ok(rules) = serde_json::from_str::<Value>(serialized.as_str()) else {
        return false;
    };
    rules
        .as_object()
        .is_some_and(|table| table.values().any(declares_deny))
}

fn declares_deny(rule: &Value) -> bool {
    rule.get("allowedPermissionValues")
        .and_then(Value::as_array)
        .is_some_and(|values| values.iter().any(|value| value.as_str() == Some("deny")))
}
