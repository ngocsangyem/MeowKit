//! Building a [`Scope`]: a project root, or the home directory with each
//! runtime's user-level directory resolved to where it really is.
use std::ffi::OsString;
use std::path::{Component, Path, PathBuf};

use crate::contract::{EmitError, EmitRequest, RelPath, Scope, ScopeKind};
use mewkit_core::layout::{Layout, Mount};

/// Global runtime directories under the home directory, and the variable
/// that moves each one (Codex skills stay in `~/.agents` whatever `CODEX_HOME` says).
const GLOBAL_DIRS: &[(&str, Option<(&str, &str)>)] = &[
    (".claude", Some(("CLAUDE_CONFIG_DIR", "claude-code"))),
    (".codex", Some(("CODEX_HOME", "codex"))),
    (".agents", None),
    (".cursor", None),
];

impl Scope {
    pub fn project(root: &Path) -> Self {
        Self {
            kind: ScopeKind::Project,
            root: root.to_path_buf(),
            mounts: Vec::new(),
        }
    }

    /// The home directory, with every runtime directory mounted at its real
    /// location: the variable's value when set, then symlinks resolved, so
    /// hook commands carry a stable absolute path and the executor never
    /// writes through a link. `env` reads one environment variable.
    pub fn global(home: &Path, env: impl Fn(&str) -> Option<OsString>) -> Result<Self, EmitError> {
        let mut mounts = Vec::new();
        for (at, var) in GLOBAL_DIRS {
            let set = var.and_then(|(name, runtime)| {
                env(name)
                    .filter(|v| !v.is_empty())
                    .map(|v| (name, runtime, PathBuf::from(v)))
            });
            let dir = match set {
                Some((name, runtime, dir))
                    if !dir.is_absolute()
                        || dir
                            .components()
                            .any(|c| matches!(c, Component::ParentDir | Component::CurDir)) =>
                {
                    return Err(EmitError::Unsupported {
                        runtime,
                        what: format!(
                            "{name} that is not a plain absolute path ({})",
                            dir.display()
                        ),
                    });
                }
                Some((_, _, dir)) => dir,
                None => home.join(at),
            };
            mounts.push(Mount {
                at: RelPath::new(at).expect("static root"),
                dir: real(&dir),
            });
        }
        // Two runtimes in one directory would contend for the same files.
        for (i, a) in mounts.iter().enumerate() {
            if let Some(b) = mounts[i + 1..]
                .iter()
                .find(|b| a.dir.starts_with(&b.dir) || b.dir.starts_with(&a.dir))
            {
                return Err(EmitError::Unsupported {
                    runtime: "mewkit",
                    what: format!(
                        "{} and {} in one directory ({})",
                        a.at,
                        b.at,
                        a.dir.display()
                    ),
                });
            }
        }
        Ok(Self {
            kind: ScopeKind::Global,
            root: real(home),
            mounts,
        })
    }

    pub fn layout(&self) -> Layout {
        Layout::new(&self.root, self.mounts.clone())
    }

    /// Where `path` is on disk at this scope.
    pub fn resolve(&self, path: &RelPath) -> PathBuf {
        self.layout().resolve(path)
    }
}

/// A notice when this runtime's install at the other scope already merged a
/// privacy hook into `file`: both registrations stay, so the hook runs twice.
pub(crate) fn privacy_elsewhere(req: &EmitRequest<'_>, file: &str) -> Option<String> {
    let owned = req.other_scope?.sections.get(file)?;
    let has = owned
        .values()
        .flat_map(|s| &s.names)
        .any(|id| id.contains("privacy"));
    let other = match req.scope.kind {
        ScopeKind::Project => "global",
        ScopeKind::Global => "project",
    };
    has.then(|| {
        format!("the {other} install also registers the privacy hook in {file}; it will run at both scopes")
    })
}

/// `path` with symlinks resolved as far as it exists; a missing tail is kept.
fn real(path: &Path) -> PathBuf {
    let mut tail = Vec::new();
    let mut head = path.to_path_buf();
    loop {
        if let Ok(found) = std::fs::canonicalize(&head) {
            let mut out = plain(found);
            out.extend(tail.iter().rev());
            return out;
        }
        match (head.file_name().map(OsString::from), head.parent()) {
            (Some(name), Some(parent)) => {
                tail.push(name);
                head = parent.to_path_buf();
            }
            _ => return path.to_path_buf(),
        }
    }
}

/// Windows `canonicalize` returns `\\?\C:\…`; hook commands want `C:\…`.
fn plain(path: PathBuf) -> PathBuf {
    match path.to_str().and_then(|s| s.strip_prefix(r"\\?\")) {
        Some(rest) if rest.as_bytes().get(1) == Some(&b':') => PathBuf::from(rest),
        _ => path,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rel(p: &str) -> RelPath {
        RelPath::new(p).unwrap()
    }

    #[test]
    fn global_dirs_default_under_home_and_follow_their_variables() {
        let home = tempfile::tempdir().unwrap();
        let other = tempfile::tempdir().unwrap();
        let home_real = real(home.path());
        let scope = Scope::global(home.path(), |_| None).unwrap();
        assert_eq!(
            scope.resolve(&rel(".claude/settings.json")),
            home_real.join(".claude").join("settings.json")
        );
        let codex = other.path().join("my codex");
        let scope = Scope::global(home.path(), |v| {
            (v == "CODEX_HOME").then(|| codex.clone().into_os_string())
        })
        .unwrap();
        assert_eq!(
            scope.resolve(&rel(".codex/AGENTS.md")),
            real(other.path()).join("my codex").join("AGENTS.md")
        );
        assert_eq!(
            scope.resolve(&rel(".agents/skills/a")),
            home_real.join(".agents").join("skills").join("a"),
            "Codex skills stay in ~/.agents"
        );
        let err = Scope::global(home.path(), |v| {
            (v == "CLAUDE_CONFIG_DIR").then(|| OsString::from("rel/dir"))
        });
        assert!(matches!(err, Err(EmitError::Unsupported { .. })));
        let dotdot = other.path().join("a/../b");
        let err = Scope::global(home.path(), |v| {
            (v == "CODEX_HOME").then(|| dotdot.clone().into_os_string())
        });
        assert!(
            matches!(err, Err(EmitError::Unsupported { .. })),
            "`..` refused"
        );
        let shared = other.path().join("shared");
        let err = Scope::global(home.path(), |_| Some(shared.clone().into_os_string()));
        assert!(
            matches!(err, Err(EmitError::Unsupported { .. })),
            "one dir for two runtimes"
        );
    }

    #[cfg(unix)]
    #[test]
    fn a_symlinked_runtime_dir_is_mounted_at_its_target() {
        let home = tempfile::tempdir().unwrap();
        let dotfiles = tempfile::tempdir().unwrap();
        std::os::unix::fs::symlink(dotfiles.path(), home.path().join(".claude")).unwrap();
        let scope = Scope::global(home.path(), |_| None).unwrap();
        assert_eq!(
            scope.resolve(&rel(".claude/rules/a.md")),
            real(dotfiles.path()).join("rules").join("a.md")
        );
    }

    #[test]
    fn verbatim_drive_paths_lose_their_prefix() {
        assert_eq!(
            plain(PathBuf::from(r"\\?\C:\Users\a b")),
            PathBuf::from(r"C:\Users\a b")
        );
        assert_eq!(
            plain(PathBuf::from(r"\\?\UNC\srv\share")),
            PathBuf::from(r"\\?\UNC\srv\share")
        );
    }
}
