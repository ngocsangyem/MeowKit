//! Tier 3: report Rust space users for the agent to propose to the user;
//! nothing here deletes. `target/` dirs of known worktrees (and their
//! `.worktrees/*`), and whether Cargo's own cache cleaning is turned off.
//! Walking trees is I/O, so callers measure only on demand and never under
//! a `hold` verdict.
use std::path::{Path, PathBuf};

use super::clean::size_of;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TargetDir {
    pub path: PathBuf,
    pub bytes: u64,
}

/// `target/` dirs (real directories, not links) of `worktrees` and of the
/// worktrees under each one's `.worktrees/`, biggest first.
pub fn target_dirs(worktrees: &[PathBuf]) -> Vec<TargetDir> {
    let mut trees: Vec<PathBuf> = Vec::new();
    for wt in worktrees {
        trees.push(wt.clone());
        if let Ok(rd) = std::fs::read_dir(wt.join(".worktrees")) {
            trees.extend(rd.flatten().map(|e| e.path()));
        }
    }
    trees.sort();
    trees.dedup();
    let mut out: Vec<TargetDir> = trees
        .into_iter()
        .map(|t| t.join("target"))
        .filter(|t| std::fs::symlink_metadata(t).is_ok_and(|m| m.is_dir()))
        .map(|path| TargetDir {
            bytes: size_of(&path),
            path,
        })
        .collect();
    out.sort_by_key(|t| std::cmp::Reverse(t.bytes));
    out
}

fn setting_in(file: &Path) -> Option<String> {
    let text = std::fs::read_to_string(file).ok()?;
    let doc = text.parse::<toml_edit::DocumentMut>().ok()?;
    doc.get("cache")?
        .get("auto-clean-frequency")?
        .as_str()
        .map(str::to_string)
}

/// `$CARGO_HOME`, else `<home>/.cargo`.
pub fn cargo_home(home: &Path) -> PathBuf {
    std::env::var_os("CARGO_HOME").map_or_else(|| home.join(".cargo"), PathBuf::from)
}

/// Where Cargo's `cache.auto-clean-frequency` resolves to `"never"`, if it
/// does: the environment variable, else the nearest `.cargo/config.toml`
/// from `cwd` upward, else Cargo home's config.
pub fn auto_clean_disabled(cwd: &Path, home: &Path, env: Option<&str>) -> Option<String> {
    if let Some(value) = env {
        return (value == "never").then(|| "CARGO_CACHE_AUTO_CLEAN_FREQUENCY".to_string());
    }
    let mut files: Vec<PathBuf> = cwd
        .ancestors()
        .flat_map(|d| [d.join(".cargo/config.toml"), d.join(".cargo/config")])
        .collect();
    let ch = cargo_home(home);
    files.extend([ch.join("config.toml"), ch.join("config")]);
    files
        .into_iter()
        .find_map(|f| setting_in(&f).map(|v| (f, v)))
        .and_then(|(f, v)| (v == "never").then(|| f.display().to_string()))
}

/// Sizes of Cargo's registry and git caches.
pub fn cargo_cache_sizes(home: &Path) -> (u64, u64) {
    let ch = cargo_home(home);
    (size_of(&ch.join("registry")), size_of(&ch.join("git")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn target_dirs_are_found_and_sorted_and_auto_clean_never_is_detected() {
        let root = tempfile::tempdir().unwrap();
        let a = root.path().join("a");
        std::fs::create_dir_all(a.join("target/debug")).unwrap();
        std::fs::write(a.join("target/debug/big"), vec![0u8; 4096]).unwrap();
        std::fs::create_dir_all(a.join(".worktrees/w1/target")).unwrap();
        std::fs::write(a.join(".worktrees/w1/target/x"), b"x").unwrap();
        let found = target_dirs(std::slice::from_ref(&a));
        assert_eq!(found.len(), 2);
        assert_eq!(found[0].bytes, 4096);

        let home = root.path().join("home");
        assert_eq!(
            auto_clean_disabled(&a, &home, Some("never")).as_deref(),
            Some("CARGO_CACHE_AUTO_CLEAN_FREQUENCY")
        );
        assert_eq!(auto_clean_disabled(&a, &home, Some("1 day")), None);
        std::fs::create_dir_all(a.join(".cargo")).unwrap();
        std::fs::write(
            a.join(".cargo/config.toml"),
            "[cache]\nauto-clean-frequency = \"never\"\n",
        )
        .unwrap();
        assert!(
            auto_clean_disabled(&a, &home, None)
                .unwrap()
                .ends_with("config.toml")
        );
        std::fs::write(
            a.join(".cargo/config.toml"),
            "[cache]\nauto-clean-frequency = \"1 day\"\n",
        )
        .unwrap();
        assert_eq!(auto_clean_disabled(&a, &home, None), None);
    }
}
