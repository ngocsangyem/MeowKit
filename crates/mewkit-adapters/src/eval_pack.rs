//! The eval pack: the kit's eval cases, installed only when asked for.
//!
//! A release carries the cases under `kit/packs/eval/` (laid out as
//! `<skill>/eval/...`, the layout `mewkit eval` loads) and an install that
//! selects the pack copies them to `.meowkit/eval/`. That folder is outside
//! every runtime's skills root, so no runtime ever lists a case as a skill and
//! no emitter projects one. The paths are fixed here rather than read from the
//! pack manifest, so a manifest can never point these writes into a skills
//! folder.
//!
//! The pack is selected by naming [`PACK`] among the packs of an install. Every
//! emitter is wrapped in [`WithEvalPack`], which takes the name out before the
//! runtime's own pack logic sees it and adds the copy to the plan.
use std::path::Path;

use crate::contract::{
    EmitError, EmitRequest, Emitter, Op, OwnershipIndex, Plan, RelPath, Runtime, Scope, ScopeKind,
};
use crate::kit_files::{self, rel};

/// The pack name an install selects.
pub const PACK: &str = "eval";
/// Where a release carries the cases.
pub const KIT_DIR: &str = "kit/packs/eval";
/// Where an install puts them, relative to the project root.
pub const INSTALL_DIR: &str = ".meowkit/eval";

/// `packs` without [`PACK`], and whether it was named.
pub fn split(packs: &[String]) -> (Vec<String>, bool) {
    let rest: Vec<String> = packs.iter().filter(|p| *p != PACK).cloned().collect();
    let named = rest.len() != packs.len();
    (rest, named)
}

/// Whether `index` records a file of the pack. An install that has the pack
/// keeps it on `upgrade` and `init` without naming it again, and `uninstall`
/// plans it so its files can be confirmed as the kit's and removed.
pub fn installed(index: Option<&OwnershipIndex>) -> bool {
    let prefix = format!("{INSTALL_DIR}/");
    index.is_some_and(|i| i.paths.keys().any(|p| p.starts_with(&prefix)))
}

/// `packs` with [`PACK`] added when `index` shows the pack installed.
pub fn keep_installed(packs: &[String], index: Option<&OwnershipIndex>) -> Vec<String> {
    let mut out = packs.to_vec();
    if installed(index) && !out.iter().any(|p| p == PACK) {
        out.push(PACK.to_owned());
    }
    out
}

/// The writes that install the pack from `kit_dir`, or `None` when the kit
/// does not carry it (a release from before the pack existed).
pub fn ops(kit_dir: &Path) -> Result<Option<Vec<Op>>, EmitError> {
    let src = kit_dir.join(KIT_DIR);
    if !src.is_dir() {
        return Ok(None);
    }
    let mut ops = Vec::new();
    for f in kit_files::walk(&src)? {
        ops.push(Op::WriteFile {
            path: rel(&format!("{INSTALL_DIR}/{}", f.rel))?,
            bytes: kit_files::read(&f.abs)?,
            mode: kit_files::mode(&f.abs),
        });
    }
    Ok(Some(ops))
}

fn install_root() -> RelPath {
    RelPath::new(INSTALL_DIR).expect("static root")
}

fn covered(roots: &[RelPath], path: &RelPath) -> bool {
    roots.iter().any(|r| path.is_within(r))
}

/// A runtime's emitter that also installs the eval pack when it is selected.
pub struct WithEvalPack<E>(pub E);

impl<E: Emitter> Emitter for WithEvalPack<E> {
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
        let (packs, selected) = split(req.packs);
        let mut plan = self.0.prepare(&EmitRequest {
            kit: req.kit,
            scope: req.scope,
            packs: &packs,
            disabled: req.disabled,
            fresh: req.fresh,
            other_scope: req.other_scope,
            placement: req.placement,
        })?;
        if !selected {
            return Ok(plan);
        }
        if req.scope.kind != ScopeKind::Project {
            plan.notices
                .push("the eval pack installs into a project only; left out".into());
            return Ok(plan);
        }
        match ops(&req.kit.dir)? {
            Some(ops) => plan.ops.extend(ops),
            None => plan.notices.push(format!(
                "kit {} does not carry the eval pack; nothing written to {INSTALL_DIR}",
                req.kit.version
            )),
        }
        Ok(plan)
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
