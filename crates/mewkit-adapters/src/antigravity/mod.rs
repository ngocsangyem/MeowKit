//! Antigravity emitter (project scope).
//!
//! Antigravity reads skills from `.agents/skills` and the always-on text from
//! `AGENTS.md`, the two places Codex, Pi and OMP read too
//! (https://antigravity.google/docs/skills, https://antigravity.google/docs/rules,
//! read 2026-11-22). Its content is therefore the shared `.agents/` tree (see
//! [`crate::agents_tree`]) and the kit's block in `AGENTS.md`.
//!
//! No hook is installed: the runtime reads `.agents/hooks.json`, but a guard
//! written from its documentation alone has not been seen to deny, so the
//! emitter says "guards not installed" instead of shipping one that may never
//! fire. The shared tree carries the guard script, which nothing runs here.
use crate::agents_tree;
use crate::contract::{
    EmitError, EmitRequest, Emitter, OwnershipIndex, Plan, RelPath, Runtime, Scope, ScopeKind,
};
use crate::{report_gate, strip};

/// What an install of Antigravity says about its guards.
pub const NO_GUARDS: &str = "guards not installed: Antigravity runs no privacy guard and no ship check from this kit, so nothing here refuses a read of a credential file or a failing commit";

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
        plan.notices.push(NO_GUARDS.into());
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
