//! Finding the task tree, and reading what is in it.
//!
//! The walks start at the working directory and go UP, so `task` works from a
//! subdirectory of a project the way `git` does. They key off `tasks/` itself:
//! this verb owns human task FILES, which live there whatever provider is
//! installed.
use std::path::{Path, PathBuf};

use super::naming::TaskType;

/// Walk up from `start` looking for `tasks/active/`.
pub fn find_tasks_dir(start: &Path) -> Option<PathBuf> {
    walk_up(start, |dir| {
        let candidate = dir.join("tasks").join("active");
        candidate.is_dir().then_some(candidate)
    })
}

/// Walk up from `start` looking for the `tasks/` root (the `--all` scan).
pub fn find_tasks_root(start: &Path) -> Option<PathBuf> {
    walk_up(start, |dir| {
        let candidate = dir.join("tasks");
        candidate.is_dir().then_some(candidate)
    })
}

/// The project root for template lookup: the nearest ancestor holding `tasks/`,
/// else `start` itself — the same fallback the npm CLI uses, so a project
/// without a task tree still resolves a root rather than failing.
pub fn find_project_root(start: &Path) -> PathBuf {
    walk_up(start, |dir| {
        dir.join("tasks").exists().then(|| dir.to_path_buf())
    })
    .unwrap_or_else(|| start.to_path_buf())
}

fn walk_up<T>(start: &Path, probe: impl Fn(&Path) -> Option<T>) -> Option<T> {
    let mut current = start.to_path_buf();
    loop {
        if let Some(found) = probe(&current) {
            return Some(found);
        }
        match current.parent() {
            Some(parent) if parent != current => current = parent.to_path_buf(),
            _ => return None,
        }
    }
}

/// Every `.md` file under `dir`, recursively, with each directory's entries in
/// NAME order and a subdirectory walked where its own name falls.
///
/// The sort is not a tidy-up: it is what `readdirSync` already does for the npm
/// CLI. Node reads a directory through libuv's `scandir`, which sorts the
/// entries by `strcmp`, while `std::fs::read_dir` hands back raw filesystem
/// order — on APFS a hash order. Without this the two CLIs print the same rows
/// in different sequences, which is a real difference in the OUTPUT a user
/// reads even though neither is wrong.
pub fn collect_md_files(dir: &Path) -> std::io::Result<Vec<PathBuf>> {
    let mut entries: Vec<std::fs::DirEntry> =
        std::fs::read_dir(dir)?.collect::<std::io::Result<_>>()?;
    // `strcmp` compares bytes, which is what an `OsString` ordering does too.
    entries.sort_by_key(std::fs::DirEntry::file_name);
    let mut out = Vec::new();
    for entry in entries {
        let path = entry.path();
        let kind = entry.file_type()?;
        if kind.is_dir() {
            out.extend(collect_md_files(&path)?);
        } else if kind.is_file()
            // The test is on the NAME, not a parsed extension, so a file called
            // exactly `.md` counts here as it does in the npm CLI.
            && entry.file_name().to_string_lossy().ends_with(".md")
        {
            out.push(path);
        }
    }
    Ok(out)
}

/// The five frontmatter fields the listing reads. Anything else in the block is
/// ignored rather than refused: a task file is a human document first.
#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct TaskFrontmatter {
    pub title: Option<String>,
    pub task_type: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub created: Option<String>,
}

/// Parse the `---` fenced block at the START of a document.
///
/// Deliberately not a YAML parser: it is the same line-wise `key: value` scan
/// the npm CLI does, including stripping ONE pair of surrounding double quotes,
/// so a title with a colon in it reads the same in both. LF-delimited fences
/// only, matching `/^---\n([\s\S]*?)\n---/`.
pub fn parse_frontmatter(content: &str) -> TaskFrontmatter {
    let mut out = TaskFrontmatter::default();
    let Some(body) = content.strip_prefix("---\n") else {
        return out;
    };
    let Some(end) = body.find("\n---") else {
        return out;
    };
    for line in body[..end].split('\n') {
        let Some(colon) = line.find(':') else {
            continue;
        };
        let key = line[..colon].trim();
        let value = unquote(line[colon + 1..].trim());
        let slot = match key {
            "title" => &mut out.title,
            "type" => &mut out.task_type,
            "status" => &mut out.status,
            "priority" => &mut out.priority,
            "created" => &mut out.created,
            _ => continue,
        };
        *slot = Some(value);
    }
    out
}

/// Strip one pair of surrounding double quotes, as `/^"(.*)"$/` does. A value
/// that is a lone `"` is not a pair and keeps it.
fn unquote(value: &str) -> String {
    let inner = value
        .strip_prefix('"')
        .and_then(|rest| rest.strip_suffix('"'));
    match inner {
        // `.` in the pattern does not cross a line terminator, but a single
        // frontmatter line never contains one.
        Some(inner) => inner.to_string(),
        None => value.to_string(),
    }
}

/// A per-type task template a PROJECT authored, or `None` when it has none.
///
/// The kit ships no file under any of these names, so `None` is the normal
/// answer and the caller's inline frontmatter is the normal body. The lookup
/// exists so a team that keeps its own task shape can drop a file in and have
/// `task new` pick it up.
pub fn read_template(task_type: TaskType, project_root: &Path) -> Option<String> {
    let name = task_type.template_name();
    for prefix in [
        project_root.join(".claude").join("tasks").join("templates"),
        project_root.join("tasks").join("templates"),
        project_root.join("system").join("tasks").join("templates"),
    ] {
        let candidate = prefix.join(name);
        if candidate.exists() {
            return std::fs::read_to_string(&candidate).ok();
        }
    }
    None
}
