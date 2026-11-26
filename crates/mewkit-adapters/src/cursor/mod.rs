//! Cursor emitter.
//!
//! Cursor content is the kit's `.claude/` tree projected for Cursor, plus the
//! Cursor overlay for what cannot be derived (hooks, rules, the always-on
//! text). Files map 1:1 onto `.cursor/`, except:
//! - the always-on text every runtime shares is a marked block in the
//!   project's `AGENTS.md`, which Cursor reads; `.cursor/rules/` holds only
//!   what that block does not say;
//! - `.cursor/hooks.json` is merged handler by handler, every blocking
//!   handler with `failClosed: true`;
//! - agents keep only the frontmatter keys Cursor documents;
//! - every rule must carry frontmatter that yields exactly one rule type.
//!
//! A global install writes `~/.cursor/` the same way, minus what Cursor has
//! no user-level file for (rules, the shared block), and registers only the
//! privacy read gate and the session context.
pub(crate) mod frontmatter;
mod hooks;

use crate::agents_block::{self, AGENTS_MD};
use crate::contract::{
    EmitError, EmitRequest, Emitter, Op, OwnershipIndex, Plan, RelPath, Runtime, Scope, ScopeKind,
};
use crate::kit_files::rel;
use crate::projected_kit::{ProjectedKit, Spec};
use crate::{report_gate, scope, strip};
use mewkit_core::plan::HookLayout;

pub use hooks::{BLOCKING, HOOKS_JSON};

/// Where the kit keeps what only Cursor needs.
pub const SOURCE: Spec = Spec {
    runtime: "Cursor",
    overlay: "kit/overlays/cursor",
    target: &crate::projection::target::CURSOR,
};
/// Subagent frontmatter keys Cursor documents.
pub const AGENT_KEYS: &[&str] = &["name", "description", "model", "readonly", "is_background"];
/// Claude Code-only names that mean nothing to Cursor.
pub const DENIED: &[&str] = &[
    "CLAUDE.md",
    "CLAUDE_PROJECT_DIR",
    "CLAUDE_SKILL_DIR",
    "AskUserQuestion",
    "TaskCreate",
    "TaskUpdate",
    "TaskGet",
    "TaskList",
    "TodoWrite",
];

pub struct Cursor;

impl Emitter for Cursor {
    fn target(&self) -> Runtime {
        Runtime::Cursor
    }

    fn roots(&self, scope: &Scope) -> Vec<RelPath> {
        // `.meowkit` held the bundle's README in earlier installs; it stays a
        // root so an upgrade can remove that file from the ownership index.
        let roots: &[&str] = match scope.kind {
            ScopeKind::Project => &[".cursor", ".meowkit", AGENTS_MD],
            ScopeKind::Global => &[".cursor"],
        };
        roots
            .iter()
            .map(|r| RelPath::new(r).expect("static root"))
            .collect()
    }

    fn prepare(&self, req: &EmitRequest<'_>) -> Result<Plan, EmitError> {
        let global = req.scope.kind == ScopeKind::Global;
        let mut rules_left_out = 0;
        let kit = ProjectedKit::open(&req.kit.dir, &SOURCE)?;
        let chosen = kit.select(req.packs, req.disabled)?;
        let mut plan = Plan::default();
        for f in &kit.files {
            let path = f.rel.as_str();
            let text = || {
                String::from_utf8(f.bytes.clone())
                    .map_err(|_| EmitError::Kit(format!("{path} is not UTF-8")))
            };
            let (path, bytes) = match path {
                AGENTS_MD if global => continue,
                p if global && p.starts_with(".cursor/rules/") => {
                    rules_left_out += 1;
                    continue;
                }
                AGENTS_MD => {
                    plan.ops.push(agents_block::merge(&text()?, AGENTS_MD)?);
                    continue;
                }
                HOOKS_JSON => {
                    plan.ops.extend(hooks::ops(&text()?, global)?);
                    continue;
                }
                p if p.starts_with(".cursor/agents/") && p.ends_with(".md") => {
                    let (text, dropped) = frontmatter::keep_keys(&text()?, AGENT_KEYS);
                    for key in dropped {
                        plan.notices.push(format!(
                            "{p}: frontmatter `{key}` is not a Cursor agent field; left out"
                        ));
                    }
                    (p, text)
                }
                p if kit.skill_of(p).is_some_and(|s| !chosen.contains(s)) => continue,
                p => {
                    plan.ops.push(Op::WriteFile {
                        path: rel(p)?,
                        bytes: f.bytes.clone(),
                        mode: f.mode,
                    });
                    continue;
                }
            };
            plan.ops.push(Op::WriteFile {
                path: rel(path)?,
                bytes: bytes.into_bytes(),
                mode: None,
            });
        }
        check_rules(&plan)?;

        let have = kit.skills();
        for missing in chosen.iter().filter(|s| !have.contains(s.as_str())) {
            plan.notices.push(format!(
                "skill pack lists {missing}, which the kit does not ship for Cursor"
            ));
        }
        if !global {
            // https://cursor.com/docs/agent/hooks: "Project hooks run in any trusted workspace".
            plan.notices.push(
                "Cursor runs .cursor/hooks.json only in a workspace you have trusted in Cursor"
                    .into(),
            );
        }
        if global {
            plan.notices.push(format!(
                "Cursor reads no rules from ~/.cursor: the AGENTS.md block and {rules_left_out} rules apply only where MeowKit is installed in the project"
            ));
        }
        if req.scope.resolve(&rel(".claude/skills")?).is_dir() {
            plan.notices
                .push("Cursor also reads .claude/skills here: skills may be listed twice".into());
        }
        plan.notices
            .extend(scope::privacy_elsewhere(req, HOOKS_JSON));
        plan.notices
            .extend(report_gate::check(&plan, DENIED, &[".cursor/"]));
        Ok(plan)
    }

    fn plan_strip(&self, scope: &Scope, owned: &OwnershipIndex) -> Result<Plan, EmitError> {
        strip::plan_from_index(&self.roots(scope), owned, |f| {
            (f == HOOKS_JSON).then_some(HookLayout::Flat)
        })
    }
}

/// Every `.mdc` the plan writes yields exactly one rule type.
fn check_rules(plan: &Plan) -> Result<(), EmitError> {
    for op in &plan.ops {
        if let Op::WriteFile { path, bytes, .. } = op
            && path.as_str().starts_with(".cursor/rules/")
            && path.as_str().ends_with(".mdc")
        {
            let text = std::str::from_utf8(bytes)
                .map_err(|_| EmitError::Kit(format!("Cursor rule {path} is not UTF-8")))?;
            frontmatter::rule_type(path.as_str(), text)?;
        }
    }
    Ok(())
}
