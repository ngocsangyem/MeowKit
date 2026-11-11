//! Claude Code at global scope (maintainer decision 2026-11-11): the user-level
//! directory gets agents, skills, rules and the hook scripts, and its
//! `settings.json` only the hooks that hold in every project — the privacy
//! block and the session context — with script paths made absolute.
use serde_json::Value;

use crate::contract::{EmitError, Scope};
use crate::kit_files::rel;

/// What a global install writes under the Claude Code directory.
pub const DIRS: &[&str] = &[
    ".claude/agents",
    ".claude/skills",
    ".claude/rules",
    ".claude/hooks",
];

const PROJECT_DIR: &str = "${CLAUDE_PROJECT_DIR}/";

pub fn installs(path: &str) -> bool {
    DIRS.iter()
        .any(|d| path.strip_prefix(d).is_some_and(|r| r.starts_with('/')))
}

/// True for a handler a global install registers.
pub fn keeps(event: &str, handler: &Value) -> bool {
    event == "SessionStart" || words(handler).any(|w| w.ends_with("/privacy-block.cjs"))
}

/// `handler` with every `${CLAUDE_PROJECT_DIR}/.claude/…` word replaced by
/// the absolute path the global install writes it to. `args` entries are
/// passed to the process unparsed, so a path with spaces needs no quoting.
pub fn anchor(handler: &mut Value, scope: &Scope) -> Result<(), EmitError> {
    let fields = ["command", "args"];
    for field in fields {
        let slots: Vec<&mut Value> = match handler.get_mut(field) {
            Some(Value::Array(items)) => items.iter_mut().collect(),
            Some(v @ Value::String(_)) => vec![v],
            _ => continue,
        };
        for slot in slots {
            let Some(text) = slot.as_str() else { continue };
            if let Some(inner) = text.strip_prefix(PROJECT_DIR) {
                let abs = scope.resolve(&rel(inner)?);
                *slot = Value::String(abs.display().to_string());
            } else if text.contains("${CLAUDE_PROJECT_DIR}") {
                return Err(EmitError::Kit(format!(
                    "settings.json hook `{text}` names the project directory, which a global install has none of"
                )));
            }
        }
    }
    Ok(())
}

fn words(handler: &Value) -> impl Iterator<Item = &str> {
    let command = handler.get("command").and_then(Value::as_str);
    let args = handler
        .get("args")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(Value::as_str);
    command.into_iter().chain(args)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn project_paths_become_absolute_and_unknown_ones_fail() {
        let home = tempfile::tempdir().unwrap();
        let scope = Scope::global(home.path(), |_| None).unwrap();
        let mut h = json!({"command": "node", "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/privacy-block.cjs"]});
        assert!(keeps("PreToolUse", &h));
        anchor(&mut h, &scope).unwrap();
        let arg = h["args"][0].as_str().unwrap();
        assert!(std::path::Path::new(arg).is_absolute(), "{arg}");
        assert!(arg.ends_with("privacy-block.cjs"));
        let mut bad = json!({"command": "cd ${CLAUDE_PROJECT_DIR} && node x"});
        assert!(anchor(&mut bad, &scope).is_err());
        assert!(!keeps(
            "PreToolUse",
            &json!({"command": "node", "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/pre-ship.cjs"]})
        ));
        assert!(installs(".claude/rules/a.md") && !installs(".claude/memory/x"));
        assert!(!installs(".claude/hooksx/a"));
    }
}
