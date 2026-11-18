//! The authored kit projected whole: every skill file and agent in the form
//! and at the path one runtime loads, with that runtime's overlay applied.
//!
//! Skill files other than Markdown get the path rules only (`script.rs`):
//! the rules for instruction prose would rewrite identifiers in code.
use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;

use super::{Overlay, Target, agent, frontmatter, project_skill_body, read_skills, script};
use crate::contract::EmitError;
use crate::kit_files;

/// Installed path, relative to the project root, -> content.
pub type Tree = BTreeMap<String, Vec<u8>>;

fn text(bytes: Vec<u8>, path: &str) -> Result<String, EmitError> {
    String::from_utf8(bytes).map_err(|_| EmitError::Kit(format!("{path} is not UTF-8")))
}

/// Project the skills and agents under `claude_dir` (a kit's `.claude`).
pub fn project_tree(
    claude_dir: &Path,
    overlay: &Overlay,
    target: &Target,
) -> Result<Tree, EmitError> {
    let skills = read_skills(&claude_dir.join("skills"))?;
    let names: BTreeSet<String> = skills.iter().map(|s| s.name.clone()).collect();
    let mut tree = Tree::new();

    for skill in &skills {
        let folder = format!(
            "{}/{}{}",
            target.skills_root, target.skill_prefix, skill.name
        );
        for file in &skill.files {
            let source = claude_dir.join("skills").join(&skill.name).join(file);
            let bytes = kit_files::read(&source)?;
            let path = format!("{folder}/{file}");
            let bytes = if file == "SKILL.md" {
                let keys = overlay.skill_keys(&skill.name);
                let source = text(bytes, &path)?;
                let amend = |body| overlay.amend(&path, body);
                frontmatter::skill_file(&source, skill, &names, target, keys, amend)?.into_bytes()
            } else if file.ends_with(".md") {
                let projected = project_skill_body(&text(bytes, &path)?, skill, &names, target);
                overlay.amend(&path, projected)?.into_bytes()
            } else {
                // Anything that is not text (an image, an archive) is carried as it is.
                match String::from_utf8(bytes) {
                    Ok(source) => {
                        let projected =
                            script::project_script(&source, file, &skill.name, &names, target);
                        overlay.amend(&path, projected)?.into_bytes()
                    }
                    Err(binary) => binary.into_bytes(),
                }
            };
            tree.insert(path, bytes);
        }
    }

    let mut agents = BTreeSet::new();
    let agents_dir = claude_dir.join("agents");
    for file in kit_files::walk(&agents_dir)? {
        // Agents are the Markdown files directly in the folder.
        let Some(name) = file.rel.strip_suffix(".md").filter(|n| !n.contains('/')) else {
            continue;
        };
        let source = kit_files::read_text(&file.abs)?;
        // An index of agents or skills sits beside the agents; it has no frontmatter.
        if !source.trim_start_matches('\u{feff}').starts_with("---") {
            continue;
        }
        let keys = overlay.agent_keys(name);
        let path = format!("{}/agents/{name}.{}", target.host_dir, target.agent_ext);
        let amend = |prompt| overlay.amend(&path, prompt);
        let projected = if target.agent_ext == "toml" {
            agent::codex_agent(&file.rel, &source, &names, target, keys, amend)?
        } else {
            agent::markdown_agent(&file.rel, &source, &names, target, keys, amend)?
        };
        tree.insert(path, projected.into_bytes());
        agents.insert(name.to_owned());
    }

    let projected: BTreeSet<String> = tree.keys().cloned().collect();
    overlay.check(&names, &agents, &projected)?;
    for path in &overlay.omit {
        tree.remove(path);
    }
    for (path, bytes) in &overlay.files {
        tree.insert(path.clone(), bytes.clone());
    }
    Ok(tree)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::projection::target::CODEX;

    fn kit(files: &[(&str, &str)]) -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();
        for (path, content) in files {
            let abs = dir.path().join(path);
            std::fs::create_dir_all(abs.parent().unwrap()).unwrap();
            std::fs::write(abs, content).unwrap();
        }
        dir
    }

    const SKILL: &str = "---\nname: mk:cook\ndescription: \"Builds.\"\n---\n\nRun `/mk:fix`.\n";
    const AGENT: &str = "---\nname: tester\ndescription: Tests.\nmodel: haiku\n---\n\nYou test.\n";

    #[test]
    fn skills_and_agents_land_where_the_runtime_loads_them() {
        let kit = kit(&[
            ("skills/cook/SKILL.md", SKILL),
            (
                "skills/cook/references/a.md",
                "See `.claude/skills/cook/x`.\n",
            ),
            (
                "skills/cook/scripts/run.sh",
                "echo .claude/skills # mk:cook\n",
            ),
            (
                "skills/fix/SKILL.md",
                "---\nname: mk:fix\ndescription: \"Fixes.\"\n---\n",
            ),
            ("agents/tester.md", AGENT),
            ("agents/AGENTS_INDEX.md", "# Agents\n"),
            ("agents/.DS_Store", "\u{0}"),
            ("agents/notes/draft.md", "---\nname: draft\n---\n"),
        ]);
        let tree = project_tree(kit.path(), &Overlay::default(), &CODEX).unwrap();
        let paths: Vec<&str> = tree.keys().map(String::as_str).collect();
        assert_eq!(
            paths,
            [
                ".agents/skills/mk-cook/SKILL.md",
                ".agents/skills/mk-cook/references/a.md",
                ".agents/skills/mk-cook/scripts/run.sh",
                ".agents/skills/mk-fix/SKILL.md",
                ".codex/agents/tester.toml",
            ]
        );
        let read = |path: &str| std::str::from_utf8(&tree[path]).unwrap().to_owned();
        assert!(read(".agents/skills/mk-cook/SKILL.md").ends_with("Run `$mk-fix`.\n"));
        assert_eq!(
            read(".agents/skills/mk-cook/references/a.md"),
            "See `.agents/skills/mk-cook/x`.\n"
        );
        // In code only the paths move.
        assert_eq!(
            read(".agents/skills/mk-cook/scripts/run.sh"),
            "echo .agents/skills # mk:cook\n"
        );
        assert!(read(".codex/agents/tester.toml").contains("model = \"gpt-6-luna\""));
    }

    #[test]
    fn the_overlay_amends_omits_and_adds_files() {
        let kit = kit(&[
            ("skills/cook/SKILL.md", SKILL),
            ("agents/tester.md", AGENT),
            (
                "agents/orchestrator.md",
                &AGENT.replace("tester", "orchestrator"),
            ),
        ]);
        let overlay = kit.path().join("overlay");
        std::fs::create_dir_all(overlay.join("files/.codex/rules")).unwrap();
        std::fs::write(overlay.join("files/.codex/rules/default.rules"), "allow\n").unwrap();
        std::fs::write(
            overlay.join("overlay.toml"),
            "omit = [\".codex/agents/orchestrator.toml\"]\n\n[agent.tester]\nsandbox_mode = \"read-only\"\n\n\
             [[replace]]\npath = \".agents/skills/mk-cook/SKILL.md\"\nfind = \"Run `$mk-fix`.\"\nwith = \"Fix first.\"\n",
        )
        .unwrap();
        let overlay = Overlay::read(&overlay).unwrap();
        let tree = project_tree(kit.path(), &overlay, &CODEX).unwrap();
        assert!(!tree.contains_key(".codex/agents/orchestrator.toml"));
        assert_eq!(tree[".codex/rules/default.rules"], b"allow\n");
        let read = |path: &str| std::str::from_utf8(&tree[path]).unwrap().to_owned();
        assert!(read(".agents/skills/mk-cook/SKILL.md").ends_with("Fix first.\n"));
        assert!(read(".codex/agents/tester.toml").contains("sandbox_mode = \"read-only\""));
    }

    #[test]
    fn an_overlay_that_outlived_its_target_fails() {
        let kit = kit(&[("skills/cook/SKILL.md", SKILL), ("agents/tester.md", AGENT)]);
        let overlay = Overlay::parse("omit = [\".codex/agents/gone.toml\"]\n").unwrap();
        let err = project_tree(kit.path(), &overlay, &CODEX).unwrap_err();
        assert!(
            err.to_string()
                .contains("nothing is projected to .codex/agents/gone.toml")
        );
    }
}
