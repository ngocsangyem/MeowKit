//! Codex emitter.
//!
//! Codex content is the kit's `.claude/` tree projected for Codex, plus the
//! Codex overlay for what cannot be derived (hooks, command policy, the
//! always-on text). Files map 1:1 onto the project, with three exceptions the
//! user may own as well: `AGENTS.md` gets a marked block, `.codex/hooks.json`
//! gets hook handlers and `.codex/config.toml` gets keys, each recorded so
//! uninstall takes out only what the kit added. Global scope: see [`global`].
mod global;
mod rewrite;
mod shared;

use std::collections::{BTreeMap, BTreeSet};

use crate::contract::{
    EmitError, EmitRequest, Emitter, Op, OwnershipIndex, Plan, RelPath, Runtime, Scope, ScopeKind,
};
use crate::kit_files::rel;
use crate::projected_kit::{ProjectedKit, Spec};
use crate::{report_gate, scope, strip};

/// Where the kit keeps what only Codex needs.
pub const SOURCE: Spec = Spec {
    runtime: "Codex",
    overlay: "kit/overlays/codex",
    target: &crate::projection::target::CODEX,
};
pub use shared::{AGENTS_MD, AGENTS_MD_BUDGET, BLOCK_ID, CONFIG_TOML, HOOKS_JSON};

/// Claude Code-only names that mean nothing to Codex.
pub const DENIED: &[&str] = &[
    ".claude/",
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
const INSTALLED_PREFIXES: &[&str] = &[".agents/skills/", ".codex/"];

pub struct Codex;

impl Emitter for Codex {
    fn target(&self) -> Runtime {
        Runtime::Codex
    }

    fn roots(&self, scope: &Scope) -> Vec<RelPath> {
        match scope.kind {
            ScopeKind::Project => [".agents/skills", ".codex", AGENTS_MD]
                .iter()
                .map(|r| RelPath::new(r).expect("static root"))
                .collect(),
            ScopeKind::Global => [".agents/skills", ".codex"]
                .iter()
                .map(|r| RelPath::new(r).expect("static root"))
                .collect(),
        }
    }

    fn prepare(&self, req: &EmitRequest<'_>) -> Result<Plan, EmitError> {
        let global = (req.scope.kind == ScopeKind::Global).then_some(req.scope);
        let agents_md = if global.is_some() {
            global::AGENTS_MD
        } else {
            AGENTS_MD
        };
        let kit = ProjectedKit::open(&req.kit.dir, &SOURCE)?;
        let chosen = kit.select(req.packs, req.disabled)?;
        // Projection anchors a skill's helper commands at the project root,
        // where a global install has no skills: those take the absolute path.
        let absolute = |path: &str, quoted: bool| {
            let path = RelPath::new(path).expect("kit path");
            global::quote_in(&req.scope.resolve(&path), cfg!(windows), quoted)
        };
        let mut skill_files: BTreeMap<&str, BTreeSet<String>> = BTreeMap::new();
        if global.is_some() {
            for f in &kit.files {
                if let Some(s) = kit.skill_of(&f.rel) {
                    skill_files.entry(s).or_default().insert(f.rel.clone());
                }
            }
        }

        let mut ops = Vec::new();
        for f in &kit.files {
            let text = || {
                String::from_utf8(f.bytes.clone())
                    .map_err(|_| EmitError::Kit(format!("{} is not UTF-8", f.rel)))
            };
            match f.rel.as_str() {
                AGENTS_MD => ops.push(shared::agents_md(&text()?, agents_md)?),
                HOOKS_JSON => ops.extend(shared::hooks_json(&text()?, global)?),
                // Project settings (`project_doc_max_bytes`); a global install leaves the user's config alone.
                CONFIG_TOML if global.is_some() => {}
                CONFIG_TOML => ops.push(shared::config_toml(&text()?)?),
                path => {
                    let skill = kit.skill_of(path);
                    if skill.is_some_and(|s| !chosen.contains(s)) {
                        continue;
                    }
                    let mut bytes = f.bytes.clone();
                    if let Some(files) = skill.and_then(|s| skill_files.get(s))
                        && let Ok(text) = std::str::from_utf8(&bytes)
                        && let Some(anchored) = rewrite::root_anchor(text, files, &absolute)
                    {
                        bytes = anchored.into_bytes();
                    }
                    ops.push(Op::WriteFile {
                        path: rel(path)?,
                        bytes,
                        mode: f.mode,
                    });
                }
            }
        }

        let mut plan = Plan {
            ops,
            ..Plan::default()
        };
        let have = kit.skills();
        for missing in chosen.iter().filter(|s| !have.contains(s.as_str())) {
            plan.notices.push(format!(
                "skill pack lists {missing}, which the kit does not ship for Codex"
            ));
        }
        if global.is_none() {
            plan.notices.push(
                "Codex reads .codex/hooks.json and .codex/config.toml only after you trust this project".into(),
            );
        }
        plan.notices
            .extend(scope::privacy_elsewhere(req, HOOKS_JSON));
        plan.notices
            .extend(report_gate::check(&plan, DENIED, INSTALLED_PREFIXES));
        Ok(plan)
    }

    fn plan_strip(&self, scope: &Scope, owned: &OwnershipIndex) -> Result<Plan, EmitError> {
        strip::plan_from_index(&self.roots(scope), owned, |f| {
            (f == HOOKS_JSON).then_some(mewkit_core::plan::HookLayout::Grouped)
        })
    }
}
