//! Root-anchored helper paths. A target that runs a skill's commands from the
//! project root cannot resolve `scripts/x` written relative to the skill.
use std::collections::BTreeSet;

use super::scan::{Hit, is_word, last, replace_each, run};

const HELPER_DIRS: &[&str] = &["scripts/", "bin/"];

/// How the source note that tells the reader to prefix skill-relative script
/// paths by hand begins (`scripts/rewrite-own-skill-paths.cjs` keeps it in
/// step-file skills).
const RELATIVE_PATH_NOTE: &str = "> Script paths in this skill's other files";

/// Drop the relative-path note: once [`helper_paths`] has anchored the paths
/// it would tell the reader to prefix them a second time.
pub fn drop_relative_path_note(text: &str) -> String {
    let kept: Vec<&str> = text
        .split('\n')
        .filter(|line| !line.starts_with(RELATIVE_PATH_NOTE))
        .collect();
    kept.join("\n")
}

/// Prefix each `scripts/…` or `bin/…` path the skill ships with `own`, the
/// skill's installed folder. A path that is already part of a longer one, or
/// that the skill does not ship, is left as written.
pub fn helper_paths(text: &str, own: &str, files: &BTreeSet<String>) -> String {
    let mut out = text.to_owned();
    for dir in HELPER_DIRS {
        out = replace_each(&out, dir, |before, after| {
            let dot_slash = if before.ends_with("./") { 2 } else { 0 };
            let context = &before[..before.len() - dot_slash];
            if last(context).is_some_and(|c| is_word(c) || "/.{}-".contains(c)) {
                return None;
            }
            let tail = run(after, |c| !c.is_whitespace() && !"`'\")".contains(c));
            // Sentence punctuation after a path is not part of it.
            let path = format!("{dir}{}", tail.trim_end_matches(['.', ',', ';', ':']));
            files
                .contains(&path)
                .then(|| Hit::new(format!("{own}/{dir}")).before(dot_slash))
        });
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn files() -> BTreeSet<String> {
        ["scripts/a.js", "bin/c.cjs"].map(str::to_owned).into()
    }

    #[test]
    fn a_shipped_helper_is_anchored_with_or_without_an_interpreter() {
        let src = "run node scripts/a.js. Then `./bin/c.cjs --x` and \"$ROOT/scripts/a.js\"";
        assert_eq!(
            helper_paths(src, ".agents/skills/mk-s", &files()),
            "run node .agents/skills/mk-s/scripts/a.js. Then `.agents/skills/mk-s/bin/c.cjs --x` and \"$ROOT/scripts/a.js\""
        );
    }

    #[test]
    fn the_note_about_prefixing_paths_by_hand_is_dropped() {
        let src = "# T\n\n> Script paths in this skill's other files (references, steps) are relative.\n\nBody\n";
        assert_eq!(drop_relative_path_note(src), "# T\n\n\nBody\n");
    }

    #[test]
    fn unknown_and_already_anchored_paths_are_left() {
        for src in [
            "node scripts/missing.js",
            "node .agents/skills/mk-s/scripts/a.js",
            "../scripts/a.js",
            "my-scripts/a.js",
        ] {
            assert_eq!(helper_paths(src, ".agents/skills/mk-s", &files()), src);
        }
    }
}
