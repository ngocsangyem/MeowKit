//! The bundle's `.cursor/hooks.json`, merged into the user's file handler by
//! handler. Cursor's layout is flat: each event lists handlers directly.
use serde_json::{Map, Value};

use crate::contract::{EmitError, Format, Op};
use crate::kit_files::rel;
use mewkit_core::plan::{Handler, HookLayout};

pub const HOOKS_JSON: &str = ".cursor/hooks.json";

/// Events whose hook can deny the action (Cursor hooks docs). A failing hook
/// on one of these fails open unless `failClosed` is set, so the kit always
/// sets it: a crashed privacy or shell gate must block, not wave through.
pub const BLOCKING: &[&str] = &[
    "preToolUse",
    "subagentStart",
    "beforeShellExecution",
    "beforeMCPExecution",
    "beforeReadFile",
    "beforeTabFileRead",
    "beforeSubmitPrompt",
];

/// `version` as an entry plus one flat `MergeHooks` per non-empty event.
pub fn ops(text: &str) -> Result<Vec<Op>, EmitError> {
    let bad =
        |e: &dyn std::fmt::Display| EmitError::Kit(format!("Cursor bundle {HOOKS_JSON}: {e}"));
    let doc: Value = serde_json::from_str(text).map_err(|e| bad(&e))?;
    let path = rel(HOOKS_JSON)?;
    let mut ops = Vec::new();
    if let Some(version) = doc.get("version") {
        let mut top = Map::new();
        top.insert("version".into(), version.clone());
        ops.push(Op::MergeEntries {
            path: path.clone(),
            format: Format::Json,
            key: vec![],
            entries: top,
        });
    }
    let events = doc["hooks"]
        .as_object()
        .ok_or_else(|| bad(&"no `hooks` object"))?;
    for (event, list) in events {
        let list = list
            .as_array()
            .ok_or_else(|| bad(&format!("`hooks.{event}` is not an array")))?;
        let blocking = BLOCKING.contains(&event.as_str());
        let mut handlers = Vec::new();
        for handler in list {
            let mut handler = handler.clone();
            let obj = handler
                .as_object_mut()
                .ok_or_else(|| bad(&format!("a `hooks.{event}` handler is not an object")))?;
            if blocking {
                obj.insert("failClosed".into(), Value::Bool(true));
            }
            handlers.push(Handler {
                matcher: obj
                    .get("matcher")
                    .and_then(Value::as_str)
                    .map(str::to_owned),
                handler,
            });
        }
        if !handlers.is_empty() {
            ops.push(Op::MergeHooks {
                path: path.clone(),
                event: event.clone(),
                handlers,
                layout: HookLayout::Flat,
            });
        }
    }
    Ok(ops)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blocking_handlers_fail_closed_and_others_keep_their_value() {
        let ops = ops(r#"{"version": 1, "hooks": {
            "preToolUse": [{"matcher": "^read", "command": "a", "failClosed": false}],
            "sessionStart": [{"command": "b", "failClosed": false}],
            "stop": []
        }}"#)
        .unwrap();
        assert_eq!(ops.len(), 3, "version entry + two non-empty events");
        let fail_closed = |i: usize| match &ops[i] {
            Op::MergeHooks { handlers, .. } => handlers[0].handler["failClosed"].clone(),
            _ => panic!(),
        };
        assert_eq!(fail_closed(1), true);
        assert_eq!(fail_closed(2), false);
    }
}
