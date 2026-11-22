//! Antigravity emitter (project scope).
//!
//! Antigravity reads skills from `.agents/skills` and the always-on text from
//! `AGENTS.md`, the two places Codex, Pi and OMP read too
//! (https://antigravity.google/docs/skills, https://antigravity.google/docs/rules,
//! read 2026-11-22). Its content is therefore the shared `.agents/` tree (see
//! [`crate::agents_tree`]) and the kit's block in `AGENTS.md`, plus what only
//! Antigravity loads:
//! - `.agents/rules/*.md`, the rule files that load on demand (see [`rules`]);
//!   the always-on rules stay in the `AGENTS.md` block, so the safety text has
//!   one copy;
//! - `.agents/agents/<name>.md`, each kit agent with the tools and model
//!   Antigravity takes (see `agents`);
//! - `.agents/hooks.json` and the scripts it runs in
//!   `.agents/meowkit-antigravity/hooks`: the privacy guard and the ship check,
//!   answering on stdout as the hooks page documents
//!   (https://antigravity.google/docs/hooks, read 2026-11-22).
//!
//! The guards were built from that page alone and no live run has shown them
//! deny, so the kit's coverage file marks them `unverified` and the install
//! names each one in a notice instead of presenting it as protection.
mod agents;
pub mod rules;

use crate::agents_tree;
use crate::contract::{
    EmitError, EmitRequest, Emitter, OwnershipIndex, Plan, RelPath, Runtime, Scope, ScopeKind,
};
use crate::{report_gate, strip};

const OVERLAY: &str = "kit/overlays/antigravity";
/// The folder Antigravity loads agent definitions from.
pub const AGENTS_DIR: &str = ".agents/agents";

/// The hook file Antigravity reads in a project.
pub const HOOK_FILE: &str = ".agents/hooks.json";
/// The folder of the scripts the hook file runs. It is Antigravity's alone, so
/// a Codex, Pi or OMP install beside it writes the same files as before.
pub const HOOKS_DIR: &str = ".agents/meowkit-antigravity";
/// How the notice about guards not yet seen to deny starts.
pub const UNVERIFIED: &str = "guards unverified: ";

/// What an install of Antigravity says about its guards: each one the kit's
/// coverage file marks `unverified`, with the script that runs it.
pub fn guard_notice(kit_dir: &std::path::Path) -> String {
    let listed = crate::hook_coverage::read(kit_dir)
        .map(|doc| crate::hook_coverage::unverified(&doc, Runtime::Antigravity.name()))
        .unwrap_or_default();
    let which = if listed.is_empty() {
        format!("the privacy guard and the ship check in {HOOK_FILE}")
    } else {
        crate::hook_coverage::describe(&listed)
    };
    format!(
        "{UNVERIFIED}{which}: installed from Antigravity's documentation, and no live run has shown them deny, so do not count on them to refuse a credential read or a failing commit yet"
    )
}

/// Claude Code-only names that mean nothing to Antigravity.
pub const DENIED: &[&str] = &[
    "CLAUDE_PROJECT_DIR",
    "CLAUDE_SKILL_DIR",
    "AskUserQuestion",
    "TaskCreate",
    "TaskUpdate",
    "TaskGet",
    "TaskList",
    "TodoWrite",
];

pub struct Antigravity;

impl Emitter for Antigravity {
    fn target(&self) -> Runtime {
        Runtime::Antigravity
    }

    fn supports(&self, scope: ScopeKind) -> bool {
        scope == ScopeKind::Project
    }

    fn roots(&self, _scope: &Scope) -> Vec<RelPath> {
        agents_tree::ROOTS
            .iter()
            .chain([rules::DIR, AGENTS_DIR, HOOK_FILE, HOOKS_DIR].iter())
            .map(|r| RelPath::new(r).expect("static root"))
            .collect()
    }

    fn prepare(&self, req: &EmitRequest<'_>) -> Result<Plan, EmitError> {
        if !self.supports(req.scope.kind) {
            return Err(EmitError::Unsupported {
                runtime: "antigravity",
                what: "a user-level install".into(),
            });
        }
        let spec = agents_tree::spec(Runtime::Antigravity, req.placement);
        let mut plan = agents_tree::plan(req, spec)?;
        plan.ops.extend(agents_tree::overlay_files(req, OVERLAY)?);
        rules::check_plan(&plan)?;
        let (ops, dropped) = agents::definitions(&req.kit.dir, &plan)?;
        plan.ops.extend(ops);
        if !dropped.is_empty() {
            plan.notices.push(format!(
                "Antigravity has no tool for {}: left out of the agents' tool lists",
                dropped.join(", ")
            ));
        }
        plan.notices.push(guard_notice(&req.kit.dir));
        plan.notices.extend(agents_tree::also_read(
            req,
            Runtime::Antigravity,
            "Antigravity",
        ));
        plan.notices
            .extend(report_gate::check(&plan, DENIED, &[".agents/"]));
        Ok(plan)
    }

    fn plan_strip(&self, scope: &Scope, owned: &OwnershipIndex) -> Result<Plan, EmitError> {
        strip::plan_from_index(&self.roots(scope), owned, |_| None)
    }
}
