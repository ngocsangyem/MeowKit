//! Helper commands in Codex skills at global scope.
//!
//! Codex runs a skill's commands from the project root, not the skill
//! directory (probe (a), 2026-11-10), so projection writes them from the
//! project root: `node .agents/skills/s/scripts/x.cjs`. A global install has
//! no skills under the project, so a command whose script the skill ships is
//! rewritten to the script's absolute path; anything else is left as written.
use std::collections::BTreeSet;

const INTERPRETERS: &[&str] = &["node", "python3", "python", "bash", "sh"];

/// Rewrite the commands in `text`; `has` holds the installed paths of the
/// skill's files, and `anchor` turns one into the text to write, told whether
/// the source already opened a double quote around it. Returns `None` when
/// nothing changed.
pub fn root_anchor(
    text: &str,
    has: &BTreeSet<String>,
    anchor: &dyn Fn(&str, bool) -> String,
) -> Option<String> {
    let mut out = String::with_capacity(text.len());
    let mut changed = false;
    let mut rest = text;
    while let Some((at, path_start, path)) = next_command(rest, has) {
        out.push_str(&rest[..path_start]);
        out.push_str(&anchor(path, rest[..path_start].ends_with('"')));
        changed = true;
        let consumed =
            path_start + path.len() + usize::from(rest[path_start..].starts_with("./")) * 2;
        rest = &rest[consumed.max(at + 1)..];
    }
    out.push_str(rest);
    changed.then_some(out)
}

/// The next `<interpreter> [./]<path>` whose path the skill has: the match
/// start, where the path (including any `./`) starts, and the path without `./`.
fn next_command<'a>(text: &'a str, has: &BTreeSet<String>) -> Option<(usize, usize, &'a str)> {
    let mut from = 0;
    loop {
        let (at, word) = INTERPRETERS
            .iter()
            .filter_map(|w| find_word(text, from, w).map(|i| (i, *w)))
            .min_by_key(|(i, _)| *i)?;
        let mut p = at + word.len();
        if !text[p..].starts_with(' ') {
            from = p;
            continue;
        }
        p += 1;
        if text[p..].starts_with('"') {
            p += 1;
        }
        let token_end = text[p..]
            .find(|c: char| c.is_whitespace() || "`'\")".contains(c))
            .map_or(text.len(), |j| p + j);
        // Sentence punctuation after a command is not part of the path.
        let token = text[p..token_end].trim_end_matches(['.', ',', ';', ':']);
        let path = token.strip_prefix("./").unwrap_or(token);
        if has.contains(path) {
            return Some((at, p, path));
        }
        from = p.max(at + 1);
    }
}

/// `word` at a word boundary in `text[from..]`.
fn find_word(text: &str, from: usize, word: &str) -> Option<usize> {
    let mut i = from;
    while let Some(j) = text[i..].find(word) {
        let at = i + j;
        let before_ok = text[..at]
            .chars()
            .next_back()
            .is_none_or(|c| !(c.is_alphanumeric() || c == '_' || c == '-' || c == '/' || c == '.'));
        if before_ok {
            return Some(at);
        }
        i = at + word.len();
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    fn has(paths: &[&str]) -> BTreeSet<String> {
        paths.iter().map(|s| (*s).to_owned()).collect()
    }

    /// The absolute path under a home directory with a space in it.
    fn home(p: &str, quoted: bool) -> String {
        let w = format!("/h o/{p}");
        if quoted { w } else { format!("\"{w}\"") }
    }

    #[test]
    fn rewrites_commands_whose_script_the_skill_ships() {
        let h = has(&[
            ".agents/skills/mk-s/scripts/a.js",
            ".agents/skills/mk-s/bin/c.cjs",
        ]);
        assert_eq!(
            root_anchor("then run node .agents/skills/mk-s/scripts/a.js.", &h, &home).unwrap(),
            "then run node \"/h o/.agents/skills/mk-s/scripts/a.js\"."
        );
        let text = "run `node .agents/skills/mk-s/scripts/a.js --x` then `node ./.agents/skills/mk-s/bin/c.cjs`";
        let want = "run `node \"/h o/.agents/skills/mk-s/scripts/a.js\" --x` then `node \"/h o/.agents/skills/mk-s/bin/c.cjs\"`";
        assert_eq!(root_anchor(text, &h, &home).unwrap(), want);
    }

    #[test]
    fn leaves_unknown_paths_and_other_words_alone() {
        let h = has(&[".agents/skills/mk-s/scripts/a.js"]);
        for text in [
            "node .agents/skills/mk-s/scripts/missing.js",
            "node scripts/a.js",
            "nodes .agents/skills/mk-s/scripts/a.js",
            "no commands here",
        ] {
            assert_eq!(root_anchor(text, &h, &home), None, "{text}");
        }
    }

    #[test]
    fn an_already_quoted_path_is_not_quoted_twice() {
        let h = has(&[".agents/skills/mk-s/scripts/p.py"]);
        assert_eq!(
            root_anchor("python3 \".agents/skills/mk-s/scripts/p.py\" ok", &h, &home).unwrap(),
            "python3 \"/h o/.agents/skills/mk-s/scripts/p.py\" ok"
        );
    }
}
