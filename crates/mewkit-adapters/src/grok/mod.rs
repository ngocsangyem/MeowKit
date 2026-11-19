//! Grok emitter (project scope).
//!
//! Grok content is the kit's `.claude/` tree projected for Grok, plus the Grok
//! overlay for what cannot be derived (the hook file and its scripts). Files
//! map 1:1 onto the project:
//! - skills in `.grok/skills/`, which Grok lists as `/mk-<name>`;
//! - `.grok/hooks/meowkit.json`, a hook file of the kit's own: Grok loads
//!   every `*.json` in that folder, so the user's hooks stay in their files;
//! - everything Grok does not load itself in `.grok/meowkit/` (hook scripts,
//!   helper scripts, rubrics, agent prompts);
//! - the always-on text as a marked block in the project's `AGENTS.md`.
//!
//! No subagent type is registered: the vendor page names `.grok/agents/` but
//! no file format (https://docs.x.ai/build/features/subagents), so agent
//! prompts are installed as files a skill reads, not as agent definitions.
use crate::agents_block::{self, AGENTS_MD};
use crate::contract::{
    EmitError, EmitRequest, Emitter, Op, OwnershipIndex, Plan, RelPath, Runtime, Scope, ScopeKind,
};
use crate::kit_files::rel;
use crate::projected_kit::{ProjectedKit, Spec};
use crate::{report_gate, strip};

/// Where the kit keeps what only Grok needs.
pub const SOURCE: Spec = Spec {
    runtime: "Grok",
    overlay: "kit/overlays/grok",
    target: &crate::projection::target::GROK,
};
/// The kit's hook file among the `*.json` files Grok loads from `.grok/hooks/`.
pub const HOOKS_JSON: &str = ".grok/hooks/meowkit.json";
/// The folder for kit files Grok does not load itself.
pub const KIT_DIR: &str = ".grok/meowkit";
/// Claude Code-only names that mean nothing to Grok.
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

pub struct Grok;

impl Emitter for Grok {
    fn target(&self) -> Runtime {
        Runtime::Grok
    }

    fn supports(&self, scope: ScopeKind) -> bool {
        scope == ScopeKind::Project
    }

    fn roots(&self, _scope: &Scope) -> Vec<RelPath> {
        [".grok", AGENTS_MD]
            .iter()
            .map(|r| RelPath::new(r).expect("static root"))
            .collect()
    }

    fn prepare(&self, req: &EmitRequest<'_>) -> Result<Plan, EmitError> {
        if !self.supports(req.scope.kind) {
            return Err(EmitError::Unsupported {
                runtime: "grok",
                what: "a user-level install".into(),
            });
        }
        let kit = ProjectedKit::open(&req.kit.dir, &SOURCE)?;
        let chosen = kit.select(req.packs, req.disabled)?;
        let mut plan = Plan::default();
        let mut prompts = 0;
        for f in &kit.files {
            let path = f.rel.as_str();
            if path == AGENTS_MD {
                let text = String::from_utf8(f.bytes.clone())
                    .map_err(|_| EmitError::Kit(format!("{path} is not UTF-8")))?;
                plan.ops.push(agents_block::merge(&text, AGENTS_MD)?);
                continue;
            }
            if kit.skill_of(path).is_some_and(|s| !chosen.contains(s)) {
                continue;
            }
            prompts += usize::from(path.starts_with(".grok/meowkit/agents/"));
            plan.ops.push(Op::WriteFile {
                path: rel(path)?,
                bytes: f.bytes.clone(),
                mode: f.mode,
            });
        }

        let have = kit.skills();
        for missing in chosen.iter().filter(|s| !have.contains(s.as_str())) {
            plan.notices.push(format!(
                "skill pack lists {missing}, which the kit does not ship for Grok"
            ));
        }
        // https://docs.x.ai/build/features/hooks: "Project hooks require trust before they run".
        plan.notices.push(
            "Grok runs .grok/hooks/meowkit.json only after you trust this project: /hooks-trust in Grok, or start it with --trust".into(),
        );
        plan.notices.push(format!(
            "Grok gets no agent definitions: its documentation names .grok/agents/ but no file format. The {prompts} agent prompts are in {KIT_DIR}/agents/ for a skill to read"
        ));
        plan.notices
            .extend(crate::agents_tree::also_read(req, Runtime::Grok, "Grok"));
        plan.notices
            .extend(report_gate::check(&plan, DENIED, &[".grok/"]));
        Ok(plan)
    }

    fn plan_strip(&self, scope: &Scope, owned: &OwnershipIndex) -> Result<Plan, EmitError> {
        strip::plan_from_index(&self.roots(scope), owned, |_| None)
    }
}
