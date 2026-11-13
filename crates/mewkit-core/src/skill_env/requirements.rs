//! A skill's own pinned requirements, and pip package-name validation.
//!
//! Validation looks at the BASE name only (the part before any version
//! specifier), exactly as the npm CLI does, so what follows a specifier is
//! passed to pip as written.
use std::path::{Path, PathBuf};
use std::sync::LazyLock;

use regex::Regex;

use super::{js_trim, skill_dir};

/// One pip requirement line.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SkillsDependency {
    pub name: String,
    pub description: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SkillRequirements {
    /// The file the pins came from, or `None` for a skill that ships none.
    pub source: Option<PathBuf>,
    pub packages: Vec<SkillsDependency>,
    /// Lines that failed package-name validation. Reported, never installed.
    pub rejected: Vec<String>,
}

static SAFE_PKG: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r"^[a-zA-Z0-9][a-zA-Z0-9._-]*(\[[a-zA-Z0-9,_-]*\])?(==|>=|<=|!=|~=|<|>)?[a-zA-Z0-9.*]*$",
    )
    .expect("a valid pattern")
});

/// `pillow>=10.0` becomes `pillow`: the name up to the first specifier
/// character, lowercased.
pub fn base_package_name(name: &str) -> String {
    name.split(['=', '<', '>', '!', '~'])
        .next()
        .unwrap_or(name)
        .to_lowercase()
}

/// Rejects flags, URLs and shell-breaking characters.
pub fn validate_package_name(name: &str) -> bool {
    if name.is_empty() || name.starts_with('-') || name.contains("://") {
        return false;
    }
    SAFE_PKG.is_match(&base_package_name(name))
}

/// `  name              description`, one per line, as the install preview shows it.
pub fn format_package_list(packages: &[SkillsDependency]) -> String {
    packages
        .iter()
        .map(|p| {
            let desc = if p.description.is_empty() {
                String::new()
            } else {
                format!(" {}", p.description)
            };
            let pad = 18usize.saturating_sub(p.name.encode_utf16().count());
            format!("  {}{}{desc}", p.name, " ".repeat(pad))
        })
        .collect::<Vec<_>>()
        .join("\n")
}

/// A skill's own pinned requirements file, or `None` when it ships none.
pub fn skill_requirements_path(project: &Path, skill: &str) -> Option<PathBuf> {
    [
        Path::new("scripts").join("requirements.txt"),
        PathBuf::from("requirements.txt"),
    ]
    .into_iter()
    .map(|rel| skill_dir(project, skill).join(rel))
    .find(|candidate| candidate.exists())
}

/// Read ONE skill's pins. A skill with no file yields an empty set, the right
/// answer for a skill whose scripts are standard-library only.
pub fn read_skill_requirements(project: &Path, skill: &str) -> std::io::Result<SkillRequirements> {
    let Some(source) = skill_requirements_path(project, skill) else {
        return Ok(SkillRequirements {
            source: None,
            packages: Vec::new(),
            rejected: Vec::new(),
        });
    };
    let text = std::fs::read_to_string(&source)?;
    let mut packages = Vec::new();
    let mut rejected = Vec::new();
    for raw in text.split('\n') {
        let line = js_trim(raw);
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if validate_package_name(line) {
            packages.push(SkillsDependency {
                name: line.to_string(),
                description: String::new(),
            });
        } else {
            rejected.push(line.to_string());
        }
    }
    Ok(SkillRequirements {
        source: Some(source),
        packages,
        rejected,
    })
}
