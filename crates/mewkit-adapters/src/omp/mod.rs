//! OMP emitter (project scope).
//!
//! OMP reads skills from `.agents/skills`, which Codex and Pi read too, so
//! its content is the shared `.agents/` tree (see [`crate::agents_tree`]) and
//! the always-on block in `AGENTS.md`, plus what only OMP loads:
//! - `.omp/hooks/pre/meowkit.ts`, the hook module that runs the kit's guards;
//! - `.omp/agents/<name>.md`, each agent with the built-in tools OMP knows;
//! - `.omp/config.yml`, only where OMP would otherwise load a second copy of
//!   the skills from another runtime's folder.
mod agents;

use crate::agents_tree;
use crate::contract::{
    EmitError, EmitRequest, Emitter, Op, OwnershipIndex, Plan, RelPath, Runtime, Scope, ScopeKind,
};
use crate::kit_files::rel;
use crate::surface_table::Kind;
use crate::{report_gate, strip};

const OVERLAY: &str = "kit/overlays/omp";
/// The hook module that runs the guards.
pub const HOOK: &str = ".omp/hooks/pre/meowkit.ts";
/// OMP's project settings.
pub const CONFIG: &str = ".omp/config.yml";
/// Claude Code-only names that mean nothing to OMP.
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

pub struct Omp;

impl Emitter for Omp {
    fn target(&self) -> Runtime {
        Runtime::Omp
    }

    fn supports(&self, scope: ScopeKind) -> bool {
        scope == ScopeKind::Project
    }

    fn roots(&self, _scope: &Scope) -> Vec<RelPath> {
        agents_tree::ROOTS
            .iter()
            .chain([".omp"].iter())
            .map(|r| RelPath::new(r).expect("static root"))
            .collect()
    }

    fn prepare(&self, req: &EmitRequest<'_>) -> Result<Plan, EmitError> {
        if !self.supports(req.scope.kind) {
            return Err(EmitError::Unsupported {
                runtime: "omp",
                what: "a user-level install".into(),
            });
        }
        let spec = agents_tree::spec(Runtime::Omp, req.placement);
        let mut plan = agents_tree::plan(req, spec)?;
        plan.ops.extend(agents_tree::overlay_files(req, OVERLAY)?);
        let (ops, dropped) = agents::definitions(&req.kit.dir, &plan)?;
        plan.ops.extend(ops);
        if !dropped.is_empty() {
            plan.notices.push(format!(
                "OMP has no built-in tool for {}: left out of the agents' tool lists",
                dropped.join(", ")
            ));
        }
        if let Some((op, notice)) = switch_off_imports(req)? {
            plan.ops.push(op);
            plan.notices.push(notice);
        }
        plan.notices.push(
            "OMP has no project trust step: .omp/hooks/pre/meowkit.ts runs from the first session here".into(),
        );
        plan.notices
            .extend(agents_tree::also_read(req, Runtime::Omp, "OMP"));
        plan.notices
            .extend(report_gate::check(&plan, DENIED, &[".agents/", ".omp/"]));
        Ok(plan)
    }

    fn plan_strip(&self, scope: &Scope, owned: &OwnershipIndex) -> Result<Plan, EmitError> {
        strip::plan_from_index(&self.roots(scope), owned, |_| None)
    }
}

/// `.omp/config.yml` turning off the providers whose folders would give OMP a
/// second, differently worded copy of the skills, for the set installed here.
/// The switch is per provider, so it turns off everything OMP imports from
/// that runtime's folders, not skills alone.
fn switch_off_imports(req: &EmitRequest<'_>) -> Result<Option<(Op, String)>, EmitError> {
    let switches = req
        .placement
        .and_then(|p| p.view(Runtime::Omp, Kind::Skills))
        .map(|v| v.switches.as_slice())
        .unwrap_or_default();
    // A switch reads "`.omp/config.yml` `disabledProviders: [claude]`".
    let mut providers: Vec<&str> = switches
        .iter()
        .filter_map(|s| s.split_once("disabledProviders: [")?.1.split(']').next())
        .flat_map(|list| list.split(','))
        .map(str::trim)
        .filter(|p| !p.is_empty())
        .collect();
    providers.sort_unstable();
    providers.dedup();
    if providers.is_empty() {
        return Ok(None);
    }
    let list = providers.join(", ");
    let op = Op::WriteFile {
        path: rel(CONFIG)?,
        bytes: format!("disabledProviders: [{list}]\n").into_bytes(),
        mode: None,
    };
    let notice = format!(
        "{CONFIG} sets disabledProviders: [{list}], so OMP lists each skill once; this turns off everything OMP imports from those runtimes' folders. If you keep a {CONFIG} of your own, add the line to it"
    );
    Ok(Some((op, notice)))
}
