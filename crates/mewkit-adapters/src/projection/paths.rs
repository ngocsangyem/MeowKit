//! Path classes: where the source says `.claude/…`, a target has its own
//! skills root, agent files, rule destination and helper script locations.
use std::collections::BTreeSet;

use super::Target;
use super::scan::{Hit, is_slug, is_word, replace_each, run};

/// `.claude/skills[/<skill>]` -> the target's skills root, the folder prefixed
/// when it names a skill the kit ships.
pub fn skills_root(text: &str, target: &Target, skills: &BTreeSet<String>) -> String {
    replace_each(text, ".claude/skills", |_, after| {
        let folder = after
            .strip_prefix('/')
            .map(|rest| run(rest, |c| is_word(c) || c == '-'))
            .filter(|name| skills.contains(*name));
        Some(match folder {
            Some(name) => Hit::new(format!(
                "{}/{}{name}",
                target.skills_root, target.skill_prefix
            ))
            .after(1 + name.len()),
            None => Hit::new(target.skills_root),
        })
    })
}

/// `${CLAUDE_SKILL_DIR}` -> the skill's own installed folder.
pub fn own_folder(text: &str, target: &Target, skill: &str) -> String {
    let own = format!("{}/{}{skill}", target.skills_root, target.skill_prefix);
    text.replace("${CLAUDE_SKILL_DIR}", &own)
}

/// `.claude/agents/<a>.md` -> the target's agent file.
pub fn agent_files(text: &str, target: &Target) -> String {
    replace_each(text, ".claude/agents/", |_, after| {
        let name = run(after, is_slug);
        (!name.is_empty() && after[name.len()..].starts_with(".md")).then(|| {
            Hit::new(format!(
                "{}/agents/{name}.{}",
                target.host_dir, target.agent_ext
            ))
            .after(name.len() + ".md".len())
        })
    })
}

/// `.claude/rules/<file>.md` -> the section of the target's context file that
/// carries that rule, code quotes dropped. A file with no listed section is left.
pub fn rule_files(text: &str, target: &Target) -> String {
    replace_each(text, ".claude/rules/", |before, after| {
        let stem = run(after, |c| c.is_ascii_lowercase() || c == '-');
        let rest = after[stem.len()..].strip_prefix(".md")?;
        let file = &after[..stem.len() + ".md".len()];
        let (_, section) = target.rule_sections.iter().find(|(f, _)| *f == file)?;
        // Drop the code quotes only as a pair: in `cat .claude/rules/x.md`
        // the closing quote belongs to the whole command.
        let quoted = before.ends_with('`') && rest.starts_with('`');
        Some(
            Hit::new(format!("{} ({section})", target.context_file))
                .before(usize::from(quoted))
                .after(file.len() + usize::from(quoted)),
        )
    })
}

/// The target's literal path map, in order, then every other `.claude/`.
pub fn host_paths(text: &str, target: &Target) -> String {
    let mut out = text.to_owned();
    for (from, to) in target.paths {
        out = out.replace(from, to);
    }
    out.replace(".claude/", &format!("{}/", target.host_dir))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::projection::target::CODEX;

    fn skills() -> BTreeSet<String> {
        ["cook".to_owned(), "jira".to_owned()].into()
    }

    #[test]
    fn a_shipped_skill_folder_is_prefixed_and_any_other_path_only_moved() {
        let src = "`.claude/skills/cook/references/a.md`, `.claude/skills/{name}/`, \
                   --path .claude/skills, .claude/skills/jira-x/, .claude/skills/jira";
        assert_eq!(
            skills_root(src, &CODEX, &skills()),
            "`.agents/skills/mk-cook/references/a.md`, `.agents/skills/{name}/`, \
             --path .agents/skills, .agents/skills/jira-x/, .agents/skills/mk-jira"
        );
    }

    #[test]
    fn the_own_folder_variable_becomes_the_installed_path() {
        assert_eq!(
            own_folder("node \"${CLAUDE_SKILL_DIR}/scripts/a.cjs\"", &CODEX, "cook"),
            "node \".agents/skills/mk-cook/scripts/a.cjs\""
        );
    }

    #[test]
    fn an_agent_file_takes_the_target_extension() {
        assert_eq!(
            agent_files("see .claude/agents/advisor.md and .claude/agents/", &CODEX),
            "see .codex/agents/advisor.toml and .claude/agents/"
        );
    }

    #[test]
    fn a_rule_file_becomes_its_section_and_an_unlisted_one_is_left() {
        let src = "per `.claude/rules/injection-rules.md` Rule 3; \
                   .claude/rules/security-rules.md; `cat .claude/rules/core-behaviors.md`; \
                   `.claude/rules/other.md`; .claude/rules/";
        assert_eq!(
            rule_files(src, &CODEX),
            "per AGENTS.md (Data & injection boundary) Rule 3; \
             AGENTS.md (Security); `cat AGENTS.md (Core behaviors)`; \
             `.claude/rules/other.md`; .claude/rules/"
        );
    }

    #[test]
    fn listed_paths_win_over_the_host_folder_swap() {
        let src = "node .claude/hooks/lib/skill-python.cjs x; .claude/hooks/lib/a.cjs; .claude/b";
        assert_eq!(
            host_paths(src, &CODEX),
            "node .codex/scripts/skill-python.cjs x; .codex/scripts/bin/a.cjs; .codex/b"
        );
    }
}
