//! Skill files that are not Markdown: scripts, configuration, fixtures.
//!
//! Only paths move. A script's words, skill names and identifiers stay as
//! authored: the prose rules would rename a function or break a pattern, and
//! nothing a runtime loads reads this text as instructions.
use std::collections::BTreeSet;

use super::scan::{Hit, replace_each, run};
use super::{Target, paths};

/// Project one text file of `skill`; `file` is its path inside the folder.
pub fn project_script(
    text: &str,
    file: &str,
    skill: &str,
    skills: &BTreeSet<String>,
    target: &Target,
) -> String {
    let text = paths::skills_root(text, target, skills);
    let text = paths::own_folder(&text, target, skill);
    let text = paths::agent_files(&text, target);
    let text = climbs(&text, file, skill, skills, target);
    // The variable keeps the name the skill's own Markdown gives it.
    let text = text.replace("CLAUDE_PLUGIN_DATA", target.plugin_data_var);
    let text = paths::host_paths(&text, target);
    // The folder alone, as one quoted segment of a path built in code.
    ["\"", "'"].iter().fold(text, |text, quote| {
        text.replace(
            &format!("{quote}.claude{quote}"),
            &format!("{quote}{}{quote}", target.host_dir),
        )
    })
}

/// A relative path that climbs from this file out of the skills tree
/// (`../../../hooks/lib/x.cjs` from `<skill>/bin/`) names a file under
/// `.claude/`. It is mapped like any other such path and written relative to
/// where the file installs, which may sit at another depth.
fn climbs(
    text: &str,
    file: &str,
    skill: &str,
    skills: &BTreeSet<String>,
    target: &Target,
) -> String {
    let depth = file.matches('/').count();
    // Out of the file's folders, the skill folder and `skills/`.
    let climb = "../".repeat(depth + 2);
    let installed = format!(
        "{}/{}{skill}/{file}",
        target.skills_root, target.skill_prefix
    );
    let from: Vec<&str> = installed.split('/').collect();
    let from = &from[..from.len() - 1];
    replace_each(text, &climb, |before, after| {
        // The climb starts the path: after a longer climb or a folder name
        // (`a/../../etc`) it leads somewhere else.
        let segment =
            |s: &str| s.ends_with(|c: char| c.is_ascii_alphanumeric() || "._-".contains(c));
        let starts_path = !segment(before) && !before.strip_suffix('/').is_some_and(segment);
        if !starts_path || !after.starts_with(|c: char| c.is_ascii_lowercase()) {
            return None;
        }
        let tail = run(after, |c| c.is_ascii_alphanumeric() || "/._-".contains(c));
        let authored = format!(".claude/{tail}");
        let mapped = paths::skills_root(&authored, target, skills);
        let mapped = paths::agent_files(&mapped, target);
        let mapped = paths::host_paths(&mapped, target);
        // A helper the target replaces by a command has no path to point at.
        if mapped.contains(' ') {
            return None;
        }
        Some(Hit::new(relative(from, &mapped)).after(tail.len()))
    })
}

/// `to` (from the project root) as seen from the folder `from`.
fn relative(from: &[&str], to: &str) -> String {
    let to: Vec<&str> = to.split('/').collect();
    let shared = from.iter().zip(&to).take_while(|(a, b)| a == b).count();
    let mut out = "../".repeat(from.len() - shared);
    out.push_str(&to[shared..].join("/"));
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::projection::target::{CODEX, CURSOR};

    fn skills() -> BTreeSet<String> {
        ["jira".to_owned(), "rubric".to_owned()].into()
    }

    #[test]
    fn paths_move_and_words_names_and_identifiers_stay() {
        let src = "# For Claude: see /mk:scout\n\
                   WRAPPER=\"$ROOT/.claude/skills/jira/scripts/jira-as.sh\"\n\
                   for entry in d.get(\"claude_md_chain\"): open(\".claude/benchmarks/x\")\n\
                   DATA=process.env.CLAUDE_PLUGIN_DATA\n\
                   if (parent / \".claude\").is_dir(): pass\n";
        assert_eq!(
            project_script(src, "scripts/a.sh", "jira", &skills(), &CODEX),
            "# For Claude: see /mk:scout\n\
             WRAPPER=\"$ROOT/.agents/skills/mk-jira/scripts/jira-as.sh\"\n\
             for entry in d.get(\"claude_md_chain\"): open(\".codex/benchmarks/x\")\n\
             DATA=process.env.PLUGIN_DATA\n\
             if (parent / \".codex\").is_dir(): pass\n"
        );
    }

    #[test]
    fn a_climb_out_of_the_skills_tree_is_written_from_the_installed_folder() {
        let src = "require(\"../../../hooks/lib/validate-content.cjs\"); \
                   require('../../../../x'); require('../lib/y.cjs'); ../../../hooks/lib/a.cjs";
        assert_eq!(
            project_script(src, "scripts/a.cjs", "jira", &skills(), &CODEX),
            "require(\"../../../../.codex/hooks/lib/validate-content.cjs\"); \
             require('../../../../x'); require('../lib/y.cjs'); ../../../../.codex/scripts/bin/a.cjs"
        );
        assert_eq!(
            project_script(src, "scripts/a.cjs", "jira", &skills(), &CURSOR),
            "require(\"../../../hooks/lib/validate-content.cjs\"); \
             require('../../../../x'); require('../lib/y.cjs'); ../../../scripts/bin/a.cjs"
        );
        // Into another skill, after a folder name, and to a helper that is a command.
        let src = "../../../skills/rubric/x.cjs a/../../../etc ../../../hooks/lib/setup-workflow";
        assert_eq!(
            project_script(src, "scripts/a.cjs", "jira", &skills(), &CODEX),
            "../../mk-rubric/x.cjs a/../../../etc ../../../hooks/lib/setup-workflow"
        );
        // One folder deeper, one more step up.
        assert_eq!(
            project_script(
                "../../../../eval/core.cjs",
                "scripts/lib/a.cjs",
                "jira",
                &skills(),
                &CODEX
            ),
            "../../../../../.codex/eval/core.cjs"
        );
    }
}
