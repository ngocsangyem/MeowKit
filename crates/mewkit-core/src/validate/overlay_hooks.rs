//! Does every hook a runtime's hook configuration names still exist?
//!
//! A hook is wired in two places — a configuration line that names a script and
//! the script itself — and removing or renaming the script leaves the line
//! behind. The host then fails to start that hook on every event, which for a
//! guard means the check silently stops running. This row reads, in the kit's
//! source checkout:
//!
//! - every hook configuration and guard script under `kit/overlays/*/files/`
//!   (`hooks.json` files, any JSON under a `hooks` directory, the TypeScript
//!   extensions that load a guard, and the `.cjs` scripts under a `hooks`
//!   directory);
//! - the Claude Code registrations: `.claude/settings.json` and the observer
//!   registry `.claude/hooks/handlers.json`.
//!
//! A project-relative path naming a script under a `hooks` directory must exist
//! in some overlay's `files/` tree or in the project; a relative `require` in a
//! guard script must resolve beside it; and every registry `handler` must exist
//! under `.claude/hooks/`. Anything else is reported as a FAIL naming the file
//! and the reference.
use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::LazyLock;

use regex::Regex;

use super::result::{CheckResult, Section, Status};

const NAME: &str = "Hook references resolve";
const OVERLAYS: &str = "kit/overlays";
const REGISTRY: &str = ".claude/hooks/handlers.json";
const SETTINGS: &str = ".claude/settings.json";
const SAMPLE: usize = 5;

/// A project-relative script path under a `hooks` directory, starting at a
/// dot-directory (`.codex/`, `.agents/`, `.claude/`, …) so prose paths in a
/// comment are not read as references.
static HOOK_PATH: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r#"(?:^|[\s"'`(/=])(\.[a-z][a-z0-9_-]*/(?:[A-Za-z0-9_.-]+/)*hooks/(?:[A-Za-z0-9_.-]+/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*\.(?:cjs|mjs|js|ts|sh|py))\b"#,
    )
    .expect("a static hook path pattern")
});

/// `require("./x")` / `require('../x')` — a relative module a guard loads.
static RELATIVE_REQUIRE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r#"require\(\s*["'](\.{1,2}/[^"']+)["']\s*\)"#).expect("a static require pattern")
});

/// One row, or none outside the kit's source checkout.
pub fn check_hook_references(project_root: &Path) -> Vec<CheckResult> {
    let overlays = project_root.join(OVERLAYS);
    if !overlays.is_dir() {
        return Vec::new();
    }
    let roots: Vec<PathBuf> = super::dir_order::sorted_names(&overlays)
        .into_iter()
        .map(|name| overlays.join(name).join("files"))
        .filter(|dir| dir.is_dir())
        .collect();

    let mut scanned = 0usize;
    let mut refs = 0usize;
    let mut broken: BTreeSet<String> = BTreeSet::new();
    let shown = |file: &Path| {
        file.strip_prefix(project_root)
            .unwrap_or(file)
            .to_string_lossy()
            .replace('\\', "/")
    };

    let mut files = Vec::new();
    for root in &roots {
        collect(root, false, &mut files);
    }
    files.extend(
        [SETTINGS, REGISTRY]
            .iter()
            .map(|rel| project_root.join(rel))
            .filter(|p| p.is_file()),
    );

    for file in &files {
        let Ok(text) = fs::read_to_string(file) else {
            continue;
        };
        scanned += 1;
        for token in hook_paths(&text) {
            refs += 1;
            let exists = project_root.join(&token).is_file()
                || roots.iter().any(|root| root.join(&token).is_file());
            if !exists {
                broken.insert(format!("{} names {token}", shown(file)));
            }
        }
        if file.extension().is_some_and(|e| e == "cjs") {
            let dir = file.parent().unwrap_or(project_root);
            for spec in relative_requires(&text) {
                refs += 1;
                if !module_exists(&dir.join(&spec)) {
                    broken.insert(format!("{} requires {spec}", shown(file)));
                }
            }
        }
    }

    let registry = project_root.join(REGISTRY);
    for handler in registry_handlers(&registry) {
        refs += 1;
        let path = project_root.join(".claude/hooks").join(&handler);
        if !path.is_file() {
            broken.insert(format!("{REGISTRY} registers {handler}"));
        }
    }

    if broken.is_empty() {
        return vec![CheckResult::new(
            NAME,
            Status::Pass,
            format!(
                "{refs} hook references in {scanned} runtime hook files and the observer \
                 registry name a file that exists"
            ),
            Section::Hooks,
        )];
    }
    let total = broken.len();
    let sample: Vec<String> = broken.into_iter().take(SAMPLE).collect();
    let more = if total > SAMPLE {
        format!(" and {} more", total - SAMPLE)
    } else {
        String::new()
    };
    vec![CheckResult::new(
        NAME,
        Status::Fail,
        format!(
            "{total} hook references name a file that does not exist: {}{more} — restore the \
             file or remove the registration, or the host fails to start that hook",
            sample.join("; ")
        ),
        Section::Hooks,
    )]
}

/// Hook configuration and guard files below `dir`; `in_hooks` is true once a
/// `hooks` directory has been entered.
fn collect(dir: &Path, in_hooks: bool, out: &mut Vec<PathBuf>) {
    for name in super::dir_order::sorted_names(dir) {
        let path = dir.join(&name);
        let Ok(meta) = fs::symlink_metadata(&path) else {
            continue;
        };
        if meta.is_dir() {
            // The bundled library is a byte copy of the canonical one, checked
            // by its own sync test; its internal requires are not wiring.
            if in_hooks && name == "lib" {
                continue;
            }
            collect(&path, in_hooks || name == "hooks", out);
        } else if meta.is_file() && is_hook_file(&name, in_hooks) {
            out.push(path);
        }
    }
}

fn is_hook_file(name: &str, in_hooks: bool) -> bool {
    name == "hooks.json"
        || name.ends_with(".ts")
        || (in_hooks && (name.ends_with(".json") || name.ends_with(".cjs")))
}

fn hook_paths(text: &str) -> BTreeSet<String> {
    HOOK_PATH
        .captures_iter(text)
        .filter_map(|c| c.get(1).map(|m| m.as_str().to_owned()))
        .collect()
}

fn relative_requires(text: &str) -> BTreeSet<String> {
    RELATIVE_REQUIRE
        .captures_iter(text)
        .filter_map(|c| c.get(1).map(|m| m.as_str().to_owned()))
        .collect()
}

/// Node's resolution for a relative specifier, narrowed to what the kit uses:
/// the exact file, or the file with a script extension.
fn module_exists(path: &Path) -> bool {
    if path.is_file() {
        return true;
    }
    ["cjs", "js", "json"].iter().any(|ext| {
        let mut with = path.as_os_str().to_owned();
        with.push(format!(".{ext}"));
        Path::new(&with).is_file()
    })
}

/// Every `handler` the observer registry names, as written.
fn registry_handlers(file: &Path) -> Vec<String> {
    let Ok(text) = fs::read_to_string(file) else {
        return Vec::new();
    };
    let Ok(doc) = serde_json::from_str::<serde_json::Value>(&text) else {
        return Vec::new();
    };
    let mut out: Vec<String> = doc
        .get("handlers")
        .and_then(|h| h.as_array())
        .into_iter()
        .flatten()
        .filter_map(|entry| entry.get("handler").and_then(|h| h.as_str()))
        .map(str::to_owned)
        .collect();
    out.sort_unstable();
    out.dedup();
    out
}

#[cfg(test)]
#[path = "overlay_hooks_tests.rs"]
mod overlay_hooks_tests;
