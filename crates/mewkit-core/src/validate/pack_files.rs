//! Turning the manifest's base section into actual file paths.
//!
//! Split from the manifest reader because this half touches the TREE: it walks
//! it the way the installer does, and the `check-packs` completeness and safety
//! rows compare against exactly what it returns.
use std::collections::BTreeMap;
use std::path::Path;

use super::pack_manifest::PackManifest;

/// Files under `dir`, relative to `base_dir`, the way the installer collects
/// them: `/`-joined, skipping tooling noise and never following a symlink.
pub fn collect_files(dir: &Path, base_dir: &Path) -> Vec<String> {
    const SKIP: [&str; 6] = [
        "__pycache__",
        "node_modules",
        ".DS_Store",
        "meowkit.manifest.json",
        "metadata.json",
        ".metadata.lock",
    ];
    let mut out = Vec::new();
    if !dir.exists() {
        return out;
    }
    for entry in super::dir_order::sorted_entries(dir) {
        let name = entry.file_name().to_string_lossy().into_owned();
        if SKIP.contains(&name.as_str()) {
            continue;
        }
        let path = entry.path();
        // A symlink is inspected as a LINK and skipped, never followed: the kit
        // ships only regular files, so a symlink here is noise or an escape.
        let Ok(metadata) = std::fs::symlink_metadata(&path) else {
            continue;
        };
        if metadata.file_type().is_symlink() {
            continue;
        }
        if metadata.is_dir() {
            out.extend(collect_files(&path, base_dir));
        } else {
            out.push(
                path.strip_prefix(base_dir)
                    .unwrap_or(&path)
                    .to_string_lossy()
                    .replace('\\', "/"),
            );
        }
    }
    out
}

/// The always-installed essentials: explicit files plus expanded globs.
pub fn base_seed(claude_dir: &Path, manifest: &PackManifest) -> BTreeMap<String, ()> {
    let mut set = BTreeMap::new();
    for file in &manifest.base.files {
        set.insert(file.replace('\\', "/"), ());
    }
    for glob in &manifest.base.globs {
        for file in expand_base_glob(claude_dir, glob) {
            set.insert(file.replace('\\', "/"), ());
        }
    }
    set
}

/// `<dir>/**` expands against the source tree; anything else is a literal file.
fn expand_base_glob(claude_dir: &Path, glob: &str) -> Vec<String> {
    match glob.strip_suffix("/**") {
        Some(sub) => {
            let abs = sub
                .split('/')
                .fold(claude_dir.to_path_buf(), |acc, part| acc.join(part));
            if abs.exists() {
                collect_files(&abs, claude_dir)
            } else {
                Vec::new()
            }
        }
        None => vec![glob.to_string()],
    }
}
