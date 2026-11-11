//! Root-anchored script commands for Codex skills.
//!
//! Codex runs a skill's commands from the project root, not the skill
//! directory (probe (a), 2026-11-10), so `node scripts/x.cjs` in skill `s`
//! would miss. A command whose script exists in the skill is rewritten to
//! `node .agents/skills/s/scripts/x.cjs` (a global install: the absolute
//! path); anything else is left as written.
use std::collections::BTreeSet;

const INTERPRETERS: &[&str] = &["node", "python3", "python", "bash", "sh"];

/// Rewrite `text` from skill `skill`; `has` answers whether a skill-relative
/// path exists in that skill, and `anchor` turns `<skill>/<path>` into the text
/// to write, told whether the source already opened a double quote around
/// it. Returns `None` when nothing changed.
pub fn root_anchor(
    text: &str,
    skill: &str,
    has: &BTreeSet<String>,
    anchor: &dyn Fn(&str, bool) -> String,
) -> Option<String> {
    let mut out = String::with_capacity(text.len());
    let mut changed = false;
    let mut rest = text;
    while let Some((at, path_start, path)) = next_command(rest, has) {
        out.push_str(&rest[..path_start]);
        out.push_str(&anchor(
            &format!("{skill}/{path}"),
            rest[..path_start].ends_with('"'),
        ));
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

    fn project(p: &str, _quoted: bool) -> String {
        format!(".agents/skills/{p}")
    }

    #[test]
    fn rewrites_commands_whose_script_the_skill_ships() {
        let h = has(&["scripts/a.js", "bin/c.cjs", "scripts/p.py"]);
        assert_eq!(
            root_anchor("then run node scripts/a.js.", "mk-s", &h, &project).unwrap(),
            "then run node .agents/skills/mk-s/scripts/a.js."
        );
        let text =
            "run `node scripts/a.js --x` then `node ./bin/c.cjs`\npython3 \"scripts/p.py\" ok";
        let want = concat!(
            "run `node .agents/skills/mk-s/scripts/a.js --x` then `node .agents/skills/mk-s/bin/c.cjs`\n",
            "python3 \".agents/skills/mk-s/scripts/p.py\" ok",
        );
        assert_eq!(root_anchor(text, "mk-s", &h, &project).unwrap(), want);
    }

    #[test]
    fn leaves_unknown_and_already_anchored_paths_alone() {
        let h = has(&["scripts/a.js"]);
        for text in [
            "node scripts/missing.js",
            "node .agents/skills/mk-s/scripts/a.js",
            "nodes scripts/a.js",
            "npm run node scripts/x",
            "no commands here",
        ] {
            assert_eq!(root_anchor(text, "mk-s", &h, &project), None, "{text}");
        }
    }

    #[test]
    fn an_already_quoted_path_is_not_quoted_twice() {
        let h = has(&["scripts/p.py"]);
        let abs = |p: &str, quoted: bool| {
            let w = format!("/h o/{p}");
            if quoted { w } else { format!("\"{w}\"") }
        };
        assert_eq!(
            root_anchor("python3 \"scripts/p.py\" ok", "mk-s", &h, &abs).unwrap(),
            "python3 \"/h o/mk-s/scripts/p.py\" ok"
        );
        assert_eq!(
            root_anchor("python3 scripts/p.py", "mk-s", &h, &abs).unwrap(),
            "python3 \"/h o/mk-s/scripts/p.py\""
        );
    }
}
