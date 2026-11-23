//! The disposable place an eval run happens in, and what the child may see.
//!
//! Every run works in a fresh copy of its fixture, never in the user's
//! project, with its own runtime home so the user's skills, plugins and MCP
//! servers do not leak into the measurement. The child's environment is
//! built from an allowlist: only what the runtime needs to find its tools and
//! authenticate. No credential file is ever copied in.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use super::transcript::Runtime;

pub use super::sandbox_git::{UNCOMMITTED_DIR, git_init, write_git_identity};

/// Passed through from the parent when set: process basics.
const BASE_VARS: [&str; 5] = ["PATH", "LANG", "LC_ALL", "TERM", "TMPDIR"];

/// Auth variables each runtime reads; nothing else of the parent's leaks in.
pub fn auth_vars(runtime: Runtime) -> &'static [&'static str] {
    match runtime {
        Runtime::ClaudeCode => &["CLAUDE_CODE_OAUTH_TOKEN", "ANTHROPIC_API_KEY"],
        Runtime::Codex => &["CODEX_API_KEY", "OPENAI_API_KEY"],
    }
}

/// The child's whole environment: allowlisted parent variables, plus `HOME`
/// and the runtime's config home pointed inside the sandbox.
pub fn child_env(
    parent: impl IntoIterator<Item = (String, String)>,
    runtime: Runtime,
    home: &Path,
) -> Vec<(String, String)> {
    let allowed: Vec<&str> = BASE_VARS
        .iter()
        .chain(auth_vars(runtime))
        .copied()
        .collect();
    let mut env: Vec<(String, String)> = parent
        .into_iter()
        .filter(|(k, v)| allowed.contains(&k.as_str()) && !v.is_empty())
        .collect();
    let home_s = home.display().to_string();
    env.push(("HOME".into(), home_s.clone()));
    let config = match runtime {
        Runtime::ClaudeCode => ("CLAUDE_CONFIG_DIR", home.join(".claude")),
        Runtime::Codex => ("CODEX_HOME", home.join(".codex")),
    };
    env.push((config.0.into(), config.1.display().to_string()));
    env.sort();
    env
}

/// True when the environment carries a way for the runtime to authenticate.
pub fn has_auth(env: &[(String, String)], runtime: Runtime) -> bool {
    env.iter()
        .any(|(k, _)| auth_vars(runtime).contains(&k.as_str()))
}

/// Copy `src` into `dst` (created), refusing symlinks anywhere inside.
pub fn copy_tree(src: &Path, dst: &Path) -> io::Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ft = entry.file_type()?;
        let to = dst.join(entry.file_name());
        if ft.is_symlink() {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                format!("{} is a symlink", entry.path().display()),
            ));
        } else if ft.is_dir() {
            copy_tree(&entry.path(), &to)?;
        } else {
            fs::copy(entry.path(), &to)?;
        }
    }
    Ok(())
}

/// Delete every installed copy of `skill` under `root`: any folder named
/// `skill` or `mk-skill` whose parent folder is `skills`. A copy left anywhere
/// lets the model find the skill by searching, so the "off" arm would not be
/// off. Returns the folders removed.
pub fn remove_skill(root: &Path, skill: &str) -> io::Result<Vec<PathBuf>> {
    let names = [skill.to_owned(), format!("mk-{skill}")];
    let mut removed = Vec::new();
    let mut stack = vec![root.to_path_buf()];
    while let Some(dir) = stack.pop() {
        for entry in fs::read_dir(&dir)? {
            let entry = entry?;
            if !entry.file_type()?.is_dir() {
                continue;
            }
            let path = entry.path();
            let is_copy = dir.file_name().is_some_and(|n| n == "skills")
                && names.iter().any(|n| entry.file_name() == n.as_str());
            if is_copy {
                fs::remove_dir_all(&path)?;
                removed.push(path);
            } else if entry.file_name() != ".git" {
                stack.push(path);
            }
        }
    }
    removed.sort();
    Ok(removed)
}

/// A run's working folder as a [`super::grade::Workspace`].
pub struct DirWorkspace(pub PathBuf);

impl super::grade::Workspace for DirWorkspace {
    fn read_matching(&self, pattern: &crate::fsx::RelPath) -> Vec<String> {
        let mut found = Vec::new();
        let parts: Vec<&str> = pattern.as_str().split('/').collect();
        collect(&self.0, &parts, &mut found);
        found
    }
}

/// `*` matches any run of characters within one segment; no symlink is followed.
fn segment_matches(pattern: &str, name: &str) -> bool {
    let pieces: Vec<&str> = pattern.split('*').collect();
    if pieces.len() == 1 {
        return pattern == name;
    }
    let (first, last) = (pieces[0], pieces[pieces.len() - 1]);
    if !name.starts_with(first) || name.len() < first.len() + last.len() || !name.ends_with(last) {
        return false;
    }
    let mut rest = &name[first.len()..name.len() - last.len()];
    for mid in &pieces[1..pieces.len() - 1] {
        match rest.find(mid) {
            Some(i) => rest = &rest[i + mid.len()..],
            None => return false,
        }
    }
    true
}

fn collect(dir: &Path, parts: &[&str], found: &mut Vec<String>) {
    let Some((head, tail)) = parts.split_first() else {
        return;
    };
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    let mut names: Vec<String> = entries
        .filter_map(|e| e.ok()?.file_name().into_string().ok())
        .filter(|n| segment_matches(head, n))
        .collect();
    names.sort();
    for name in names {
        let path = dir.join(&name);
        let Ok(meta) = fs::symlink_metadata(&path) else {
            continue;
        };
        if meta.file_type().is_symlink() {
            continue;
        }
        if tail.is_empty() {
            if meta.is_file() {
                found.push(fs::read_to_string(&path).unwrap_or_default());
            }
        } else if meta.is_dir() {
            collect(&path, tail, found);
        }
    }
}
