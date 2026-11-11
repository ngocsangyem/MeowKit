//! Cursor emitter, project scope.
//!
//! Cursor content comes from the authored bundle the kit carries (maintainer
//! decision 2026-11-11: the bundle is the Cursor overlay, as for Codex).
//! Files map 1:1 onto `.cursor/`, except:
//! - the bundle's `AGENTS.md` becomes the always-applied rule
//!   `.cursor/rules/meowkit-core.mdc`: the project's `AGENTS.md` is left to
//!   the user and to the Codex install;
//! - `.cursor/hooks.json` is merged handler by handler, every blocking
//!   handler with `failClosed: true`;
//! - agents keep only the frontmatter keys Cursor documents;
//! - every rule must carry frontmatter that yields exactly one rule type.
mod frontmatter;
mod hooks;

use crate::bundle::{Bundle, Spec};
use crate::contract::{
    EmitError, EmitRequest, Emitter, Op, OwnershipIndex, Plan, RelPath, Runtime, Scope, ScopeKind,
};
use crate::kit_files::{self, rel};
use crate::{report_gate, strip};
use mewkit_core::plan::HookLayout;

pub use hooks::{BLOCKING, HOOKS_JSON};

/// The authored Cursor bundle in the kit.
pub const BUNDLE: Spec = Spec {
    runtime: "Cursor",
    dir: "packages/mewkit/src/migrate/modules/cursor",
    skills: ".cursor/skills/",
};
/// Where the bundle's `AGENTS.md` guidance is installed.
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
        match scope.kind {
            ScopeKind::Project => vec![RelPath::new(".cursor").expect("static root")],
            ScopeKind::Global => vec![],
        }
    }

    fn prepare(&self, req: &EmitRequest<'_>) -> Result<Plan, EmitError> {
        if req.scope.kind == ScopeKind::Global {
            return Err(EmitError::Unsupported {
                runtime: "cursor",
                what: "global scope yet".into(),
            });
        }
        let bundle = Bundle::open(&req.kit.dir, &BUNDLE)?;
        let chosen = bundle.select(req.packs, req.disabled)?;
        let mut plan = Plan::default();
        for f in &bundle.files {
            let path = f.rel.as_str();
            let (path, bytes) = match path {
                "AGENTS.md" => (CORE_RULE, core_rule(&kit_files::read_text(&f.abs)?)),
                HOOKS_JSON => {
                    plan.ops.extend(hooks::ops(&kit_files::read_text(&f.abs)?)?);
                    continue;
                }
                CORE_RULE => {
                    return Err(EmitError::Kit(format!(
                        "the Cursor bundle ships {CORE_RULE}, which its AGENTS.md is installed as"
                    )));
                }
                // The npm CLI's own state notes; mewkit-next keeps state elsewhere.
                p if p.starts_with(".meowkit/") => continue,
                p if p.starts_with(".cursor/agents/") && p.ends_with(".md") => {
                    let (text, dropped) =
                        frontmatter::keep_keys(&kit_files::read_text(&f.abs)?, AGENT_KEYS);
                    for key in dropped {
                        plan.notices.push(format!(
                            "{p}: frontmatter `{key}` is not a Cursor agent field; left out"
                        ));
                    }
                    (p, text)
                }
                p if bundle.skill_of(p).is_some_and(|s| !chosen.contains(s)) => continue,
                p => {
                    plan.ops.push(Op::WriteFile {
                        path: rel(p)?,
                        bytes: kit_files::read(&f.abs)?,
                        mode: kit_files::mode(&f.abs),
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

        let have = bundle.skills();
        for missing in chosen.iter().filter(|s| !have.contains(s.as_str())) {
            plan.notices.push(format!(
                "skill pack lists {missing}, which the Cursor bundle does not ship"
            ));
        }
        if req.scope.root.join(".claude/skills").is_dir() {
            plan.notices.push(
                "this project also has .claude/skills, which Cursor reads too: skills may be listed twice".into(),
            );
        }
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

/// The bundle's `AGENTS.md` as a rule Cursor applies in every session.
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
