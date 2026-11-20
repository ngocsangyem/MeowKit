//! Skill names and references: the source writes `mk:x` and invokes `/mk:x`;
//! a target names the skill `<prefix>x` and has its own invocation form.
use std::collections::BTreeSet;

use super::scan::{Hit, first, is_slug, is_word, last, replace_each, run};
use super::{Invocation, Target};

/// `x` when `after` opens with a skill slug (`[a-z][a-z0-9-]*`), or the
/// whole placeholder when it opens with one (`[skill]`, `<name>`, `{name}`):
/// a bracketed word, not a character class such as `[a-z-]`.
fn slug(after: &str) -> Option<&str> {
    let close = match first(after)? {
        '[' => ']',
        '<' => '>',
        '{' => '}',
        c if c.is_ascii_lowercase() => return Some(run(after, is_slug)),
        _ => return None,
    };
    let inner = run(&after[1..], |c| c.is_ascii_lowercase());
    (inner.len() > 1 && after[1 + inner.len()..].starts_with(close))
        .then(|| &after[..inner.len() + 2])
}

/// `/mk:x` as a command -> the target's invocation form.
pub fn invocations(text: &str, target: &Target) -> String {
    replace_each(text, "/mk:", |before, after| {
        // Part of a path or URL (`../mk:x`, `a/mk:x`), not a command.
        if last(before).is_some_and(|c| is_word(c) || "/.-".contains(c)) {
            return None;
        }
        let name = slug(after)?;
        let prefix = target.skill_prefix;
        let text = match target.invocation {
            Invocation::Sigil(sigil) => format!("{sigil}{prefix}{name}"),
            Invocation::Prose => format!("the {name} skill"),
        };
        Some(Hit::new(text).after(name.len()))
    })
}

/// `mk:x` -> `<prefix>x`.
pub fn names(text: &str, target: &Target) -> String {
    replace_each(text, "mk:", |before, after| {
        if last(before).is_some_and(is_word) {
            return None;
        }
        let name = slug(after)?;
        Some(Hit::new(format!("{}{name}", target.skill_prefix)).after(name.len()))
    })
}

/// `../x/` naming a sibling skill folder -> `../<prefix>x/`.
pub fn sibling_folders(text: &str, target: &Target, skills: &BTreeSet<String>) -> String {
    replace_each(text, "../", |_, after| {
        let name = &after[..after.find('/')?];
        skills
            .contains(name)
            .then(|| Hit::new(format!("../{}{name}", target.skill_prefix)).after(name.len()))
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::projection::target::CODEX;

    #[test]
    fn a_command_takes_the_invocation_form_and_a_name_the_prefix() {
        let src = "Run `/mk:cook --fast`, then mk:review. See ../mk:rubric/ and a/mk:x.";
        let got = names(&invocations(src, &CODEX), &CODEX);
        assert_eq!(
            got,
            "Run `$mk-cook --fast`, then mk-review. See ../mk-rubric/ and a/mk-x."
        );
    }

    #[test]
    fn a_placeholder_for_a_skill_name_is_renamed_like_a_name() {
        let src = "Run `/mk:[skill]`; `--skill mk:<skill>`; name: mk:{name}; mk:[not a slug]; mk:<>; /^mk:[a-z-]+$/";
        assert_eq!(
            names(&invocations(src, &CODEX), &CODEX),
            "Run `$mk-[skill]`; `--skill mk-<skill>`; name: mk-{name}; mk:[not a slug]; mk:<>; /^mk:[a-z-]+$/"
        );
    }

    #[test]
    fn a_shared_dialect_names_the_skill_in_prose() {
        let shared = Target {
            invocation: Invocation::Prose,
            ..CODEX
        };
        assert_eq!(
            invocations("use /mk:fix now", &shared),
            "use the fix skill now"
        );
    }

    #[test]
    fn text_that_only_looks_like_a_skill_name_is_left() {
        for src in ["cmk:x", "mk:", "mk:X", "mk: x"] {
            assert_eq!(names(src, &CODEX), src);
        }
    }

    #[test]
    fn only_a_known_sibling_folder_is_prefixed() {
        let skills = ["jira".to_owned()].into();
        let src = "`../jira/references/a.md` and `../other/b.md` and `../jira-x/c.md`";
        assert_eq!(
            sibling_folders(src, &CODEX, &skills),
            "`../mk-jira/references/a.md` and `../other/b.md` and `../jira-x/c.md`"
        );
    }
}
