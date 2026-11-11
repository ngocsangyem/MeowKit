//! Reading kit script paths out of hook file entries: commands are split into
//! words outside quotes, `args` entries are whole paths, and the project root's
//! spellings (`$CLAUDE_PROJECT_DIR`, `git rev-parse`, `%CLAUDE_PROJECT_DIR%`)
//! become one.

/// How kit hook commands name the project root; each becomes [`ROOT`].
const ROOT_FORMS: [&str; 4] = [
    "$(git rev-parse --show-toplevel)/",
    "${CLAUDE_PROJECT_DIR}/",
    "$CLAUDE_PROJECT_DIR/",
    "%CLAUDE_PROJECT_DIR%/",
];
pub const ROOT: &str = "$ROOT/";

/// Forward slashes and one spelling of the project root.
pub fn normalize(s: &str) -> String {
    ROOT_FORMS
        .iter()
        .fold(s.replace('\\', "/"), |c, form| c.replace(form, ROOT))
}

/// Scripts named in a command line, root forms normalized. Words are split on
/// whitespace outside quotes, so a quoted path with spaces stays one word.
pub fn kit_scripts(command: &str) -> Vec<String> {
    words(&normalize(command))
        .iter()
        .filter_map(|w| script_token(w))
        .collect()
}

/// A script file directly inside a `hooks` directory (any config root, so a
/// relocated `CLAUDE_CONFIG_DIR` or `CODEX_HOME` counts too).
pub fn script_token(word: &str) -> Option<String> {
    let (dir, file) = word.rsplit_once('/')?;
    let in_hooks = dir == "hooks" || dir.ends_with("/hooks");
    let script = [".cjs", ".js", ".mjs", ".sh", ".py"]
        .iter()
        .any(|e| file.ends_with(e));
    (in_hooks && script).then(|| word.to_owned())
}

fn words(s: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut cur = String::new();
    let mut quote = None;
    let mut started = false;
    for c in s.chars() {
        match (quote, c) {
            (Some(q), c) if c == q => quote = None,
            (Some(_), c) => cur.push(c),
            (None, '"' | '\'') => {
                quote = Some(c);
                started = true;
            }
            (None, c) if c.is_whitespace() => {
                if started || !cur.is_empty() {
                    out.push(std::mem::take(&mut cur));
                }
                started = false;
            }
            (None, c) => cur.push(c),
        }
    }
    if started || !cur.is_empty() {
        out.push(cur);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::{kit_scripts, script_token};

    #[test]
    fn finds_kit_hook_scripts_in_commands() {
        assert_eq!(
            kit_scripts(r#"node "$CLAUDE_PROJECT_DIR/.claude/hooks/gate-enforcement.cjs" --x"#),
            ["$ROOT/.claude/hooks/gate-enforcement.cjs"]
        );
        assert_eq!(
            kit_scripts(r#"node "$(git rev-parse --show-toplevel)/.codex/hooks/x.cjs""#),
            ["$ROOT/.codex/hooks/x.cjs"]
        );
        assert_eq!(
            kit_scripts("node .codex/hooks/privacy-block.cjs"),
            [".codex/hooks/privacy-block.cjs"]
        );
        assert_eq!(
            kit_scripts(r#"node "/Users/A B/.codex/hooks/privacy-block.cjs""#),
            ["/Users/A B/.codex/hooks/privacy-block.cjs"]
        );
        assert_eq!(
            kit_scripts(r"node %CLAUDE_PROJECT_DIR%\.claude\hooks\x.cjs"),
            ["$ROOT/.claude/hooks/x.cjs"]
        );
        assert_eq!(
            kit_scripts("node /custom/codex-home/hooks/x.cjs"),
            ["/custom/codex-home/hooks/x.cjs"]
        );
        assert_eq!(
            script_token("/Users/A B/.claude/hooks/x.cjs").as_deref(),
            Some("/Users/A B/.claude/hooks/x.cjs")
        );
        assert!(kit_scripts("say done").is_empty());
        assert!(kit_scripts("node ./my-hooks/x.cjs").is_empty());
    }
}
