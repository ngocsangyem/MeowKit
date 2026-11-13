//! Two runtime questions the gate probes cannot answer: does every
//! registration actually start, and is anything left behind that cannot start
//! on a host without a shell.
//!
//! A hook that fails to load is the dangerous case, because a crash exits
//! non-blocking, so an unloadable guard reads as permission. A module-resolution
//! error is therefore treated like a shell syntax error.
use std::path::Path;

use serde_json::{Value, json};

use super::runner::{Request, run_configured_hook};
use super::{Check, Status, row};

/// A shell or interpreter script under a hook path is a finding: the runtime is
/// node, so such a script is a gate that does nothing on a host without that
/// interpreter — and a gate that does nothing reads as permission. `.py` is
/// swept beside `.sh` because a host without Python is the ordinary case.
const SWEPT_SUFFIXES: [&str; 2] = [".sh", ".py"];

/// `Syntax error|Bad substitution|unexpected|Cannot find module`, any case.
fn is_runtime_error(stderr: &str) -> bool {
    let lower = stderr.to_lowercase();
    [
        "syntax error",
        "bad substitution",
        "unexpected",
        "cannot find module",
    ]
    .iter()
    .any(|m| lower.contains(m))
}

/// Events and tool inputs that between them reach every registration.
fn events() -> Vec<(&'static str, Option<&'static str>, Value)> {
    vec![
        ("SessionStart", None, json!({})),
        (
            "PreToolUse",
            Some("Write"),
            json!({"file_path": "src/app.ts"}),
        ),
        (
            "PreToolUse",
            Some("Read"),
            json!({"file_path": "README.md"}),
        ),
        ("PreToolUse", Some("Bash"), json!({"command": "ls -la"})),
        (
            "PostToolUse",
            Some("Write"),
            json!({"file_path": "src/app.ts"}),
        ),
        ("Stop", None, json!({})),
        ("UserPromptSubmit", None, json!({})),
    ]
}

fn walk(dir: &Path, root: &Path, out: &mut Vec<String>) {
    let Ok(read) = std::fs::read_dir(dir) else {
        return;
    };
    let mut entries: Vec<_> = read.filter_map(Result::ok).collect();
    entries.sort_by_key(|e| e.file_name());
    for entry in entries {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().into_owned();
        if entry.file_type().is_ok_and(|t| t.is_dir()) {
            walk(&path, root, out);
        } else if SWEPT_SUFFIXES.iter().any(|s| name.ends_with(s)) {
            out.push(
                path.strip_prefix(root)
                    .unwrap_or(&path)
                    .to_string_lossy()
                    .into_owned(),
            );
        }
    }
}

fn leftovers(root: &Path) -> Check {
    let name = "Runtime: no leftover shell or interpreter hooks";
    let mut found = Vec::new();
    // Both trees a hook can live in: the hooks directory, and a skill's own
    // bin/, where the skill-scoped guards sit.
    walk(&root.join(".claude/hooks"), root, &mut found);
    let mut skills: Vec<_> = std::fs::read_dir(root.join(".claude/skills"))
        .into_iter()
        .flatten()
        .filter_map(Result::ok)
        .collect();
    skills.sort_by_key(|e| e.file_name());
    for skill in skills
        .iter()
        .filter(|e| e.file_name() != ".venv" && e.path().is_dir())
    {
        walk(&skill.path().join("bin"), root, &mut found);
    }
    if found.is_empty() {
        row(
            name,
            Status::Ok,
            format!("No {} file on any hook path.", SWEPT_SUFFIXES.join("/")),
            None,
        )
    } else {
        row(
            name,
            Status::Fail,
            format!("Still present: {}.", found.join(", ")),
            Some("Port the hook or guard to a .cjs module and delete the script."),
        )
    }
}

/// Every configured registration starts cleanly, and nothing unrunnable is left behind.
pub fn checks(settings: &Value, root: &Path, project: &Path) -> Vec<Check> {
    let mut offenders = Vec::new();
    for (event, tool, input) in events() {
        let req = Request {
            project,
            event,
            tool,
            tool_input: input,
            only: None,
        };
        for r in run_configured_hook(settings, &req) {
            if matches!(r.status, None | Some(126) | Some(127)) || is_runtime_error(&r.stderr) {
                let tool = tool.map(|t| format!("/{t}")).unwrap_or_default();
                let status = r.status.map_or("null".to_string(), |s| s.to_string());
                offenders.push(format!("{event}{tool}:{} (exit {status})", r.script));
            }
        }
    }
    let name = "Runtime: every configured hook executes cleanly";
    let sweep = if offenders.is_empty() {
        row(
            name,
            Status::Ok,
            "Every registration started and returned cleanly.",
            None,
        )
    } else {
        row(
            name,
            Status::Fail,
            format!("Load or runtime error in: {}.", offenders.join("; ")),
            Some("Fix the offending hook, or correct its registration in settings.json."),
        )
    };
    vec![sweep, leftovers(root)]
}
