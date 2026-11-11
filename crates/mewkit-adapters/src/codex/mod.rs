//! Codex emitter, project scope.
//!
//! Codex content comes from the authored bundle the kit carries (maintainer
//! decision 2026-11-11: the bundle is the Codex overlay; nothing is projected
//! from `.claude/`). Files map 1:1 onto the project, with three exceptions the
//! user may own as well: `AGENTS.md` gets a marked block, `.codex/hooks.json`
//! gets hook handlers and `.codex/config.toml` gets keys, each recorded so
//! uninstall takes out only what the kit added.
mod rewrite;
mod shared;

use std::collections::{BTreeMap, BTreeSet};

use crate::bundle::{Bundle, Spec};
use crate::contract::{
    EmitError, EmitRequest, Emitter, Op, OwnershipIndex, Plan, RelPath, Runtime, Scope, ScopeKind,
};
use crate::kit_files::{self, rel};
use crate::{report_gate, strip};

/// The authored Codex bundle in the kit.
pub const BUNDLE: Spec = Spec {
    runtime: "Codex",
    dir: "packages/mewkit/src/migrate/modules/codex",
    skills: ".agents/skills/",
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
            ScopeKind::Global => vec![],
        }
    }

    fn prepare(&self, req: &EmitRequest<'_>) -> Result<Plan, EmitError> {
        if req.scope.kind == ScopeKind::Global {
            return Err(EmitError::Unsupported {
                runtime: "codex",
                what: "global scope yet".into(),
            });
        }
        let bundle = Bundle::open(&req.kit.dir, &BUNDLE)?;
        let chosen = bundle.select(req.packs, req.disabled)?;
        let mut skill_files: BTreeMap<&str, BTreeSet<String>> = BTreeMap::new();
        for f in &bundle.files {
            if let Some(s) = bundle.skill_of(&f.rel) {
                let inner = &f.rel[".agents/skills/".len() + s.len() + 1..];
                skill_files.entry(s).or_default().insert(inner.to_owned());
            }
        }

        let mut ops = Vec::new();
        for f in &bundle.files {
            match f.rel.as_str() {
                AGENTS_MD => ops.push(shared::agents_md(&kit_files::read_text(&f.abs)?)?),
                HOOKS_JSON => ops.extend(shared::hooks_json(&kit_files::read_text(&f.abs)?)?),
                CONFIG_TOML => ops.push(shared::config_toml(&kit_files::read_text(&f.abs)?)?),
                path => {
                    let skill = bundle.skill_of(path);
                    if skill.is_some_and(|s| !chosen.contains(s)) {
                        continue;
                    }
                    let mut bytes = kit_files::read(&f.abs)?;
                    if let Some(s) = skill
                        && let Ok(text) = std::str::from_utf8(&bytes)
                        && let Some(anchored) = rewrite::root_anchor(text, s, &skill_files[s])
                    {
                        bytes = anchored.into_bytes();
                    }
                    ops.push(Op::WriteFile {
                        path: rel(path)?,
                        bytes,
                        mode: kit_files::mode(&f.abs),
                    });
                }
            }
        }

        let mut plan = Plan {
            ops,
            ..Plan::default()
        };
        let have = bundle.skills();
        for missing in chosen.iter().filter(|s| !have.contains(s.as_str())) {
            plan.notices.push(format!(
                "skill pack lists {missing}, which the Codex bundle does not ship"
            ));
        }
        plan.notices.push(
            "Codex reads .codex/hooks.json and .codex/config.toml only after you trust this project".into(),
        );
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
