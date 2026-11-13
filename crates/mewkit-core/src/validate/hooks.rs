//! Are the hooks RUNNABLE: one row per hook script, plus what was skipped.
//!
//! The entry filter is the load-bearing part. The execute bit is also set on a
//! traversable DIRECTORY, so treating every `readdir` entry as a hook reported
//! `lib/`, `handlers/` and `HOOKS_INDEX.md` as "Hook executable" — three green
//! rows that proved nothing about a hook. Port of `core/is-hook-script.ts` and
//! `checkHooksExecutable` in `commands/validate.ts`.
use std::fs;
use std::path::Path;

use super::result::{CheckResult, Section, Status, ok};

const HOOK_EXTENSIONS: [&str; 4] = ["sh", "cjs", "js", "mjs"];
const EXCLUDED_BASENAMES: [&str; 2] = ["HOOKS_INDEX.md", "handlers.json"];

/// True only for an actual hook script: a regular file, not an index/doc/json
/// sidecar, and either a known script extension or an extensionless executable
/// carrying a shell/node shebang.
pub fn is_hook_script(path: &Path) -> bool {
    let Ok(metadata) = fs::metadata(path) else {
        return false;
    };
    if !metadata.is_file() {
        return false;
    }
    let Some(base) = path.file_name().and_then(|n| n.to_str()) else {
        return false;
    };
    if EXCLUDED_BASENAMES.contains(&base) {
        return false;
    }
    // `path.extname` is the last dot ONWARDS, and a leading-dot name has no
    // extension at all — so a dotfile falls into the extensionless branch here
    // just as it does in Node.
    match extension(base) {
        Some(ext) if HOOK_EXTENSIONS.contains(&ext.to_ascii_lowercase().as_str()) => true,
        Some(_) => false,
        None => extensionless_hook(path, &metadata),
    }
}

/// Node's `path.extname` without the dot, or `None` when there is none.
fn extension(base: &str) -> Option<&str> {
    let index = base.rfind('.')?;
    if index == 0 {
        return None;
    }
    Some(&base[index + 1..])
}

fn extensionless_hook(path: &Path, metadata: &fs::Metadata) -> bool {
    if !any_execute_bit(metadata) {
        return false;
    }
    let Ok(bytes) = fs::read(path) else {
        return false;
    };
    // The TypeScript reads the file as UTF-8 and slices 128 CHARACTERS off the
    // decoded string; a shebang is ASCII, so the first 128 bytes carry the same
    // line, and a lossy decode keeps an invalid byte from hiding one.
    let head: String = String::from_utf8_lossy(&bytes).chars().take(128).collect();
    shebang_interpreter(&head)
}

/// `/^#!.*\b(sh|bash|dash|node|env)\b/` — an interpreter this kit's hooks use.
fn shebang_interpreter(head: &str) -> bool {
    static PATTERN: std::sync::LazyLock<regex::Regex> = std::sync::LazyLock::new(|| {
        crate::js_regex::compile(r"^#!.*\b(sh|bash|dash|node|env)\b")
            .expect("a static shebang pattern")
    });
    // JavaScript `^` without the `m` flag anchors at the start of the whole
    // string, which is also what the Rust pattern does by default.
    PATTERN.is_match(head)
}

#[cfg(unix)]
fn any_execute_bit(metadata: &fs::Metadata) -> bool {
    use std::os::unix::fs::MetadataExt;
    metadata.mode() & 0o111 != 0
}

/// Windows has no execute bit; Node reports `mode & 0o111` as set there for a
/// readable file, so an extensionless file is judged by its shebang alone.
#[cfg(not(unix))]
fn any_execute_bit(_metadata: &fs::Metadata) -> bool {
    true
}

#[cfg(unix)]
fn is_executable(path: &Path) -> bool {
    use std::os::unix::fs::PermissionsExt;
    fs::metadata(path).is_ok_and(|m| m.permissions().mode() & 0o111 != 0)
}

#[cfg(not(unix))]
fn is_executable(path: &Path) -> bool {
    path.exists()
}

/// One row per hook script, then one summary row for the non-script entries
/// that were correctly excluded.
pub fn check_hooks_executable(meowkit_dir: &Path) -> Vec<CheckResult> {
    let hooks_dir = meowkit_dir.join("hooks");
    if !hooks_dir.exists() {
        return vec![CheckResult::new(
            "Hooks directory",
            Status::Fail,
            format!("Missing: {}", hooks_dir.display()),
            Section::Hooks,
        )];
    }

    // In Node's order (see `dir_order`): one row per hook is printed, so the
    // order IS output, and raw directory order would differ from `readdirSync`.
    let entries: Vec<String> = super::dir_order::sorted_names(&hooks_dir)
        .into_iter()
        .filter(|name| !name.starts_with('.'))
        .collect();

    let hook_files: Vec<&String> = entries
        .iter()
        .filter(|name| is_hook_script(&hooks_dir.join(name)))
        .collect();
    let skipped = entries.len() - hook_files.len();

    if hook_files.is_empty() {
        return vec![CheckResult::new(
            "Hooks present",
            Status::Fail,
            "No hook scripts found in hooks/",
            Section::Hooks,
        )];
    }

    let mut results: Vec<CheckResult> = hook_files
        .iter()
        .map(|hook| {
            let path = hooks_dir.join(hook.as_str());
            let executable = is_executable(&path);
            CheckResult::new(
                format!("Hook executable: {hook}"),
                ok(executable),
                if executable {
                    path.display().to_string()
                } else {
                    format!("Not executable: {}", path.display())
                },
                Section::Hooks,
            )
        })
        .collect();

    if skipped > 0 {
        results.push(CheckResult::new(
            "Hooks: non-script entries skipped",
            Status::Pass,
            format!(
                "{skipped} non-script entr(ies) in hooks/ (subdirs, .md, .json) correctly excluded."
            ),
            Section::Hooks,
        ));
    }
    results
}

#[cfg(test)]
#[path = "hooks_tests.rs"]
mod hooks_tests;
