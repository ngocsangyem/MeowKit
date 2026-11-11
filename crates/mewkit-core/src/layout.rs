//! Where a scope's root-relative paths live on disk.
//!
//! A project keeps everything under its root. A global install may find a
//! runtime's directory elsewhere (`CLAUDE_CONFIG_DIR`, `CODEX_HOME`, or a
//! symlinked `~/.claude`), so a path prefix can be mounted at an absolute
//! directory. Plans and ownership indexes keep the root-relative path either
//! way; only resolution to disk differs.
use std::path::{Path, PathBuf};

use crate::fsx::{PathError, RelPath, check_parents};

/// `at` and everything under it resolve into `dir`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Mount {
    pub at: RelPath,
    /// Absolute and free of symlinks: the caller resolves it.
    pub dir: PathBuf,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Layout {
    root: PathBuf,
    mounts: Vec<Mount>,
}

impl Layout {
    /// Every path under `root`.
    pub fn at(root: &Path) -> Self {
        Self::new(root, Vec::new())
    }

    pub fn new(root: &Path, mounts: Vec<Mount>) -> Self {
        Self {
            root: root.to_path_buf(),
            mounts,
        }
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn mounts(&self) -> &[Mount] {
        &self.mounts
    }

    /// The directory `path` is resolved from, and `path` relative to it
    /// (`None` when `path` is a mount point itself).
    fn split(&self, path: &RelPath) -> (&Path, Option<RelPath>) {
        let mount = self
            .mounts
            .iter()
            .filter(|m| path.is_within(&m.at))
            .max_by_key(|m| m.at.as_str().len());
        match mount {
            None => (&self.root, Some(path.clone())),
            Some(m) if *path == m.at => (&m.dir, None),
            Some(m) => {
                let rest = &path.as_str()[m.at.as_str().len() + 1..];
                (
                    &m.dir,
                    Some(RelPath::new(rest).expect("tail of a valid path")),
                )
            }
        }
    }

    /// The path on disk.
    pub fn resolve(&self, path: &RelPath) -> PathBuf {
        match self.split(path) {
            (base, Some(rest)) => rest.under(base),
            (base, None) => base.to_path_buf(),
        }
    }

    /// The directory `path` resolves under: its mount, or the root.
    pub fn base_of(&self, path: &RelPath) -> &Path {
        self.split(path).0
    }

    /// The directory nothing at or above may be pruned for `path`. A mount at
    /// its default place (`~/.agents`) may go when emptied; one the user
    /// moved (`CODEX_HOME`, a symlinked `~/.claude`) never does, nor anything
    /// above it.
    pub fn prune_floor(&self, path: &RelPath) -> &Path {
        let mount = self
            .mounts
            .iter()
            .filter(|m| path.is_within(&m.at))
            .max_by_key(|m| m.at.as_str().len());
        match mount {
            Some(m) if m.dir != m.at.under(&self.root) => &m.dir,
            _ => &self.root,
        }
    }

    /// [`check_parents`] from the directory `path` resolves under. A mount
    /// directory is checked too: it must not have become a symlink since the
    /// caller resolved it.
    pub fn check_parents(&self, path: &RelPath) -> Result<(), PathError> {
        let (base, rest) = self.split(path);
        if base != self.root
            && std::fs::symlink_metadata(base).is_ok_and(|m| m.file_type().is_symlink())
        {
            return Err(PathError::SymlinkedParent {
                path: path.to_string(),
                link: base.display().to_string(),
            });
        }
        match rest {
            Some(rest) => check_parents(base, &rest),
            None => Ok(()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rel(p: &str) -> RelPath {
        RelPath::new(p).unwrap()
    }

    #[test]
    fn mounted_prefixes_resolve_into_their_directory() {
        let root = Path::new("/home/u");
        let layout = Layout::new(
            root,
            vec![
                Mount {
                    at: rel(".codex"),
                    dir: PathBuf::from("/opt/codex"),
                },
                Mount {
                    at: rel(".codex/hooks"),
                    dir: PathBuf::from("/srv/hooks"),
                },
            ],
        );
        assert_eq!(
            layout.resolve(&rel(".codex/AGENTS.md")),
            Path::new("/opt/codex/AGENTS.md")
        );
        assert_eq!(
            layout.resolve(&rel(".codex/hooks/a.cjs")),
            Path::new("/srv/hooks/a.cjs"),
            "the longest mount wins"
        );
        assert_eq!(layout.resolve(&rel(".codex")), Path::new("/opt/codex"));
        assert_eq!(
            layout.resolve(&rel(".codexx/a")),
            Path::new("/home/u/.codexx/a"),
            "whole components only"
        );
        assert_eq!(layout.base_of(&rel(".agents/x")), root);
        assert_eq!(
            layout.prune_floor(&rel(".codex/a")),
            Path::new("/opt/codex")
        );
        let default = Layout::new(
            root,
            vec![Mount {
                at: rel(".agents"),
                dir: root.join(".agents"),
            }],
        );
        assert_eq!(default.prune_floor(&rel(".agents/skills/a")), root);
    }

    #[cfg(unix)]
    #[test]
    fn a_mount_directory_that_became_a_symlink_is_refused() {
        let tmp = tempfile::tempdir().unwrap();
        let real = tmp.path().join("real");
        std::fs::create_dir(&real).unwrap();
        let link = tmp.path().join("link");
        std::os::unix::fs::symlink(&real, &link).unwrap();
        let layout = Layout::new(
            tmp.path(),
            vec![Mount {
                at: rel(".claude"),
                dir: link,
            }],
        );
        assert!(layout.check_parents(&rel(".claude/a")).is_err());
        let layout = Layout::new(
            tmp.path(),
            vec![Mount {
                at: rel(".claude"),
                dir: real,
            }],
        );
        assert!(layout.check_parents(&rel(".claude/a")).is_ok());
    }
}
