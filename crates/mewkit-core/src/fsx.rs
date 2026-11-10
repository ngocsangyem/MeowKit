//! Path safety and atomic writes: the only way the installer touches disk.
//!
//! Every path an operation names is a [`RelPath`]: relative to a scope root,
//! `/`-separated, with no `..`, no absolute or drive prefix and no empty
//! component. A `RelPath` cannot name anything outside its root lexically, and
//! [`check_parents`] closes the remaining hole — a symlinked directory between
//! the root and the target — before any write or delete.
use std::fmt;
use std::io::{self, Write};
use std::path::{Path, PathBuf};

/// Why a path was refused.
#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum PathError {
    #[error("path is empty")]
    Empty,
    #[error("path {0:?} is absolute or carries a drive/root prefix")]
    Absolute(String),
    #[error("path {0:?} contains a `..`, `.` or empty component")]
    Traversal(String),
    #[error("path {0:?} contains a backslash or colon, which are refused on every OS")]
    Ambiguous(String),
    #[error("path {path:?} passes through symlinked directory {link:?}")]
    SymlinkedParent { path: String, link: String },
    #[error("path {0:?} is outside every root this target may write")]
    OutsideRoots(String),
    #[error("path {0:?} is user or machine state; mewkit never writes or deletes it")]
    NeverDelete(String),
}

/// A validated path relative to a scope root, stored with `/` separators.
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct RelPath(String);

impl RelPath {
    /// Validate `raw` as a root-relative path.
    pub fn new(raw: &str) -> Result<Self, PathError> {
        if raw.is_empty() {
            return Err(PathError::Empty);
        }
        if raw.contains('\\') || raw.contains(':') {
            return Err(PathError::Ambiguous(raw.to_owned()));
        }
        if raw.starts_with('/') {
            return Err(PathError::Absolute(raw.to_owned()));
        }
        if raw
            .split('/')
            .any(|c| c.is_empty() || c == "." || c == "..")
        {
            return Err(PathError::Traversal(raw.to_owned()));
        }
        Ok(Self(raw.to_owned()))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }

    /// True when `self` is `dir` or lies under it, compared by whole components.
    pub fn is_within(&self, dir: &RelPath) -> bool {
        self.0 == dir.0
            || (self.0.starts_with(&dir.0) && self.0.as_bytes().get(dir.0.len()) == Some(&b'/'))
    }

    /// The path on disk under `root`.
    pub fn under(&self, root: &Path) -> PathBuf {
        self.0.split('/').fold(root.to_path_buf(), |p, c| p.join(c))
    }
}

impl fmt::Display for RelPath {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

/// `.meowkit/` content owned by the user or the machine: never removed, whatever
/// an ownership index claims. Mirrors the npm CLI's `NEVER_DELETE_RELS`.
pub const NEVER_DELETE: [&str; 7] = [
    ".meowkit/memory",
    ".meowkit/telemetry",
    ".meowkit/state",
    ".meowkit/cache",
    ".meowkit/envs",
    ".meowkit/backups",
    ".meowkit/.env",
];

/// True for a path inside the never-delete class.
pub fn is_never_delete(path: &RelPath) -> bool {
    NEVER_DELETE
        .iter()
        .any(|p| path.is_within(&RelPath(String::from(*p))))
}

/// Refuse `path` unless it lies within one of `roots`.
pub fn check_within(path: &RelPath, roots: &[RelPath]) -> Result<(), PathError> {
    if roots.iter().any(|r| path.is_within(r)) {
        Ok(())
    } else {
        Err(PathError::OutsideRoots(path.0.clone()))
    }
}

/// Refuse `path` when any existing directory between `root` and its final
/// component is a symlink. The final component itself may be a link: replacing
/// or removing it acts on the link, never on its target.
pub fn check_parents(root: &Path, path: &RelPath) -> Result<(), PathError> {
    let components: Vec<&str> = path.0.split('/').collect();
    let mut current = root.to_path_buf();
    for (i, comp) in components[..components.len() - 1].iter().enumerate() {
        current.push(comp);
        match std::fs::symlink_metadata(&current) {
            Ok(meta) if meta.file_type().is_symlink() => {
                return Err(PathError::SymlinkedParent {
                    path: path.0.clone(),
                    link: components[..=i].join("/"),
                });
            }
            Ok(_) => {}
            // Nothing exists from here down, so nothing below can be a link.
            Err(_) => break,
        }
    }
    Ok(())
}

/// Write `bytes` to `dest` through a temp file in the same directory and a
/// rename, so a reader never sees a half-written file. Creates missing parent
/// directories. `mode` sets POSIX permissions (default 0644) and is ignored on Windows.
pub fn atomic_write(dest: &Path, bytes: &[u8], mode: Option<u32>) -> io::Result<()> {
    let dir = dest
        .parent()
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "destination has no parent"))?;
    std::fs::create_dir_all(dir)?;
    let mut tmp = tempfile::Builder::new()
        .prefix(".mewkit-tmp-")
        .tempfile_in(dir)?;
    tmp.write_all(bytes)?;
    tmp.as_file().sync_all()?;
    set_mode(tmp.path(), mode)?;
    tmp.persist(dest).map_err(|e| e.error)?;
    Ok(())
}

/// Lower-case hex SHA-256 of `bytes`.
pub fn sha256_hex(bytes: &[u8]) -> String {
    use sha2::Digest;
    sha2::Sha256::digest(bytes)
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect()
}

#[cfg(unix)]
fn set_mode(path: &Path, mode: Option<u32>) -> io::Result<()> {
    use std::os::unix::fs::PermissionsExt;
    // The temp file is created 0600; a kit file is world-readable unless told otherwise.
    std::fs::set_permissions(path, std::fs::Permissions::from_mode(mode.unwrap_or(0o644)))
}

#[cfg(not(unix))]
fn set_mode(_path: &Path, _mode: Option<u32>) -> io::Result<()> {
    Ok(())
}

#[cfg(test)]
#[path = "fsx_tests.rs"]
mod tests;
