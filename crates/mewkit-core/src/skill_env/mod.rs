//! Per-skill interpreter environments.
//!
//! One environment per skill, under `.meowkit/envs/<skill>/`, created only when
//! a user names the skill. Nothing here installs implicitly, and an environment
//! gets exactly one skill's own pinned requirements: no merged set across
//! skills and no built-in default list. A skill that finds its environment
//! missing reports the command and stops, so an optional runtime stays optional.
mod provision;
mod requirements;
mod runtime;

use std::path::{Path, PathBuf};

use crate::js_regex::is_js_whitespace;

pub use provision::{
    EnsureOutcome, PackageVerification, ensure_env, install_pip_packages, verify_packages,
};
pub use requirements::{
    SkillRequirements, SkillsDependency, base_package_name, format_package_list,
    read_skill_requirements, skill_requirements_path, validate_package_name,
};
pub use runtime::{SkillRuntime, read_skill_runtime};

/// The frontmatter key naming the interpreter a skill needs.
pub const RUNTIME_KEY: &str = "requires_runtime";

/// Where environments live, relative to the project root, with this OS's
/// separator (the npm CLI prints it that way).
pub fn envs_rel() -> PathBuf {
    Path::new(".meowkit").join("envs")
}

/// A skill directory name: lowercase alphanumerics and dashes, starting with
/// an alphanumeric. Checked before a name reaches any path join.
pub fn is_skill_dir_name(skill: &str) -> bool {
    let mut chars = skill.chars();
    chars
        .next()
        .is_some_and(|c| c.is_ascii_lowercase() || c.is_ascii_digit())
        && chars.all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

/// `<project>/.meowkit/envs/<skill>`.
pub fn skill_env_dir(project: &Path, skill: &str) -> Result<PathBuf, String> {
    if !is_skill_dir_name(skill) {
        return Err(format!("Not a skill directory name: {skill}"));
    }
    Ok(project.join(envs_rel()).join(skill))
}

/// The interpreter inside an environment, per platform.
pub fn env_python_path(env_dir: &Path) -> PathBuf {
    if cfg!(windows) {
        env_dir.join("Scripts").join("python.exe")
    } else {
        env_dir.join("bin").join("python3")
    }
}

/// pip inside an environment, per platform.
pub fn env_pip_path(env_dir: &Path) -> PathBuf {
    if cfg!(windows) {
        env_dir.join("Scripts").join("pip.exe")
    } else {
        env_dir.join("bin").join("pip")
    }
}

/// True when the environment's interpreter is actually present.
pub fn env_usable(env_dir: &Path) -> bool {
    env_python_path(env_dir).exists()
}

pub(crate) fn skill_dir(project: &Path, skill: &str) -> PathBuf {
    project.join(".claude").join("skills").join(skill)
}

/// Sub-directory names of `dir`, sorted, hidden ones kept unless `skip_hidden`.
fn dir_names(dir: &Path, skip_hidden: bool) -> Vec<String> {
    let Ok(read) = std::fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut names: Vec<String> = read
        .filter_map(Result::ok)
        .filter(|e| e.file_type().is_ok_and(|t| t.is_dir()))
        .map(|e| e.file_name().to_string_lossy().into_owned())
        .filter(|name| !(skip_hidden && name.starts_with('.')))
        .collect();
    names.sort();
    names
}

/// Every environment directory present, declared by a skill or not.
pub fn existing_envs(project: &Path) -> Vec<String> {
    dir_names(&project.join(envs_rel()), false)
}

/// Every skill that needs an environment of its own: it declares an
/// interpreter or pins packages (some skills install a binary from their pins
/// and never run a `.py` of their own).
pub fn env_skills(project: &Path) -> Vec<String> {
    dir_names(&project.join(".claude").join("skills"), true)
        .into_iter()
        .filter(|name| {
            read_skill_runtime(project, name).is_some()
                || skill_requirements_path(project, name).is_some()
        })
        .collect()
}

/// `str.trim()` with JavaScript's whitespace set.
pub(crate) fn js_trim(text: &str) -> &str {
    text.trim_matches(is_js_whitespace)
}

#[cfg(test)]
#[path = "tests.rs"]
mod tests;
