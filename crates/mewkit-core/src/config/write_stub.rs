//! Render `.meowkit/config.yaml`: a commented stub per key, and nothing turned
//! on.
//!
//! Every preference is written commented out, so an uncommented line in a
//! project's config is a decision someone made rather than a default the
//! installer happened to pick. That matters because the file is committed: a
//! reviewer reading the diff should see the project's choices, not a wall of
//! values identical to the built-in ones.
//!
//! The `$schema` line is the one exception and is written live. It is not a
//! preference and has no default to confuse: it is what makes an editor validate
//! the file as it is typed, and a commented pointer validates nothing.
use std::collections::BTreeMap;

use super::schema::{KeySpec, SCALAR_KEYS, SCHEMA_URL, ValueKind, key_doc};

const HEADER: &[&str] = &[
    "# MeowKit project configuration — committed, human-owned, schema-validated.",
    "#",
    "# Every setting below is commented out. Uncomment only what this project",
    "# decides, so the committed file reads as a list of choices rather than a",
    "# copy of the defaults.",
    "#",
    "# Two levels of keys; values are true/false, whole numbers or plain strings.",
    "# A gate is not a preference: there is no `gates.` or `paths.` key at any",
    "# scope, and an unknown key is an error rather than being ignored.",
];

const HOOKS_NOTE: &[&str] = &[
    "# hooks.<name>: false switches one observer off. The seven hard-blocking",
    "# checks are absent on purpose — they cannot be disabled from this file.",
];

/// An example value per numeric key. A stub a user uncomments has to be a value
/// the loader accepts: `0` would parse and then mean something nobody chose.
///
/// The three budget examples are USD, the unit the tracker reads them in, and
/// the warn/block pair repeats the tracker's own defaults — a shipped example
/// that raised the hard block would hand a new project a weaker cost brake than
/// it would have had with no config at all.
const EXAMPLE: &[(&str, &str)] = &[
    ("budget.cap", "50"),
    ("budget.warn", "30"),
    ("budget.block", "100"),
    ("buildVerify.timeoutMs", "120000"),
    ("projectContext.maxBytes", "16000"),
];

fn leaf_of(key: &str) -> &str {
    key.split_once('.').map_or(key, |(_, leaf)| leaf)
}

fn indent_of(key: &str) -> &'static str {
    if key.contains('.') { "  " } else { "" }
}

/// The explanation above a stub, commented at the key's own depth.
fn doc_line(indent: &str, doc: &str) -> String {
    if indent.is_empty() {
        format!("# {doc}")
    } else {
        format!("#{indent}# {doc}")
    }
}

fn spec_of(key: &str) -> Option<KeySpec> {
    SCALAR_KEYS
        .iter()
        .find(|(known, _)| *known == key)
        .map(|(_, spec)| *spec)
}

fn placeholder_for(key: &str) -> String {
    let Some(spec) = spec_of(key) else {
        return "false".to_string();
    };
    if let Some(allowed) = spec.allowed {
        return allowed.first().unwrap_or(&"").to_string();
    }
    match spec.kind {
        ValueKind::Boolean => "false".to_string(),
        ValueKind::Integer => EXAMPLE
            .iter()
            .find(|(known, _)| *known == key)
            .map_or("0", |(_, example)| *example)
            .to_string(),
        ValueKind::String => "\"\"".to_string(),
    }
}

/// One `# key: value` stub line, prefixed by its one-line explanation.
fn stub(key: &str) -> Vec<String> {
    let indent = indent_of(key);
    let choices = match spec_of(key).and_then(|spec| spec.allowed) {
        Some(allowed) => format!("   # one of: {}", allowed.join(", ")),
        None => String::new(),
    };
    let line = format!(
        "#{indent}{}: {}{choices}",
        leaf_of(key),
        placeholder_for(key)
    );
    match key_doc(key) {
        Some(doc) => vec![doc_line(indent, doc), line],
        None => vec![line],
    }
}

/// The whole file. `observer_names` are the project's kebab-case observer keys,
/// so the stub cannot name a toggle that has no handler. `chosen` holds values a
/// migration carried over, written UNCOMMENTED: they arrived from a file the
/// user had already edited, so they are their choice and must keep acting like
/// one.
pub fn render_config_stub(observer_names: &[String], chosen: &BTreeMap<String, String>) -> String {
    let mut lines: Vec<String> = HEADER.iter().map(|line| (*line).to_string()).collect();
    lines.push(String::new());
    lines.push(format!("$schema: {SCHEMA_URL}"));
    lines.push(String::new());

    let mut top_level: Vec<&str> = Vec::new();
    let mut groups: Vec<(&str, Vec<&str>)> = Vec::new();
    for (key, _) in SCALAR_KEYS {
        match key.split_once('.') {
            None => top_level.push(key),
            Some((parent, _)) => match groups.iter_mut().find(|(name, _)| *name == parent) {
                Some((_, keys)) => keys.push(key),
                None => groups.push((parent, vec![key])),
            },
        }
    }

    let emit = |key: &str| -> Vec<String> {
        let Some(value) = chosen.get(key) else {
            return stub(key);
        };
        let indent = indent_of(key);
        let line = format!("{indent}{}: {value}", leaf_of(key));
        match key_doc(key) {
            Some(doc) => vec![doc_line(indent, doc), line],
            None => vec![line],
        }
    };

    for key in top_level {
        lines.extend(emit(key));
        lines.push(String::new());
    }

    for (parent, keys) in groups {
        let any_chosen = keys.iter().any(|key| chosen.contains_key(*key));
        lines.push(if any_chosen {
            format!("{parent}:")
        } else {
            format!("#{parent}:")
        });
        for key in keys {
            lines.extend(emit(key));
        }
        lines.push(String::new());
    }

    let mut hook_keys: Vec<&String> = observer_names.iter().collect();
    hook_keys.sort();
    let any_hook_chosen = hook_keys
        .iter()
        .any(|name| chosen.contains_key(&format!("hooks.{name}")));
    lines.extend(HOOKS_NOTE.iter().map(|line| (*line).to_string()));
    lines.push(if any_hook_chosen {
        "hooks:".to_string()
    } else {
        "#hooks:".to_string()
    });
    for name in hook_keys {
        match chosen.get(&format!("hooks.{name}")) {
            Some(value) => lines.push(format!("  {name}: {value}")),
            None => lines.push(format!("#  {name}: false")),
        }
    }
    lines.push(String::new());
    lines.join("\n")
}

#[cfg(test)]
#[path = "write_stub_tests.rs"]
mod write_stub_tests;
