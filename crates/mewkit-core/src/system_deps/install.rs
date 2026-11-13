//! Installing registered system dependencies through the platform's package
//! manager. Every process starts through [`crate::toolchain`].
use std::path::Path;

use super::{SYSTEM_DEPS, SystemDep, is_dep_command_present};
use crate::toolchain::{command_available, run_shell_inherit};

/// Node's platform names, which the registry is keyed by.
pub fn platform_name() -> &'static str {
    match std::env::consts::OS {
        "macos" => "darwin",
        "windows" => "win32",
        other => other,
    }
}

/// Whether a dep is present. A dep whose probe lives in a `.venv` is treated as
/// absent, so setup always offers it; the registry's probe for the browser
/// dependency is a whole command line, which a PATH lookup never finds either.
pub fn is_dep_present(dep: &SystemDep) -> bool {
    if dep.detect_command.contains(".venv") {
        return false;
    }
    is_dep_command_present(dep, &command_available)
}

/// The deps worth offering: absent, and either a PATH dep or declared by a skill.
pub fn offerable_deps(skill_declared: &[String]) -> Vec<&'static SystemDep> {
    SYSTEM_DEPS
        .iter()
        .filter(|dep| {
            if is_dep_present(dep) {
                return false;
            }
            if !dep.detect_command.contains(".venv") {
                return true;
            }
            skill_declared.iter().any(|k| k == dep.key)
        })
        .collect()
}

/// Install one dep from its registry entry. A failure is reported on `say`,
/// never returned: the remaining deps still get their turn.
pub fn install_single_dep(dep: &SystemDep, project: &Path, say: &mut dyn FnMut(&str)) {
    let platform = platform_name();
    let commands = dep.install_commands(platform);
    if commands.is_empty() {
        say(&format!(
            "  \u{26a0} No automated install for {} on {platform}.",
            dep.name
        ));
        say(&format!("    Manual: {}", dep.manual_url));
        return;
    }
    let base = dep.key == "ffmpeg" || dep.key == "imagemagick";
    if platform == "darwin" && base && !command_available("brew") {
        say("  \u{26a0} Homebrew not found. Install from https://brew.sh then re-run.");
        return;
    }
    if platform == "linux" && base {
        install_linux_dep(dep, say);
        return;
    }
    for command in commands {
        say(&format!("  {command}..."));
        if let Err(message) = run_shell_inherit(command, Some(project)) {
            say(&format!(
                "  \u{2717} {} install failed: {message}",
                dep.name
            ));
            say(&format!("    Manual: {}", dep.manual_url));
            return;
        }
    }
    say(&format!("  \u{2713} {} installed", dep.name));
}

/// Linux: pick the first available package manager and its package name.
fn install_linux_dep(dep: &SystemDep, say: &mut dyn FnMut(&str)) {
    // (manager, install command prefix, package name for ffmpeg, for imagemagick)
    const MANAGERS: [(&str, &str, &str, &str); 4] = [
        (
            "apt-get",
            "sudo apt-get install -y",
            "ffmpeg",
            "imagemagick",
        ),
        ("dnf", "sudo dnf install -y", "ffmpeg", "ImageMagick"),
        (
            "pacman",
            "sudo pacman -S --noconfirm",
            "ffmpeg",
            "imagemagick",
        ),
        ("apk", "apk add", "ffmpeg", "imagemagick"),
    ];
    for (bin, prefix, ffmpeg, imagemagick) in MANAGERS {
        if !command_available(bin) {
            continue;
        }
        let package = if dep.key == "ffmpeg" {
            ffmpeg
        } else {
            imagemagick
        };
        let command = format!("{prefix} {package}");
        say(&format!("  {command}..."));
        match run_shell_inherit(&command, None) {
            Ok(()) => say(&format!("  \u{2713} {} installed", dep.name)),
            Err(message) => say(&format!(
                "  \u{2717} {} install failed: {message}",
                dep.name
            )),
        }
        return;
    }
    say("  \u{26a0} No supported package manager found (apt-get, dnf, pacman, apk).");
    say(&format!("    Manual: {}", dep.manual_url));
}

/// Install every dep that is currently absent.
pub fn install_system_deps(project: &Path, say: &mut dyn FnMut(&str)) {
    let missing: Vec<&SystemDep> = SYSTEM_DEPS.iter().filter(|d| !is_dep_present(d)).collect();
    if missing.is_empty() {
        let names: Vec<&str> = SYSTEM_DEPS
            .iter()
            .filter(|d| !d.detect_command.contains(".venv"))
            .map(|d| d.name)
            .collect();
        say(&format!(
            "  \u{2713} {} already installed",
            names.join(" and ")
        ));
        return;
    }
    let names: Vec<&str> = missing.iter().map(|d| d.name).collect();
    say(&format!("\n  Installing: {}...", names.join(", ")));
    for dep in missing {
        install_single_dep(dep, project, say);
    }
}
