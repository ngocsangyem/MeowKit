//! Project-relative reads and writes that never follow a symlink.
//!
//! A cloned repository controls every file under its root, links included. A
//! committed link at `.meowkit/memory/gotchas.md` or a linked `.meowkit/`
//! directory would turn a project-relative write into a write anywhere the
//! user can reach (a shell rc file, `~/.claude/settings.json`), and a read
//! through one would copy that file's content into the project. Every write,
//! append, directory creation and read-before-merge of a project-relative path
//! goes through these functions, which refuse when the target itself or any
//! existing component between `root` and it is a symlink.
use std::fs::File;
use std::io;
use std::path::{Component, Path};

/// Why a project-relative path was refused.
#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum NoFollowError {
    #[error(
        "refusing {path}: {link} is a symlink, and following it could take the write outside {root}"
    )]
    Symlink {
        path: String,
        /// The linked component, relative to `root`.
        link: String,
        root: String,
    },
    #[error("refusing {path}: it is not inside {root}")]
    Outside { path: String, root: String },
}

fn refused(error: NoFollowError) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidInput, error)
}

/// The symlink refusal carried by `error`, when it is one.
pub fn no_follow_error(error: &io::Error) -> Option<&NoFollowError> {
    error
        .get_ref()
        .and_then(|e| e.downcast_ref::<NoFollowError>())
}

/// Refuse `target` when it, or any existing component between `root` and it,
/// is a symlink, or when it does not lie lexically under `root`. `root` itself
/// is trusted: it is where the user ran the command or what they configured.
pub fn refuse_symlinks(root: &Path, target: &Path) -> io::Result<()> {
    let outside = || {
        refused(NoFollowError::Outside {
            path: target.display().to_string(),
            root: root.display().to_string(),
        })
    };
    let rest = target.strip_prefix(root).map_err(|_| outside())?;
    let mut current = root.to_path_buf();
    for component in rest.components() {
        match component {
            Component::Normal(name) => current.push(name),
            Component::CurDir => continue,
            _ => return Err(outside()),
        }
        match std::fs::symlink_metadata(&current) {
            Ok(meta) if meta.file_type().is_symlink() => {
                return Err(refused(NoFollowError::Symlink {
                    path: target.display().to_string(),
                    link: current
                        .strip_prefix(root)
                        .unwrap_or(&current)
                        .display()
                        .to_string(),
                    root: root.display().to_string(),
                }));
            }
            Ok(_) => {}
            // Nothing exists from here down, so nothing below can be a link.
            Err(_) => break,
        }
    }
    Ok(())
}

/// `std::fs::create_dir_all` for a directory under `root`.
pub fn create_dir_all_in(root: &Path, dir: &Path) -> io::Result<()> {
    refuse_symlinks(root, dir)?;
    std::fs::create_dir_all(dir)
}

fn create_parent_in(root: &Path, target: &Path) -> io::Result<()> {
    match target.parent() {
        Some(dir) if dir.starts_with(root) && dir != root => create_dir_all_in(root, dir),
        _ => Ok(()),
    }
}

/// Read a file under `root`; a missing file is the usual `NotFound` error.
pub fn read_in(root: &Path, target: &Path) -> io::Result<Vec<u8>> {
    refuse_symlinks(root, target)?;
    std::fs::read(target)
}

/// [`read_in`] as UTF-8.
pub fn read_to_string_in(root: &Path, target: &Path) -> io::Result<String> {
    refuse_symlinks(root, target)?;
    std::fs::read_to_string(target)
}

/// Write `bytes` to a file under `root`, creating missing parent directories.
pub fn write_in(root: &Path, target: &Path, bytes: impl AsRef<[u8]>) -> io::Result<()> {
    refuse_symlinks(root, target)?;
    create_parent_in(root, target)?;
    std::fs::write(target, bytes)
}

/// [`super::atomic_write`] for a file under `root`.
pub fn atomic_write_in(
    root: &Path,
    target: &Path,
    bytes: &[u8],
    mode: Option<u32>,
) -> io::Result<()> {
    refuse_symlinks(root, target)?;
    create_parent_in(root, target)?;
    super::atomic_write(target, bytes, mode)
}

/// Open a file under `root` for appending, creating it and its parents. The
/// opened file is confirmed to resolve inside `root`, so a link swapped in
/// between the check and the open is caught before anything is written.
pub fn append_in(root: &Path, target: &Path) -> io::Result<File> {
    refuse_symlinks(root, target)?;
    create_parent_in(root, target)?;
    let file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(target)?;
    if !target.canonicalize()?.starts_with(root.canonicalize()?) {
        return Err(refused(NoFollowError::Outside {
            path: target.display().to_string(),
            root: root.display().to_string(),
        }));
    }
    Ok(file)
}

#[cfg(test)]
#[path = "fsx_no_follow_tests.rs"]
mod tests;
