//! Hook handlers in the `hooks.<event>` array of a runtime's hook file, in
//! one of two layouts:
//! - [`HookLayout::Grouped`] (Claude Code `settings.json`, Codex `hooks.json`):
//!   `{"hooks": {"PreToolUse": [{"matcher": "Bash", "hooks": [{"command": …}]}]}}`;
//! - [`HookLayout::Flat`] (Cursor `hooks.json`): the event array holds the
//!   handlers themselves, each with its own optional `matcher`:
//!   `{"hooks": {"preToolUse": [{"matcher": "^edit", "command": …}]}}`.
//!
//! A handler is identified by its group's matcher plus its command line
//! (`command`, then any `args`: Claude Code handlers are all `"command": "node"`
//! and differ only in `args`), so a kit handler lands in the user's group with
//! the same matcher instead of a copy of that group, and stripping takes out
//! exactly the handlers the kit added.
use serde_json::{Map, Value};

use super::json_entries::{parse, render};
use super::{EntriesMerged, MergeError};

/// How an event array holds its handlers.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum HookLayout {
    /// Groups of `{matcher, hooks: [handler]}`.
    #[default]
    Grouped,
    /// Handlers directly, each carrying its own `matcher`.
    Flat,
}

/// One kit hook handler and the matcher of the group it belongs in.
#[derive(Clone, Debug, PartialEq)]
pub struct Handler {
    /// `None` for a group without a `matcher` key.
    pub matcher: Option<String>,
    /// The handler object; it must carry a string `command`.
    pub handler: Value,
}

impl Handler {
    /// The name recorded in the ownership index for this handler.
    pub fn id(&self) -> Result<String, MergeError> {
        Ok(id_of(self.matcher.as_deref(), &command(&self.handler)?))
    }
}

const SEP: char = '\u{1f}';

fn id_of(matcher: Option<&str>, command: &str) -> String {
    format!("{}{SEP}{command}", matcher.unwrap_or(""))
}

/// Split an id back into matcher (`None` if empty) and command.
fn split_id(id: &str) -> Result<(Option<&str>, &str), MergeError> {
    let (m, c) = id
        .split_once(SEP)
        .ok_or_else(|| MergeError::Malformed(format!("hook id {id:?} has no matcher part")))?;
    Ok(((!m.is_empty()).then_some(m), c))
}

/// The handler's command line: `command`, then each `args` entry, joined by U+001E.
fn command(handler: &Value) -> Result<String, MergeError> {
    let mut line = handler
        .get("command")
        .and_then(Value::as_str)
        .ok_or_else(|| MergeError::Malformed("hook handler has no string `command`".into()))?
        .to_owned();
    for arg in handler
        .get("args")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
    {
        line.push('\u{1e}');
        line.push_str(&arg.to_string());
    }
    Ok(line)
}

fn matcher_of(group: &Value) -> Option<&str> {
    group.get("matcher").and_then(Value::as_str)
}

