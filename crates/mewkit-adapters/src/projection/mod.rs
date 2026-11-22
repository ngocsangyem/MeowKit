//! Projection: the authored `.claude/` kit rewritten, by rule, into the form
//! another runtime documents. Each rule is a pure function over text; a
//! [`Target`] holds what differs between runtimes.
use std::collections::BTreeSet;

pub mod agent;
pub mod anchor;
pub mod frontmatter;
mod headings;
mod host_words;
pub mod overlay;
mod paths;
pub mod reader;
mod scan;
pub mod script;
mod skill_names;
pub mod target;
pub mod tree;

pub use overlay::Overlay;
pub use reader::{Skill, read_skills};
pub use tree::{Tree, project_tree};

/// How a target writes "run this skill" in instruction text.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Invocation {
    /// A sigil in front of the skill name, e.g. `$mk-cook`.
    Sigil(&'static str),
    /// No sigil: "the cook skill". For a skills root that several runtimes
    /// read, where no one invocation form is valid for all of them.
    Prose,
}

/// What a runtime needs said differently from the authored text.
#[derive(Debug, Clone, Copy)]
pub struct Target {
    /// Where skills install, relative to the project root.
    pub skills_root: &'static str,
    /// Prefix on the skill folder and name (`mk-` for `mk-cook`).
    pub skill_prefix: &'static str,
    pub invocation: Invocation,
    /// The runtime's own config folder (`.codex`).
    pub host_dir: &'static str,
    /// Product name, and the same word as typed in a command.
    pub host_name: &'static str,
    pub host_word: &'static str,
    /// The always-loaded instruction file.
    pub context_file: &'static str,
    /// Extension of an agent definition file.
    pub agent_ext: &'static str,
    /// Name of the per-plugin data directory variable.
    pub plugin_data_var: &'static str,
    /// Shell expression for the project root.
    pub project_root_expr: &'static str,
    /// Always-on rule file -> the section of `context_file` that carries it.
    pub rule_sections: &'static [(&'static str, &'static str)],
    /// Literal path replacements applied, in order, before `.claude/` becomes `host_dir`.
    pub paths: &'static [(&'static str, &'static str)],
    /// Authored agent `model` tier -> the id this runtime pins for it.
    pub model_pins: &'static [(&'static str, &'static str)],
    /// What an agent's text calls the session that routes work, where the
    /// runtime loads no `orchestrator` agent.
    pub router: Option<&'static str>,
}

/// Project the Markdown body of one file of `skill`. `skills` is every skill
/// folder name the kit ships.
pub fn project_skill_body(
    body: &str,
    skill: &Skill,
    skills: &BTreeSet<String>,
    target: &Target,
) -> String {
    project(body, Some(skill), skills, target)
}

/// Project text that belongs to no skill folder: an agent's instructions, a
/// description.
pub fn project_text(text: &str, skills: &BTreeSet<String>, target: &Target) -> String {
    project(text, None, skills, target)
}

/// The order is part of the contract: skill references first, then the path
/// classes from most to least specific, then host words and tools, then anchoring,
/// which needs the final paths. The note about prefixing paths by hand goes
/// first, while it still reads as the source wrote it; links to reworded
/// headings are fixed last, once every heading has its final text.
fn project(
    body: &str,
    skill: Option<&Skill>,
    skills: &BTreeSet<String>,
    target: &Target,
) -> String {
    let text = anchor::drop_relative_path_note(body);
    let text = skill_names::invocations(&text, target);
    let text = skill_names::names(&text, target);
    let text = paths::skills_root(&text, target, skills);
    let text = skill_names::sibling_folders(&text, target, skills);
    let text = match skill {
        Some(skill) => paths::own_folder(&text, target, &skill.name),
        None => text,
    };
    let text = paths::agent_files(&text, target);
    let text = paths::rule_files(&text, target);
    let text = host_words::environment(&text, target);
    let text = paths::host_paths(&text, target);
    let text = host_words::host_name(&text, target);
    let text = host_words::host_tools(&text);
    let text = match skill {
        Some(skill) => {
            let own = format!(
                "{}/{}{}",
                target.skills_root, target.skill_prefix, skill.name
            );
            anchor::helper_paths(&text, &own, &skill.files)
        }
        None => text,
    };
    headings::follow(body, text, |link| host_words::host_name(link, target))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_rules_compose_on_one_line() {
        let skill = Skill {
            name: "cook".into(),
            files: ["scripts/run.sh".to_owned()].into(),
        };
        let skills = ["cook".to_owned(), "review".to_owned()].into();
        let src = "Run `/mk:review`, read `.claude/skills/review/SKILL.md` and \
                   `.claude/rules/security-rules.md`, then `bash scripts/run.sh` in Claude Code.";
        assert_eq!(
            project_skill_body(src, &skill, &skills, &target::CODEX),
            "Run `$mk-review`, read `.agents/skills/mk-review/SKILL.md` and \
             AGENTS.md (Security), then `bash .agents/skills/mk-cook/scripts/run.sh` in Codex."
        );
    }
}
