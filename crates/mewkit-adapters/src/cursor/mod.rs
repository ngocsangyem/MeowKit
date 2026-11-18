//! Cursor emitter.
//!
//! Cursor content is the kit's `.claude/` tree projected for Cursor, plus the
//! Cursor overlay for what cannot be derived (hooks, rules, the always-on
//! text). Files map 1:1 onto `.cursor/`, except:
//! - the overlay's `AGENTS.md` becomes the always-applied rule
//!   `.cursor/rules/meowkit-core.mdc`: the project's `AGENTS.md` is left to
//!   the user and to the Codex install;
//! - `.cursor/hooks.json` is merged handler by handler, every blocking
//!   handler with `failClosed: true`;
//! - agents keep only the frontmatter keys Cursor documents;
//! - every rule must carry frontmatter that yields exactly one rule type.
//!
//! A global install writes `~/.cursor/` the same way, minus what Cursor has
//! no user-level file for (rules, the core rule), and registers only the
//! privacy read gate and the session context.
pub(crate) mod frontmatter;
mod hooks;

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
/// Where the overlay's `AGENTS.md` guidance is installed.
pub const CORE_RULE: &str = ".cursor/rules/meowkit-core.mdc";
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
        // `.meowkit` holds the bundle's README, which a project install keeps.
        let roots: &[&str] = match scope.kind {
            ScopeKind::Project => &[".cursor", ".meowkit"],
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
                "AGENTS.md" | CORE_RULE if global => continue,
                p if global && p.starts_with(".cursor/rules/") => {
                    rules_left_out += 1;
                    continue;
                }
                "AGENTS.md" => (CORE_RULE, core_rule(&text()?)),
                HOOKS_JSON => {
                    plan.ops.extend(hooks::ops(&text()?, global)?);
                    continue;
                }
                CORE_RULE => {
                    return Err(EmitError::Kit(format!(
                        "the Cursor overlay ships {CORE_RULE}, which its AGENTS.md is installed as"
                    )));
                }
                // The project README is the only `.meowkit/` file the overlay
                // ships; a global install has no `.meowkit` to put it in.
                p if global && p.starts_with(".meowkit/") => continue,
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
        if global {
            plan.notices.push(format!(
                "Cursor reads no rules from ~/.cursor: the core rule and {rules_left_out} other rules apply only where MeowKit is installed in the project"
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

/// The overlay's `AGENTS.md` as a rule Cursor applies in every session.
fn core_rule(agents_md: &str) -> String {
    format!("---\nalwaysApply: true\n---\n\n{}\n", agents_md.trim_end())
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
