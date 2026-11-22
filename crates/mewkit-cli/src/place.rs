//! Where a command acts: the current project, or the home directory with
//! `--global`, and where that scope keeps mewkit's own state.
use std::path::{Path, PathBuf};

use mewkit_adapters::contract::{OwnershipIndex, RelPath, Runtime};
use mewkit_adapters::{Emitter, Scope};
use mewkit_core::exec;

use crate::failure::Failure;

pub struct Place {
    pub scope: Scope,
    /// Root-relative directory of mewkit's state: `.meowkit` for a project,
    /// `.mewkit/state` for a global install (maintainer decision 2026-11-11),
    /// so a project install made in the home directory never shares it.
    state: &'static str,
}

impl Place {
    pub fn new(global: bool) -> Result<Self, Failure> {
        if global {
            Self::home()
        } else {
            Ok(Self::project(&std::env::current_dir()?))
        }
    }

    pub fn project(root: &Path) -> Self {
        Self {
            scope: Scope::project(root),
            state: ".meowkit",
        }
    }

    pub fn home() -> Result<Self, Failure> {
        let home = home_dir()?;
        Ok(Self {
            scope: Scope::global(&home, |name| std::env::var_os(name))?,
            state: ".mewkit/state",
        })
    }

    /// The other scope (global for a project and the reverse), when it resolves.
    pub fn other(&self) -> Option<Self> {
        match self.scope.kind {
            mewkit_adapters::ScopeKind::Project => Self::home().ok(),
            mewkit_adapters::ScopeKind::Global => {
                std::env::current_dir().ok().map(|d| Self::project(&d))
            }
        }
    }

    pub fn label(&self) -> &'static str {
        match self.scope.kind {
            mewkit_adapters::ScopeKind::Project => "project",
            mewkit_adapters::ScopeKind::Global => "global",
        }
    }

    fn rel(&self, tail: &str) -> RelPath {
        RelPath::new(&format!("{}/{tail}", self.state)).expect("static state path")
    }

    fn index_file(&self, runtime: Runtime) -> RelPath {
        let dir = if self.state == ".meowkit" {
            "state/ownership"
        } else {
            "ownership"
        };
        self.rel(&format!("{dir}/{}.json", runtime.name()))
    }

    /// This machine's skill selection: under the state directory, which the
    /// project's `.meowkit/.gitignore` keeps out of version control.
    pub fn selection_file(&self) -> PathBuf {
        let tail = if self.state == ".meowkit" {
            "state/skill-selection.json"
        } else {
            "skill-selection.json"
        };
        self.rel(tail).under(&self.scope.root)
    }

    /// Where this scope keeps its skill store: the sidecar beside the
    /// ownership ledgers, approvals machine-local under the state directory,
    /// stored overlays beside it where a team may choose to commit them.
    pub fn store_paths(&self) -> mewkit_core::skill_store::StorePaths {
        let (ownership, dir, lock, overlays) = if self.state == ".meowkit" {
            (
                "state/ownership",
                "state/skill-store",
                "state/mewkit.lock",
                ".meowkit/skill-overlays",
            )
        } else {
            (
                "ownership",
                "skill-store",
                "mewkit.lock",
                ".mewkit/skill-overlays",
            )
        };
        mewkit_core::skill_store::StorePaths {
            sidecar: self.rel(&format!("{ownership}/skill-store.json")),
            dir: self.rel(dir),
            overlays: RelPath::new(overlays).expect("static overlay path"),
            lock: self.rel(lock),
            backups: self.rel("backups"),
        }
    }

    pub fn cache_dir(&self) -> PathBuf {
        self.rel("cache/kits").under(&self.scope.root)
    }

    /// This runtime's ownership index here, if it has been installed.
    pub fn index(&self, runtime: Runtime) -> Result<Option<OwnershipIndex>, Failure> {
        Ok(OwnershipIndex::load(
            &self.index_file(runtime).under(&self.scope.root),
        )?)
    }

    /// The runtimes installed here, in registry order.
    pub fn installed(&self) -> Result<Vec<Runtime>, Failure> {
        let mut out = Vec::new();
        for r in mewkit_adapters::registry::emitted() {
            if self.index(r)?.is_some() {
                out.push(r);
            }
        }
        Ok(out)
    }

    pub fn exec_scope(&self, emitter: &dyn Emitter) -> exec::Scope {
        let (lock, backups) = if self.state == ".meowkit" {
            ("state/mewkit.lock", "backups")
        } else {
            ("mewkit.lock", "backups")
        };
        exec::Scope {
            root: self.scope.root.clone(),
            mounts: self.scope.mounts.clone(),
            roots: emitter.roots(&self.scope),
            index_file: self.index_file(emitter.target()),
            lock_file: self.rel(lock),
            backups_dir: self.rel(backups),
        }
    }
}

fn home_dir() -> Result<PathBuf, Failure> {
    ["HOME", "USERPROFILE"]
        .iter()
        .filter_map(std::env::var_os)
        .find(|v| !v.is_empty())
        .map(PathBuf::from)
        .ok_or_else(|| Failure::failed("cannot find your home directory: HOME is not set"))
}
