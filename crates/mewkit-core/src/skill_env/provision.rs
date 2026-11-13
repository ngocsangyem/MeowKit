//! Environment creation, pip install and package verification.
//!
//! Every function takes the environment DIRECTORY to act on rather than deriving
//! one shared path: a caller that cannot name which skill it installs for cannot
//! install at all. Process work goes through [`crate::toolchain`].
use std::path::{Component, Path, PathBuf};

use super::requirements::{SkillsDependency, base_package_name};
use super::{env_pip_path, env_python_path, envs_rel};
use crate::toolchain::{self, InstallResult};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EnsureOutcome {
    pub created: bool,
    pub repaired: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PackageVerification {
    pub name: String,
    pub installed: bool,
}

/// Collapse `.` and `..` without touching the disk (the paths here may not
/// exist yet).
fn lexical(path: &Path) -> PathBuf {
    let mut out = PathBuf::new();
    for part in path.components() {
        match part {
            Component::CurDir => {}
            Component::ParentDir => {
                out.pop();
            }
            other => out.push(other.as_os_str()),
        }
    }
    out
}

/// An environment path must stay inside `.meowkit/envs/`; the guard sits on
/// the directory an install writes into, because that is the value a caller
/// could get wrong.
fn validate_env_path(project: &Path, target: &Path) -> Result<(), String> {
    let root = lexical(&project.join(envs_rel()));
    let resolved = lexical(&std::env::current_dir().unwrap_or_default().join(target));
    // A string prefix, not a component prefix: the npm CLI's check is one.
    if !resolved
        .to_string_lossy()
        .starts_with(root.to_string_lossy().as_ref())
    {
        return Err(format!(
            "Path escapes {}: {}",
            envs_rel().display(),
            target.display()
        ));
    }
    Ok(())
}

/// Make one environment exist and hold an interpreter. "Repair" and "create"
/// are one operation: a directory whose interpreter vanished (a pruned cache,
/// an upgraded system Python) is indistinguishable from absent to every caller.
pub fn ensure_env(
    project: &Path,
    env_dir: &Path,
    say: &mut dyn FnMut(&str),
) -> Result<EnsureOutcome, String> {
    validate_env_path(project, env_dir)?;
    let existed = env_dir.exists();
    if existed && env_python_path(env_dir).exists() {
        return Ok(EnsureOutcome {
            created: false,
            repaired: false,
        });
    }
    let python = toolchain::find_python()
        .ok_or_else(|| "No Python interpreter found in PATH.".to_string())?;
    if let Some(parent) = env_dir.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    say(if existed {
        "  Repairing environment..."
    } else {
        "  Creating environment..."
    });
    toolchain::create_venv(python, env_dir)?;
    Ok(EnsureOutcome {
        created: !existed,
        repaired: existed,
    })
}

/// Install packages one at a time into one environment. `say` gets every
/// line, including the indented text pip itself prints.
pub fn install_pip_packages(
    project: &Path,
    env_dir: &Path,
    packages: &[SkillsDependency],
    say: &mut dyn FnMut(&str),
) -> Result<Vec<InstallResult>, String> {
    validate_env_path(project, env_dir)?;
    let pip = env_pip_path(env_dir);
    if !pip.exists() {
        return Err(format!("pip not found at {}.", pip.display()));
    }
    let mut results = Vec::new();
    for package in packages {
        say(&format!("  > Installing {}...", package.name));
        let result = if super::validate_package_name(&package.name) {
            toolchain::pip_install(&pip, &package.name, &mut |text| say(&format!("    {text}")))
        } else {
            InstallResult {
                name: package.name.clone(),
                success: false,
                error: Some("Invalid package name".to_string()),
            }
        };
        say(&match &result.error {
            None => format!("  \u{2713} {}", package.name),
            Some(error) => format!("  \u{2717} {}: {error}", package.name),
        });
        results.push(result);
    }
    Ok(results)
}

/// pip names whose import name differs.
fn import_name(base: &str) -> Option<&'static str> {
    match base {
        "pillow" => Some("PIL"),
        "python-dotenv" => Some("dotenv"),
        "google-genai" => Some("google.genai"),
        _ => None,
    }
}

/// Which packages one environment already holds.
pub fn verify_packages(env_dir: &Path, packages: &[SkillsDependency]) -> Vec<PackageVerification> {
    let python = env_python_path(env_dir);
    let pip = env_pip_path(env_dir);
    packages
        .iter()
        .map(|package| {
            let installed = python.exists() && {
                let base = base_package_name(&package.name);
                match import_name(&base) {
                    Some(import) => toolchain::probe(&python, &["-c", &format!("import {import}")]),
                    None => toolchain::probe(&pip, &["show", &base]),
                }
            };
            PackageVerification {
                name: package.name.clone(),
                installed,
            }
        })
        .collect()
}