/// Add or replace `handlers` under `hooks.<event>`, creating containers as needed.
/// `created` counts the containers made, innermost first: 1 = the event array,
/// 2 = also the `hooks` object.
/// In [`HookLayout::Flat`] the handler object itself carries `matcher`, which
/// must equal [`Handler::matcher`].
pub fn merge(
    text: &str,
    event: &str,
    handlers: &[Handler],
    layout: HookLayout,
) -> Result<EntriesMerged, MergeError> {
    let mut doc = parse(text)?;
    let root = doc.as_object_mut().expect("parse returns an object");
    let mut created = 0;
    if !root.contains_key("hooks") {
        root.insert("hooks".into(), Value::Object(Map::new()));
        created = 2;
    }
    let hooks = root["hooks"]
        .as_object_mut()
        .ok_or_else(|| MergeError::Malformed("`hooks` is not a JSON object".into()))?;
    if !hooks.contains_key(event) {
        hooks.insert(event.into(), Value::Array(Vec::new()));
        created = created.max(1);
    }
    let groups = hooks[event]
        .as_array_mut()
        .ok_or_else(|| MergeError::Malformed(format!("`hooks.{event}` is not an array")))?;

    let mut replaced = Vec::new();
    for h in handlers {
        if h.matcher.as_deref() == Some("") {
            // An empty matcher's id reads back as "no matcher"; strip would miss it.
            return Err(MergeError::Malformed(format!(
                "a `hooks.{event}` handler has an empty matcher"
            )));
        }
        let cmd = command(&h.handler)?;
        if layout == HookLayout::Flat {
            if matcher_of(&h.handler) != h.matcher.as_deref() {
                return Err(MergeError::Malformed(format!(
                    "a `hooks.{event}` handler's matcher disagrees with its own `matcher` key"
                )));
            }
            let same = |x: &Value| {
                matcher_of(x) == h.matcher.as_deref()
                    && command(x).ok().as_deref() == Some(cmd.as_str())
            };
            match groups.iter_mut().find(|x| same(x)) {
                Some(existing) => {
                    if *existing != h.handler {
                        replaced.push(id_of(h.matcher.as_deref(), &cmd));
                    }
                    *existing = h.handler.clone();
                }
                None => groups.push(h.handler.clone()),
            }
            continue;
        }
        let group = groups
            .iter_mut()
            .find(|g| matcher_of(g) == h.matcher.as_deref());
        let Some(group) = group else {
            let mut g = Map::new();
            if let Some(m) = &h.matcher {
                g.insert("matcher".into(), Value::String(m.clone()));
            }
            g.insert("hooks".into(), Value::Array(vec![h.handler.clone()]));
            groups.push(Value::Object(g));
            continue;
        };
        let list = group
            .get_mut("hooks")
            .and_then(Value::as_array_mut)
            .ok_or_else(|| {
                MergeError::Malformed(format!("a `hooks.{event}` group has no `hooks` array"))
            })?;
        match list
            .iter_mut()
            .find(|x| command(x).ok().as_deref() == Some(cmd.as_str()))
        {
            Some(existing) => {
                if *existing != h.handler {
                    replaced.push(id_of(h.matcher.as_deref(), &cmd));
                }
                *existing = h.handler.clone();
            }
            None => list.push(h.handler.clone()),
        }
    }
    Ok(EntriesMerged {
        text: render(&doc),
        created,
        replaced,
        // An identical user handler is adopted (ADR 261110-rust-adapter-contract).
        already: Vec::new(),
    })
}

/// Remove the handlers named by `ids`; drop the groups that removal emptied,
/// then the containers the merge created (`created`) once empty, even when
/// the handlers were already gone. Text with nothing to change is returned
/// unchanged.
pub fn strip(
    text: &str,
    event: &str,
    ids: &[String],
    created: usize,
    layout: HookLayout,
) -> Result<String, MergeError> {
    let mut doc = parse(text)?;
    let root = doc.as_object_mut().expect("parse returns an object");
    let Some(hooks) = root.get_mut("hooks") else {
        return Ok(text.to_owned());
    };
    let hooks = hooks
        .as_object_mut()
        .ok_or_else(|| MergeError::Malformed("`hooks` is not a JSON object".into()))?;
    let Some(groups) = hooks.get_mut(event) else {
        return Ok(text.to_owned());
    };
    let groups = groups
        .as_array_mut()
        .ok_or_else(|| MergeError::Malformed(format!("`hooks.{event}` is not an array")))?;

    let mut changed = false;
    let mut emptied = vec![false; groups.len()];
    for id in ids {
        let (matcher, cmd) = split_id(id)?;
        if layout == HookLayout::Flat {
            let before = groups.len();
            groups
                .retain(|x| !(matcher_of(x) == matcher && command(x).ok().as_deref() == Some(cmd)));
            changed |= groups.len() != before;
            continue;
        }
        for (i, group) in groups.iter_mut().enumerate() {
            if matcher_of(group) != matcher {
                continue;
            }
            if let Some(list) = group.get_mut("hooks").and_then(Value::as_array_mut) {
                let before = list.len();
                list.retain(|x| command(x).ok().as_deref() != Some(cmd));
                if list.len() != before {
                    changed = true;
                    emptied[i] |= list.is_empty();
                }
            }
        }
    }
    // Only groups this call emptied go; a user's own empty group stays.
    let mut flags = emptied.into_iter();
    groups.retain(|_| !flags.next().unwrap_or(false));
    if created >= 1 && groups.is_empty() {
        hooks.shift_remove(event);
        changed = true;
        if created >= 2 && hooks.is_empty() {
            root.shift_remove("hooks");
        }
    }
    if !changed {
        return Ok(text.to_owned());
    }
    Ok(render(&doc))
}

#[cfg(test)]
#[path = "hook_groups_tests.rs"]
mod tests;
