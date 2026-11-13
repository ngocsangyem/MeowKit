//! Node's `path.resolve` and the project-boundary test built on
//! `path.relative`, for the two `--evidence` paths a caller supplies.
//!
//! Both are LEXICAL, exactly as Node's are: they rewrite text and follow no
//! symlink. That is why the correction path calls `realpath` BEFORE asking these
//! anything — checking the literal argument answers a question about the
//! caller's string, not about the file that will actually be opened.

use std::path::{Component, Path, PathBuf};

/// `path.resolve(base, candidate)`: an absolute candidate wins, otherwise it is
/// joined onto `base`, and the result is normalised without touching the disk.
pub fn resolve_from(base: &Path, candidate: &str) -> PathBuf {
    let raw = Path::new(candidate);
    let joined = if raw.is_absolute() {
        raw.to_path_buf()
    } else {
        base.join(raw)
    };
    normalise(&joined)
}

/// Collapse `.`, pop `..`, and drop repeated separators.
fn normalise(path: &Path) -> PathBuf {
    let mut out = PathBuf::new();
    let mut rooted = false;
    for component in path.components() {
        match component {
            Component::CurDir => {}
            Component::ParentDir => {
                // `..` above an absolute root stays at the root, as Node's does;
                // above a relative one it is kept, because there is something
                // outside to name.
                if !out.pop() && !rooted {
                    out.push("..");
                }
            }
            Component::RootDir | Component::Prefix(_) => {
                rooted = true;
                out.push(component.as_os_str());
            }
            Component::Normal(part) => out.push(part),
        }
    }
    out
}

/// Whether `candidate` stays inside `root` — the `injection-rules.md` project
/// boundary, expressed the way the npm CLI expresses it: refuse when
/// `path.relative(root, candidate)` escapes upward or stays absolute.
pub fn is_inside(root: &Path, candidate: &Path) -> bool {
    candidate.starts_with(root)
}

/// `path.relative(root, candidate)` with `/` separators, for the one place a
/// relative path is PRINTED rather than tested.
pub fn relative_to(root: &Path, candidate: &Path) -> String {
    candidate
        .strip_prefix(root)
        .unwrap_or(candidate)
        .to_string_lossy()
        .replace('\\', "/")
}

/// `realpath`, with the ROOT resolved too.
///
/// Resolving only one side compares a real path against a textual one: on macOS
/// `/var` is itself a symlink to `/private/var`, so a project under `/var/…`
/// would compute as outside itself and every correction would be refused.
pub fn real_root(project_root: &Path) -> PathBuf {
    std::fs::canonicalize(project_root).unwrap_or_else(|_| project_root.to_path_buf())
}

#[cfg(test)]
#[path = "paths_tests.rs"]
mod tests;
