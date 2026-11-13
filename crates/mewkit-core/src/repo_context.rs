//! Which repository OWNS a path, and whether a path stays inside a boundary.
//!
//! Port of the resolution half of `core/repo-context.ts`. The revision is read
//! directly from git refs — never by running a `git` binary — and it is
//! PROVENANCE: a repo that cannot be resolved yields `None` rather than a
//! fabricated revision. The evidence-envelope half of that module is not ported
//! here; nothing in this crate reads it yet.
use std::path::{Component, Path, PathBuf};
use std::sync::LazyLock;

use regex::Regex;

use crate::js_regex;

/// A resolved git revision must be a hex object id — never arbitrary file
/// content read out of a crafted repository.
static SHA_RE: LazyLock<Regex> =
    LazyLock::new(|| js_regex::compile(r"^[0-9a-f]{7,64}$").expect("static sha pattern"));

/// `gitdir: <path>` — the pointer a `.git` FILE carries in a worktree or
/// submodule checkout.
static GITDIR_RE: LazyLock<Regex> =
    LazyLock::new(|| js_regex::compile(r"(?m)^gitdir:\s*(.+)$").expect("static gitdir pattern"));

/// A line of `packed-refs`: `<sha> <refname>`.
static PACKED_RE: LazyLock<Regex> = LazyLock::new(|| {
    js_regex::compile(r"^([0-9a-f]{7,64})\s+(.+)$").expect("static packed pattern")
});

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OwningRepo {
    /// Repo root (git) or the boundary root (non-git) — a stable identity,
    /// never invented.
    pub identity: PathBuf,
    /// Git HEAD revision when resolvable; `None` for a non-git root or an
    /// unresolvable HEAD.
    pub revision: Option<String>,
    pub is_git: bool,
}

/// Absolutize and collapse `.`/`..` WITHOUT touching the filesystem, the way
/// `path.resolve` does. Symlinks are deliberately not followed: the containment
/// checks here are lexical, and the TypeScript they mirror is lexical too.
pub fn lexical_resolve(base: &Path, path: &Path) -> PathBuf {
    let joined = if path.is_absolute() {
        path.to_path_buf()
    } else {
        base.join(path)
    };
    let mut out = PathBuf::new();
    for part in joined.components() {
        match part {
            Component::CurDir => {}
            Component::ParentDir => {
                // Popping past the root is a no-op, as in `path.resolve`.
                if !matches!(
                    out.components().next_back(),
                    None | Some(Component::RootDir) | Some(Component::Prefix(_))
                ) {
                    out.pop();
                } else if out.components().next().is_none() {
                    out.push("..");
                }
            }
            other => out.push(other.as_os_str()),
        }
    }
    out
}

/// True when `target` stays within `boundary_root` (lexical; used to reject an
/// out-of-scope path). Both sides are resolved against the current directory
/// first, so a relative argument is judged the same way `path.resolve` judges it.
pub fn is_within_boundary(boundary_root: &Path, target: &Path) -> bool {
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let boundary = lexical_resolve(&cwd, boundary_root);
    let target = lexical_resolve(&cwd, target);
    target.starts_with(&boundary)
}

/// The `.git` metadata dir for a repo root, following a `.git` FILE's `gitdir:`
/// pointer. Best effort: any read error yields `None`, because the revision is
/// provenance and never load-bearing.
fn resolve_git_dir(repo_root: &Path) -> Option<PathBuf> {
    let dotgit = repo_root.join(".git");
    let meta = std::fs::metadata(&dotgit).ok()?;
    if meta.is_dir() {
        return Some(dotgit);
    }
    let text = std::fs::read_to_string(&dotgit).ok()?;
    let folded = js_regex::fold_line_terminators(&text);
    let pointer = GITDIR_RE.captures(&folded)?.get(1)?.as_str().trim();
    let pointer = Path::new(pointer);
    Some(if pointer.is_absolute() {
        pointer.to_path_buf()
    } else {
        lexical_resolve(repo_root, pointer)
    })
}

/// Read the HEAD revision from a git metadata dir directly (HEAD → ref →
/// packed-refs).
///
/// SECURITY: HEAD is untrusted repository DATA. Only a hex object id is
/// returned, and only from a ref file still contained in `git_dir` — a crafted
/// `ref: ../../etc/passwd` must never read arbitrary file content into the
/// revision field.
fn read_head_revision(git_dir: &Path) -> Option<String> {
    let head = std::fs::read_to_string(git_dir.join("HEAD")).ok()?;
    let head = head.trim();
    let Some(ref_name) = head.strip_prefix("ref:") else {
        return SHA_RE.is_match(head).then(|| head.to_string()); // detached HEAD
    };
    let ref_name = ref_name.trim();
    let ref_file = git_dir.join(ref_name);
    if is_within_boundary(git_dir, &ref_file)
        && let Ok(sha) = std::fs::read_to_string(&ref_file)
    {
        let sha = sha.trim();
        if SHA_RE.is_match(sha) {
            return Some(sha.to_string());
        }
    }
    let packed = std::fs::read_to_string(git_dir.join("packed-refs")).ok()?;
    for line in js_regex::fold_line_terminators(&packed).split('\n') {
        let Some(found) = PACKED_RE.captures(line.trim()) else {
            continue;
        };
        if found.get(2).is_some_and(|m| m.as_str() == ref_name) {
            return found.get(1).map(|m| m.as_str().to_string());
        }
    }
    None
}

/// Resolve the repository that OWNS `abs_path` by walking up to the nearest
/// ancestor holding a `.git` marker (never crossing above `boundary_root` when
/// given). A git match yields the repo root plus its HEAD revision; no match
/// yields the boundary root (or the path's own directory) as a stable non-git
/// identity with no revision. Each path resolves to its OWN nested repo, so a
/// multi-repo parent is not treated as one repository.
pub fn resolve_owning_repo(abs_path: &Path, boundary_root: Option<&Path>) -> OwningRepo {
    let start_dir = if std::fs::metadata(abs_path).is_ok_and(|m| m.is_dir()) {
        abs_path.to_path_buf()
    } else {
        abs_path.parent().unwrap_or(abs_path).to_path_buf()
    };
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let boundary = boundary_root.map(|b| lexical_resolve(&cwd, b));
    let mut dir = lexical_resolve(&cwd, &start_dir);
    // Defense in depth: never walk a start path outside the boundary — a caller
    // that skipped the containment gate must not make us climb to an unrelated
    // parent repository.
    if let Some(boundary) = &boundary
        && !dir.starts_with(boundary)
    {
        return OwningRepo {
            identity: boundary.clone(),
            revision: None,
            is_git: false,
        };
    }
    loop {
        if dir.join(".git").exists() {
            return OwningRepo {
                revision: resolve_git_dir(&dir).and_then(|g| read_head_revision(&g)),
                identity: dir,
                is_git: true,
            };
        }
        if boundary.as_deref() == Some(dir.as_path()) {
            break; // do not cross the boundary
        }
        match dir.parent() {
            Some(parent) if parent != dir => dir = parent.to_path_buf(),
            _ => break, // filesystem root
        }
    }
    OwningRepo {
        identity: boundary.unwrap_or_else(|| lexical_resolve(&cwd, &start_dir)),
        revision: None,
        is_git: false,
    }
}

#[cfg(test)]
#[path = "repo_context_tests.rs"]
mod tests;
