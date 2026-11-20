//! Pi emitter (project scope).
//!
//! Pi reads skills from `.agents/skills`, which Codex and OMP read too, so
//! its content is the shared `.agents/` tree (see [`crate::agents_tree`]) and
//! the always-on block in `AGENTS.md`, plus one file of its own: the
//! extension in `.pi/extensions/` that runs the kit's guards before a tool
//! call. Pi has no hook file and no subagents, so nothing else is written.
use crate::agents_tree;
use crate::contract::{
    EmitError, EmitRequest, Emitter, OwnershipIndex, Plan, RelPath, Runtime, Scope, ScopeKind,
};
use crate::{report_gate, strip};

const OVERLAY: &str = "kit/overlays/pi";
/// The extension that runs the guards.
pub const EXTENSION: &str = ".pi/extensions/meowkit.ts";
/// Claude Code-only names that mean nothing to Pi.
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

pub struct Pi;

impl Emitter for Pi {
    fn target(&self) -> Runtime {
        Runtime::Pi
    }

    fn supports(&self, scope: ScopeKind) -> bool {
        scope == ScopeKind::Project
    }

    fn roots(&self, _scope: &Scope) -> Vec<RelPath> {
        agents_tree::ROOTS
            .iter()
            .chain([".pi"].iter())
            .map(|r| RelPath::new(r).expect("static root"))
            .collect()
    }

    fn prepare(&self, req: &EmitRequest<'_>) -> Result<Plan, EmitError> {
        if !self.supports(req.scope.kind) {
            return Err(EmitError::Unsupported {
                runtime: "pi",
                what: "a user-level install".into(),
            });
        }
        let spec = agents_tree::spec(Runtime::Pi, req.placement);
        let mut plan = agents_tree::plan(req, spec)?;
        plan.ops.extend(agents_tree::overlay_files(req, OVERLAY)?);
        // https://raw.githubusercontent.com/badlogic/pi-mono/main/packages/coding-agent/docs/security.md
        plan.notices.push(
            "Pi loads .pi/extensions and the project's .agents/skills only after you trust this project: answer its prompt, or /trust in Pi".into(),
        );
        plan.notices.push(
            "Pi has no subagents, so no agent is installed for it: a skill that hands work to an agent runs that work in the main session".into(),
        );
        plan.notices
            .extend(agents_tree::also_read(req, Runtime::Pi, "Pi"));
        plan.notices
            .extend(report_gate::check(&plan, DENIED, &[".agents/", ".pi/"]));
        Ok(plan)
    }

    fn plan_strip(&self, scope: &Scope, owned: &OwnershipIndex) -> Result<Plan, EmitError> {
        strip::plan_from_index(&self.roots(scope), owned, |_| None)
    }
}
