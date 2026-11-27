//! Which worktree a process works in, found without running `git`: running
//! `git` in another project's directory would execute that project's config
//! (`core.fsmonitor`, hooks) with this user's rights.
use std::collections::HashMap;
use std::path::{Path, PathBuf};

/// The nearest ancestor of `cwd` (itself included) holding a `.git` directory
/// or file (a linked worktree or submodule has a `.git` file).
pub fn git_toplevel(cwd: &Path) -> Option<PathBuf> {
    cwd.ancestors()
        .find(|dir| dir.join(".git").symlink_metadata().is_ok())
        .map(Path::to_path_buf)
}

/// `git_toplevel` memoised per cwd for one sample, since many processes of
/// one agent share a directory.
#[derive(Default)]
pub struct ToplevelCache(HashMap<PathBuf, Option<PathBuf>>);

impl ToplevelCache {
    pub fn get(&mut self, cwd: &Path) -> Option<PathBuf> {
        self.0
            .entry(cwd.to_path_buf())
            .or_insert_with(|| git_toplevel(cwd))
            .clone()
    }
}

/// The spelling both the CLI and the hook hash for an inbox key: forward
/// slashes, `.`/`..` segments resolved lexically, a lower-case drive letter,
/// no trailing slash. Lexical only: the hook cannot resolve symlinks the same
/// way on every OS, and both sides must agree byte for byte.
pub fn normalize(path: &str) -> String {
    let unified = path.replace('\\', "/");
    let (prefix, rest) = match unified.as_bytes() {
        [d, b':', ..] if d.is_ascii_alphabetic() => {
            (format!("{}:", (*d as char).to_ascii_lowercase()), &unified[2..])
        }
        _ => (String::new(), unified.as_str()),
    };
    let absolute = rest.starts_with('/');
    let mut parts: Vec<&str> = Vec::new();
    for seg in rest.split('/') {
        match seg {
            "" | "." => {}
            ".." => {
                parts.pop();
            }
            s => parts.push(s),
        }
    }
    let joined = parts.join("/");
    match (absolute, joined.is_empty()) {
        (true, true) => format!("{prefix}/"),
        (true, false) => format!("{prefix}/{joined}"),
        (false, _) => format!("{prefix}{joined}"),
    }
}

/// The inbox file stem for a worktree: the first 16 hex chars of the SHA-256
/// of its normalized path.
pub fn inbox_key(toplevel: &str) -> String {
    crate::fsx::sha256_hex(normalize(toplevel).as_bytes())[..16].to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalization_unifies_separators_case_and_dots() {
        assert_eq!(normalize("/Users/a/repo/"), "/Users/a/repo");
        assert_eq!(normalize("/Users/a/./x/../repo"), "/Users/a/repo");
        assert_eq!(normalize("C:\\Work\\Repo\\"), "c:/Work/Repo");
        assert_eq!(normalize("/"), "/");
        assert_eq!(inbox_key("C:\\Work\\Repo"), inbox_key("c:/Work/Repo/"));
        assert_eq!(inbox_key("/x").len(), 16);
    }

    #[test]
    fn toplevel_finds_a_git_dir_or_file_without_running_git() {
        let tmp = tempfile::tempdir().unwrap();
        let repo = tmp.path().join("repo");
        let deep = repo.join("a/b");
        std::fs::create_dir_all(&deep).unwrap();
        assert_eq!(git_toplevel(&deep), None);
        std::fs::write(repo.join(".git"), "gitdir: /elsewhere\n").unwrap();
        assert_eq!(git_toplevel(&deep), Some(repo.clone()));
        let mut cache = ToplevelCache::default();
        assert_eq!(cache.get(&deep), Some(repo));
    }
}
