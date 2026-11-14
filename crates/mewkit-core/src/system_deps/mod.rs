//! The registry of installable system dependencies: the single source of truth
//! for what `setup --system-deps` offers and what a skill may ask for.
//!
//! A skill declares an opt-in dependency in a `MEOWKIT METADATA` HTML comment
//! inside its `SKILL.md`, because Claude Code's frontmatter silently drops custom
//! fields. Declared keys are checked against this registry, so no skill can
//! request an arbitrary install.
mod install;
mod metadata;

pub use install::{
    install_single_dep, install_system_deps, is_dep_present, offerable_deps, platform_name,
};
pub use metadata::{
    parse_optional_system_deps_from_skill_md, skill_declared_deps, validate_skill_declared_keys,
};

/// The skill that drives a browser, and therefore owns the browser.
pub const PLAYWRIGHT_SKILL: &str = "web-to-markdown";

/// A registered dependency.
#[derive(Debug, Clone, Copy)]
pub struct SystemDep {
    /// Registry key, as a skill's `optional_system_deps` names it.
    pub key: &'static str,
    pub name: &'static str,
    /// Probe whose success means present; for a PATH dep, the binary name.
    pub detect_command: &'static str,
    /// Fallback probes for a dep that ships under several names (ImageMagick 6
    /// `convert`, 7+ `magick`). When set, any one present counts.
    pub detect_commands: Option<&'static [&'static str]>,
    /// Ordered install command lines per platform (`darwin`, `linux`, `win32`).
    pub darwin: &'static [&'static str],
    pub linux: &'static [&'static str],
    pub win32: &'static [&'static str],
    pub manual_url: &'static str,
    pub size_bytes: u64,
}

impl SystemDep {
    /// The install command lines for a platform; empty when none is automated.
    pub fn install_commands(&self, platform: &str) -> &'static [&'static str] {
        match platform {
            "darwin" => self.darwin,
            "linux" => self.linux,
            "win32" => self.win32,
            _ => &[],
        }
    }
}

/// Registry order is display order.
pub const SYSTEM_DEPS: [SystemDep; 3] = [
    SystemDep {
        key: "ffmpeg",
        name: "FFmpeg",
        detect_command: "ffmpeg",
        detect_commands: None,
        darwin: &["brew install ffmpeg"],
        linux: &["apt-get install -y ffmpeg"],
        win32: &[],
        manual_url: "https://ffmpeg.org/download.html",
        size_bytes: 50_000_000,
    },
    SystemDep {
        key: "imagemagick",
        name: "ImageMagick",
        detect_command: "convert",
        detect_commands: Some(&["convert", "magick"]),
        darwin: &["brew install imagemagick"],
        linux: &["apt-get install -y imagemagick"],
        win32: &[],
        manual_url: "https://imagemagick.org/script/download.php",
        size_bytes: 20_000_000,
    },
    SystemDep {
        key: "playwright-chromium",
        name: "Playwright + Chromium",
        detect_command: ".meowkit/envs/web-to-markdown/bin/python3 -c 'import playwright'",
        detect_commands: None,
        darwin: &[
            ".meowkit/envs/web-to-markdown/bin/pip install playwright==1.58.0",
            ".meowkit/envs/web-to-markdown/bin/playwright install chromium",
        ],
        linux: &[
            ".meowkit/envs/web-to-markdown/bin/pip install playwright==1.58.0",
            ".meowkit/envs/web-to-markdown/bin/playwright install chromium",
        ],
        win32: &[
            ".meowkit\\envs\\web-to-markdown\\Scripts\\pip install playwright==1.58.0",
            ".meowkit\\envs\\web-to-markdown\\Scripts\\playwright install chromium",
        ],
        manual_url: "https://playwright.dev/python/docs/intro",
        size_bytes: 200_000_000,
    },
];

/// Look up one entry by key.
pub fn get_dep(key: &str) -> Option<&'static SystemDep> {
    SYSTEM_DEPS.iter().find(|d| d.key == key)
}

/// Whether a PATH dep's binary, or any alias, is present.
pub fn is_dep_command_present(dep: &SystemDep, available: &dyn Fn(&str) -> bool) -> bool {
    match dep.detect_commands {
        Some(probes) => probes.iter().any(|p| available(p)),
        None => available(dep.detect_command),
    }
}

#[cfg(test)]
#[path = "tests.rs"]
mod tests;
