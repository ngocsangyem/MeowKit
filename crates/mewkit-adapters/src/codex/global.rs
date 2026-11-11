//! Codex at global scope: the bundle's `.codex/` tree goes to `CODEX_HOME`
//! (`~/.codex`), its `AGENTS.md` guidance to a block in `<CODEX_HOME>/AGENTS.md`
//! (never `~/AGENTS.md`, which Codex does not read), skills to `~/.agents/skills`.
//! Only the privacy hook is registered, at its absolute path.
use std::path::Path;

use serde_json::Value;

use crate::contract::{EmitError, Scope};
use crate::kit_files::rel;

pub const AGENTS_MD: &str = ".codex/AGENTS.md";
const PROJECT_ROOT: &str = "\"$(git rev-parse --show-toplevel)/";

/// True for a handler a global install registers.
pub fn keeps(handler: &Value) -> bool {
    command(handler).is_some_and(|c| c.contains("/privacy-block.cjs"))
}

/// `handler` with its `"$(git rev-parse --show-toplevel)/<path>"` word
/// replaced by the quoted absolute path of `<path>` at this scope.
pub fn anchor(handler: &mut Value, scope: &Scope) -> Result<(), EmitError> {
    let Some(cmd) = command(handler) else {
        return Ok(());
    };
    let mut out = String::new();
    let mut rest = cmd;
    while let Some(at) = rest.find(PROJECT_ROOT) {
        let inner = &rest[at + PROJECT_ROOT.len()..];
        let end = inner
            .find('"')
            .ok_or_else(|| EmitError::Kit(format!("Codex hook `{cmd}` has an unclosed quote")))?;
        out.push_str(&rest[..at]);
        out.push_str(&quote(&scope.resolve(&rel(&inner[..end])?), cfg!(windows)));
        rest = &inner[end + 1..];
    }
    out.push_str(rest);
    if out.contains("git rev-parse") {
        return Err(EmitError::Kit(format!(
            "Codex hook `{cmd}` finds the project root, which a global install has none of"
        )));
    }
    handler["command"] = Value::String(out);
    Ok(())
}

fn command(handler: &Value) -> Option<&str> {
    handler.get("command").and_then(Value::as_str)
}

/// `path` for a place that already sits inside double quotes (`quoted`), or
/// as a word of its own.
pub fn quote_in(path: &Path, windows: bool, quoted: bool) -> String {
    let word = quote(path, windows);
    if quoted {
        word[1..word.len() - 1].to_owned()
    } else {
        word
    }
}

/// `path` as one shell word. POSIX shells: double quotes with `\ " $ ``
/// escaped. Windows: double quotes, which a Windows path cannot contain.
pub fn quote(path: &Path, windows: bool) -> String {
    let text = path.display().to_string();
    if windows {
        return format!("\"{text}\"");
    }
    let mut out = String::from("\"");
    for c in text.chars() {
        if matches!(c, '\\' | '"' | '$' | '`') {
            out.push('\\');
        }
        out.push(c);
    }
    out.push('"');
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn quoting_survives_spaces_and_shell_characters() {
        assert_eq!(
            quote(Path::new("/home/a b/$x`\"\\/h.cjs"), false),
            r#""/home/a b/\$x\`\"\\/h.cjs""#
        );
        assert_eq!(
            quote(Path::new(r"C:\Users\a b\.codex\h.cjs"), true),
            r#""C:\Users\a b\.codex\h.cjs""#
        );
        assert_eq!(quote_in(Path::new("/a b/$x"), false, true), r"/a b/\$x");
    }

    #[test]
    fn the_project_root_word_becomes_the_absolute_path() {
        let home = tempfile::tempdir().unwrap();
        let scope = Scope::global(home.path(), |_| None).unwrap();
        let mut h = json!({"type": "command", "command": "node \"$(git rev-parse --show-toplevel)/.codex/hooks/privacy-block.cjs\" --x"});
        assert!(keeps(&h));
        anchor(&mut h, &scope).unwrap();
        let want = quote(
            &scope.resolve(&rel(".codex/hooks/privacy-block.cjs").unwrap()),
            cfg!(windows),
        );
        assert_eq!(h["command"], format!("node {want} --x"));
        let mut bad = json!({"command": "cd $(git rev-parse --show-toplevel) && node x"});
        assert!(anchor(&mut bad, &scope).is_err());
    }
}
