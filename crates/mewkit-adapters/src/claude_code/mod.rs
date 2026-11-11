//! Claude Code emitter, project scope.
//!
//! The kit's `.claude/` tree is Claude Code's native layout, so files install
//! as they ship. `settings.json` is the one file the user owns too: the kit's
//! hook handlers, `env` entries and `statusLine` are merged into it and
//! recorded, so uninstall takes out only what the kit added.
use serde_json::{Map, Value};

use crate::contract::{
    EmitError, EmitRequest, Emitter, Format, Op, OwnershipIndex, Plan, RelPath, Runtime, Scope,
    ScopeKind,
};
use crate::kit_files::{self, rel};
use crate::strip;
use mewkit_core::plan::Handler;

pub const SETTINGS: &str = ".claude/settings.json";

pub struct ClaudeCode;

impl Emitter for ClaudeCode {
    fn target(&self) -> Runtime {
        Runtime::ClaudeCode
    }

    fn roots(&self, scope: &Scope) -> Vec<RelPath> {
        match scope.kind {
            ScopeKind::Project => vec![RelPath::new(".claude").expect("static root")],
            ScopeKind::Global => vec![],
        }
    }

    fn prepare(&self, req: &EmitRequest<'_>) -> Result<Plan, EmitError> {
        if req.scope.kind == ScopeKind::Global {
            return Err(EmitError::Unsupported {
                runtime: "claude-code",
                what: "global scope yet".into(),
            });
        }
        let src = req.kit.dir.join(".claude");
        if !src.is_dir() {
            return Err(EmitError::Kit("the kit has no .claude/ tree".into()));
        }
        let mut plan = Plan::default();
        for f in kit_files::walk(&src)? {
            if maintainer_only(&f.rel) {
                continue;
            }
            let path = format!(".claude/{}", f.rel);
            if path == SETTINGS {
                settings(&kit_files::read_text(&f.abs)?, &mut plan)?;
                continue;
            }
            plan.ops.push(Op::WriteFile {
                path: rel(&path)?,
                bytes: kit_files::read(&f.abs)?,
                mode: kit_files::mode(&f.abs),
            });
        }
        Ok(plan)
    }

    fn plan_strip(&self, scope: &Scope, owned: &OwnershipIndex) -> Result<Plan, EmitError> {
        strip::plan_from_index(&self.roots(scope), owned, |f| f == SETTINGS)
    }
}

/// Registry views and attribution the kit keeps for its maintainers; the npm
/// CLI never installs them either.
fn maintainer_only(rel: &str) -> bool {
    let name = rel.rsplit('/').next().unwrap_or(rel);
    name.ends_with("_INDEX.md") || name == "SKILLS_ATTRIBUTION.md"
}

/// Merge ops for the kit's `settings.json`. Keys the merge engines cannot
/// add without replacing the user's own values (`permissions` is a list) are
/// reported instead of written.
fn settings(text: &str, plan: &mut Plan) -> Result<(), EmitError> {
    let bad = |e: &dyn std::fmt::Display| EmitError::Kit(format!("{SETTINGS}: {e}"));
    let doc: Value = serde_json::from_str(text).map_err(|e| bad(&e))?;
    let doc = doc.as_object().ok_or_else(|| bad(&"not a JSON object"))?;
    let path = rel(SETTINGS)?;
    let mut top = Map::new();
    for (key, value) in doc {
        match key.as_str() {
            "hooks" => {
                let events = value.as_object().ok_or_else(|| bad(&"`hooks` is not an object"))?;
                for (event, groups) in events {
                    let mut handlers = Vec::new();
                    for group in groups.as_array().ok_or_else(|| bad(&format!("hooks.{event} is not an array")))? {
                        let matcher = group.get("matcher").and_then(Value::as_str).map(str::to_owned);
                        for handler in group["hooks"].as_array().into_iter().flatten() {
                            handlers.push(Handler {
                                matcher: matcher.clone(),
                                handler: handler.clone(),
                            });
                        }
                    }
                    if !handlers.is_empty() {
                        plan.ops.push(Op::MergeHooks {
                            path: path.clone(),
                            event: event.clone(),
                            handlers,
                        });
                    }
                }
            }
            "env" => plan.ops.push(Op::MergeEntries {
                path: path.clone(),
                format: Format::Json,
                key: vec!["env".into()],
                entries: value.as_object().ok_or_else(|| bad(&"`env` is not an object"))?.clone(),
            }),
            "statusLine" => {
                top.insert(key.clone(), value.clone());
            }
            other => plan
                .notices
                .push(format!("{SETTINGS}: the kit's `{other}` is not merged into your settings; add it yourself if you want it")),
        }
    }
    if !top.is_empty() {
        plan.ops.push(Op::MergeEntries {
            path,
            format: Format::Json,
            key: vec![],
            entries: top,
        });
    }
    Ok(())
}
