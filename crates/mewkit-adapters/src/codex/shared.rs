//! Codex files the user may own too: the kit merges into them, never replaces them.
use serde_json::{Map, Value};
use toml_edit::{DocumentMut, Item};

use crate::contract::{EmitError, Format, Op};
use crate::kit_files::rel;
use mewkit_core::plan::Handler;

pub const AGENTS_MD: &str = "AGENTS.md";
pub const HOOKS_JSON: &str = ".codex/hooks.json";
pub const CONFIG_TOML: &str = ".codex/config.toml";
/// Marked-block id of the kit's guidance in the project's `AGENTS.md`.
pub const BLOCK_ID: &str = "meowkit";
/// Codex's default `project_doc_max_bytes`: guidance past it is never read.
pub const AGENTS_MD_BUDGET: usize = 32 * 1024;

/// The kit's `AGENTS.md` text as a managed block. Over budget fails: a
/// truncated block would drop the safety summary without saying so.
pub fn agents_md(text: &str) -> Result<Op, EmitError> {
    if text.len() > AGENTS_MD_BUDGET {
        return Err(EmitError::Kit(format!(
            "Codex AGENTS.md guidance is {} bytes, over the {AGENTS_MD_BUDGET}-byte budget",
            text.len()
        )));
    }
    Ok(Op::MergeBlock {
        path: rel(AGENTS_MD)?,
        id: BLOCK_ID.into(),
        content: text.trim_end().to_owned(),
    })
}

/// One `MergeHooks` per event in the bundle's `hooks.json`.
pub fn hooks_json(text: &str) -> Result<Vec<Op>, EmitError> {
    let doc: Value = serde_json::from_str(text).map_err(|e| bad(HOOKS_JSON, e))?;
    let events = doc["hooks"]
        .as_object()
        .ok_or_else(|| bad(HOOKS_JSON, "no `hooks` object"))?;
    let mut ops = Vec::new();
    for (event, groups) in events {
        let mut handlers = Vec::new();
        for group in groups
            .as_array()
            .ok_or_else(|| bad(HOOKS_JSON, "an event is not an array"))?
        {
            let matcher = group
                .get("matcher")
                .and_then(Value::as_str)
                .map(str::to_owned);
            for handler in group["hooks"].as_array().into_iter().flatten() {
                handlers.push(Handler {
                    matcher: matcher.clone(),
                    handler: handler.clone(),
                });
            }
        }
        if handlers.is_empty() {
            continue;
        }
        ops.push(Op::MergeHooks {
            path: rel(HOOKS_JSON)?,
            event: event.clone(),
            handlers,
        });
    }
    Ok(ops)
}

/// The bundle's top-level `config.toml` keys as entries in the user's file.
pub fn config_toml(text: &str) -> Result<Op, EmitError> {
    let doc: DocumentMut = text.parse().map_err(|e| bad(CONFIG_TOML, e))?;
    let mut entries = Map::new();
    for (key, item) in doc.iter() {
        let value = match item {
            Item::Value(v) => toml_value(v)
                .ok_or_else(|| bad(CONFIG_TOML, format!("`{key}` has an unsupported type")))?,
            _ => {
                return Err(bad(
                    CONFIG_TOML,
                    format!("`{key}`: only top-level values are supported"),
                ));
            }
        };
        entries.insert(key.to_owned(), value);
    }
    Ok(Op::MergeEntries {
        path: rel(CONFIG_TOML)?,
        format: Format::Toml,
        key: vec![],
        entries,
    })
}

fn toml_value(v: &toml_edit::Value) -> Option<Value> {
    Some(match v {
        toml_edit::Value::String(s) => Value::String(s.value().clone()),
        toml_edit::Value::Integer(i) => Value::from(*i.value()),
        toml_edit::Value::Boolean(b) => Value::Bool(*b.value()),
        toml_edit::Value::Float(f) => Value::from(*f.value()),
        toml_edit::Value::Array(a) => {
            Value::Array(a.iter().map(toml_value).collect::<Option<_>>()?)
        }
        _ => return None,
    })
}

fn bad(file: &str, e: impl std::fmt::Display) -> EmitError {
    EmitError::Kit(format!("Codex bundle {file}: {e}"))
}
