//! Reading the authored skills out of a kit's `.claude/skills` tree.
use std::collections::BTreeSet;
use std::path::Path;

use crate::contract::EmitError;
use crate::kit_files;

/// One authored skill: its folder name (`cook` for `mk:cook`) and the files it
/// ships, as `/`-separated paths relative to the folder.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Skill {
    pub name: String,
    pub files: BTreeSet<String>,
}

/// Every skill folder under `skills_dir`, sorted by name. Dot-folders (the
/// shared virtualenv) and loose files are not skills.
pub fn read_skills(skills_dir: &Path) -> Result<Vec<Skill>, EmitError> {
    let mut skills: Vec<Skill> = Vec::new();
    for file in kit_files::walk(skills_dir)? {
        let Some((name, inner)) = file.rel.split_once('/') else {
            continue;
        };
        if name.starts_with('.') {
            continue;
        }
        match skills.last_mut() {
            Some(skill) if skill.name == name => {
                skill.files.insert(inner.to_owned());
            }
            _ => skills.push(Skill {
                name: name.to_owned(),
                files: [inner.to_owned()].into(),
            }),
        }
    }
    Ok(skills)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_skill_folders_and_skips_dot_folders_and_loose_files() {
        let dir = tempfile::tempdir().unwrap();
        for path in [
            "b/SKILL.md",
            "a/SKILL.md",
            "a/scripts/x.js",
            ".venv/y",
            "z.md",
        ] {
            let abs = dir.path().join(path);
            std::fs::create_dir_all(abs.parent().unwrap()).unwrap();
            std::fs::write(abs, "").unwrap();
        }
        let skills = read_skills(dir.path()).unwrap();
        assert_eq!(skills.len(), 2);
        assert_eq!(skills[0].name, "a");
        assert_eq!(
            skills[0].files,
            ["SKILL.md", "scripts/x.js"].map(str::to_owned).into()
        );
        assert_eq!(skills[1].name, "b");
    }
}
