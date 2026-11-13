//! The runtime contract a SKILL.md frontmatter has to satisfy.
//!
//! `requires_runtime` names an INTERPRETER the project may not have installed;
//! `runtime` names the agent EXECUTION ENVIRONMENT. The two were one
//! permissive, unvalidated key away from being used interchangeably, and a
//! skill whose interpreter requirement lands in the wrong field gets no
//! environment at all — so both confusions are errors, in both directions.
//! Port of `core/skill-runtime-contract.ts`.
use std::path::Path;
use std::sync::LazyLock;

use regex::Regex;
use serde_json::{Map, Value};

/// The frontmatter key that names an interpreter.
pub const RUNTIME_KEY: &str = "requires_runtime";

/// Values that belong in `runtime`; naming one in `requires_runtime` is a
/// confusion.
const EXECUTION_ENVIRONMENTS: [&str; 3] = ["claude-code", "portable", "experimental"];

/// Interpreter families; naming one in `runtime` is the mirror-image confusion.
const INTERPRETERS: [&str; 10] = [
    "python", "python3", "node", "ruby", "php", "perl", "go", "java", "deno", "bun",
];

/// How deep a skill directory is walked when looking for its own files.
const MAX_DEPTH: usize = 3;

static INTERPRETER_HEAD: LazyLock<Regex> = LazyLock::new(|| {
    crate::js_regex::compile("^[a-zA-Z][a-zA-Z0-9_.-]*").expect("a static interpreter pattern")
});

/// A scalar or a list of strings, as the frontmatter may carry either.
fn values(value: Option<&Value>) -> Vec<String> {
    match value {
        Some(Value::String(text)) => vec![text.clone()],
        Some(Value::Array(items)) => items
            .iter()
            .filter_map(Value::as_str)
            .map(str::to_string)
            .collect(),
        _ => Vec::new(),
    }
}

/// Interpreter family of an entry: `python>=3.9` → `python`.
fn interpreter_of(entry: &str) -> String {
    INTERPRETER_HEAD
        .find(entry)
        .map(|m| m.as_str().to_lowercase())
        .unwrap_or_default()
}

/// Both field confusions, plus an unrecognised interpreter family.
pub fn runtime_contract_errors(meta: &Map<String, Value>) -> Vec<String> {
    let mut errors = Vec::new();
    for value in values(meta.get("runtime")) {
        if INTERPRETERS.contains(&interpreter_of(&value).as_str()) {
            errors.push(format!(
                "'runtime: {value}' names an interpreter — use '{RUNTIME_KEY}' for that"
            ));
        }
    }
    for entry in values(meta.get(RUNTIME_KEY)) {
        if EXECUTION_ENVIRONMENTS.contains(&entry.to_lowercase().as_str()) {
            errors.push(format!(
                "'{RUNTIME_KEY}: {entry}' names an execution environment — use 'runtime' for that"
            ));
        } else if !INTERPRETERS.contains(&interpreter_of(&entry).as_str()) {
            errors.push(format!(
                "'{RUNTIME_KEY}: {entry}' names no known interpreter"
            ));
        }
    }
    errors
}

/// Walk a skill directory, bounded, letting the visitor decide on descent.
fn walk(dir: &Path, depth: usize, visit: &mut impl FnMut(&Path, &str, bool) -> bool) {
    if depth > MAX_DEPTH {
        return;
    }
    for entry in super::dir_order::sorted_entries(dir) {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().into_owned();
        let is_dir = path.is_dir();
        let descend = visit(&path, &name, is_dir);
        if is_dir && descend {
            walk(&path, depth + 1, visit);
        }
    }
}

/// Every `.md` under a skill directory, concatenated — the skill's own prose.
fn markdown_corpus(skill_dir: &Path) -> String {
    let mut parts = Vec::new();
    walk(skill_dir, 0, &mut |path, name, is_dir| {
        if !is_dir
            && name.ends_with(".md")
            && let Ok(bytes) = std::fs::read(path)
        {
            parts.push(String::from_utf8_lossy(&bytes).into_owned());
        }
        true
    });
    parts.join("\n")
}

/// Non-test `.py` files on a skill's DOCUMENTED invocation path: a script that
/// exists AND is named by the skill's own markdown. A `.py` nothing documents
/// is not something a user is told to run, so it obliges no declaration.
pub fn documented_python_scripts(skill_dir: &Path) -> Vec<String> {
    let mut scripts: Vec<String> = Vec::new();
    walk(skill_dir, 0, &mut |path, name, is_dir| {
        if is_dir {
            return name != "tests" && name != "__pycache__";
        }
        if name.ends_with(".py") && !name.starts_with("test_") {
            scripts.push(
                path.strip_prefix(skill_dir)
                    .unwrap_or(path)
                    .to_string_lossy()
                    .into_owned(),
            );
        }
        false
    });
    let prose = markdown_corpus(skill_dir);
    scripts
        .into_iter()
        .filter(|rel| {
            let base = Path::new(rel)
                .file_name()
                .map(|name| name.to_string_lossy().into_owned())
                .unwrap_or_default();
            prose.contains(&base)
        })
        .collect()
}

#[cfg(test)]
#[path = "runtime_contract_tests.rs"]
mod runtime_contract_tests;
