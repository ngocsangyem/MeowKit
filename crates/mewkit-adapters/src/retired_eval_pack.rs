//! Cleanup of the retired eval pack.
//!
//! Earlier kits could copy their eval cases into a project's `.meowkit/eval/`
//! and record each file in the ownership index. Eval cases now live only in
//! the kit's source repository, and no kit or install writes that folder. A
//! project that still has those files loses them the way any retired kit file
//! goes: every emitter is wrapped in [`WithRetiredEvalPack`], whose roots cover
//! the folder, so `upgrade` queues the recorded paths no plan writes any more
//! and `uninstall` strips them. Each removal still needs the bytes on disk to
//! match the record; an edited file is kept.
//!
//! The path is fixed here rather than read from a manifest, so nothing can
//! point these removals at another folder.
use std::collections::BTreeMap;

use crate::contract::{
    EmitError, EmitRequest, Emitter, Op, OwnershipIndex, Plan, RelPath, Runtime, Scope, ScopeKind,
};
use crate::kit_files::rel;

/// Where the retired pack was installed, relative to the project root.
pub const INSTALL_DIR: &str = ".meowkit/eval";

/// The hashes `index` recorded for files of the retired pack, by path.
///
/// No kit plans these files any more, so no kit hash can corroborate their
/// removal; the record of what the install wrote does instead, which still
/// keeps every file whose bytes changed since.
pub fn recorded_hashes(index: &OwnershipIndex) -> BTreeMap<String, String> {
    let prefix = format!("{INSTALL_DIR}/");
    index
        .paths
        .iter()
        .filter(|(path, _)| path.starts_with(&prefix))
        .map(|(path, hash)| (path.clone(), hash.clone()))
        .collect()
}

fn install_root() -> RelPath {
    RelPath::new(INSTALL_DIR).expect("static root")
}

fn covered(roots: &[RelPath], path: &RelPath) -> bool {
    roots.iter().any(|r| path.is_within(r))
}

/// A runtime's emitter that also removes what the retired eval pack left.
pub struct WithRetiredEvalPack<E>(pub E);

impl<E: Emitter> Emitter for WithRetiredEvalPack<E> {
    fn target(&self) -> Runtime {
        self.0.target()
    }

    fn supports(&self, scope: ScopeKind) -> bool {
        self.0.supports(scope)
    }

    fn roots(&self, scope: &Scope) -> Vec<RelPath> {
        let mut roots = self.0.roots(scope);
        let root = install_root();
        if scope.kind == ScopeKind::Project && !covered(&roots, &root) {
            roots.push(root);
        }
        roots
    }

    fn prepare(&self, req: &EmitRequest<'_>) -> Result<Plan, EmitError> {
        self.0.prepare(req)
    }

    fn plan_strip(&self, scope: &Scope, owned: &OwnershipIndex) -> Result<Plan, EmitError> {
        let mut plan = self.0.plan_strip(scope, owned)?;
        if scope.kind != ScopeKind::Project {
            return Ok(plan);
        }
        let inner = self.0.roots(scope);
        let root = install_root();
        for path in owned.paths.keys() {
            let path = rel(path)?;
            if path.is_within(&root) && !covered(&inner, &path) {
                plan.ops.push(Op::RemoveFile { path });
            }
        }
        Ok(plan)
    }
}
