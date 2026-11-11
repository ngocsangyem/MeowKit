//! Hook handlers in the `hooks.<Event>` array shared by Claude Code
//! `settings.json` and Codex `hooks.json`:
//! `{"hooks": {"PreToolUse": [{"matcher": "Bash", "hooks": [{"command": …}]}]}}`.
//!
//! A handler is identified by its group's matcher plus its command line
//! (`command`, then any `args`: Claude Code handlers are all `"command": "node"`
//! and differ only in `args`), so a kit handler lands in the user's group with
//! the same matcher instead of a copy of that group, and stripping takes out
//! exactly the handlers the kit added.
use serde_json::{Map, Value};

use super::json_entries::{parse, render};
use super::{EntriesMerged, MergeError};

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
pub fn merge(text: &str, event: &str, handlers: &[Handler]) -> Result<EntriesMerged, MergeError> {
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
mod tests {
    use super::*;
    use serde_json::json;

    fn h(matcher: Option<&str>, cmd: &str) -> Handler {
        Handler {
            matcher: matcher.map(str::to_owned),
            handler: json!({"type": "command", "command": cmd}),
        }
    }

    fn ids(hs: &[Handler]) -> Vec<String> {
        hs.iter().map(|x| x.id().unwrap()).collect()
    }

    #[test]
    fn joins_the_users_group_with_the_same_matcher_and_strips_back() {
        let user = render(&json!({"hooks": {"PreToolUse": [
            {"matcher": "Bash", "hooks": [{"type": "command", "command": "mine"}]}
        ]}, "other": 1}));
        let kit = [
            h(Some("Bash"), "kit-a"),
            h(Some("Edit"), "kit-b"),
            h(None, "kit-c"),
        ];
        let out = merge(&user, "PreToolUse", &kit).unwrap();
        assert_eq!(out.created, 0);
        let v: Value = serde_json::from_str(&out.text).unwrap();
        let groups = v["hooks"]["PreToolUse"].as_array().unwrap();
        assert_eq!(groups.len(), 3);
        assert_eq!(groups[0]["hooks"].as_array().unwrap().len(), 2);
        assert!(groups[2].get("matcher").is_none());
        assert_eq!(strip(&out.text, "PreToolUse", &ids(&kit), 0).unwrap(), user);
    }

    #[test]
    fn removes_only_the_containers_it_created() {
        for (user, created) in [("", 2), ("{\n  \"hooks\": {}\n}\n", 1)] {
            let kit = [h(Some("Bash"), "k")];
            let out = merge(user, "Stop", &kit).unwrap();
            assert_eq!(out.created, created);
            let back = strip(&out.text, "Stop", &ids(&kit), out.created).unwrap();
            let want = if user.is_empty() { "{}\n" } else { user };
            assert_eq!(back, want);
        }
    }

    #[test]
    fn re_merge_is_idempotent_and_reports_replaced_user_handlers() {
        let kit = [h(Some("Bash"), "k")];
        let once = merge("", "PreToolUse", &kit).unwrap();
        let twice = merge(&once.text, "PreToolUse", &kit).unwrap();
        assert_eq!(once.text, twice.text);
        assert!(twice.replaced.is_empty());

        let mut changed = kit[0].clone();
        changed.handler["timeout"] = json!(5);
        let out = merge(&once.text, "PreToolUse", &[changed]).unwrap();
        assert_eq!(out.replaced, ids(&kit));
    }

    #[test]
    fn nothing_to_strip_leaves_text_byte_identical() {
        let tabbed = "{\n\t\"hooks\": {\"Stop\": []}\n}\n";
        assert_eq!(
            strip(tabbed, "Stop", &ids(&[h(None, "x")]), 0).unwrap(),
            tabbed
        );
        assert_eq!(
            strip(tabbed, "PreToolUse", &ids(&[h(None, "x")]), 0).unwrap(),
            tabbed
        );
    }

    #[test]
    fn handlers_that_differ_only_in_args_stay_distinct() {
        let with = |arg: &str| Handler {
            matcher: Some("Edit".into()),
            handler: json!({"type": "command", "command": "node", "args": [arg]}),
        };
        let kit = [with("a.cjs"), with("b.cjs")];
        let out = merge("", "PreToolUse", &kit).unwrap();
        let v: Value = serde_json::from_str(&out.text).unwrap();
        assert_eq!(
            v["hooks"]["PreToolUse"][0]["hooks"]
                .as_array()
                .unwrap()
                .len(),
            2
        );
        let back = strip(&out.text, "PreToolUse", &ids(&kit[..1]), out.created).unwrap();
        let v: Value = serde_json::from_str(&back).unwrap();
        assert_eq!(v["hooks"]["PreToolUse"][0]["hooks"][0]["args"][0], "b.cjs");
    }

    #[test]
    fn kit_created_containers_go_even_if_the_handlers_were_removed_by_hand() {
        let kit = [h(Some("Bash"), "k")];
        let out = merge("", "Stop", &kit).unwrap();
        let by_hand = out
            .text
            .replace(
                r#"{
            "type": "command",
            "command": "k"
          }"#,
                "",
            )
            .replace("[\n          \n        ]", "[]");
        let v: Value = serde_json::from_str(&by_hand).unwrap();
        assert!(
            v["hooks"]["Stop"][0]["hooks"]
                .as_array()
                .unwrap()
                .is_empty(),
            "{by_hand}"
        );
        // The user's emptied group is theirs now; the event array is not removed under it.
        let back = strip(&by_hand, "Stop", &ids(&kit), out.created).unwrap();
        assert_eq!(back, by_hand);
        assert_eq!(
            strip(
                "{\n  \"hooks\": {\n    \"Stop\": []\n  }\n}\n",
                "Stop",
                &ids(&kit),
                2
            )
            .unwrap(),
            "{}\n"
        );
    }

    #[test]
    fn a_users_own_empty_group_survives_a_strip() {
        let user = render(&json!({"hooks": {"Stop": [{"matcher": "X", "hooks": []}]}}));
        let kit = [h(Some("Y"), "k")];
        let out = merge(&user, "Stop", &kit).unwrap();
        assert_eq!(
            strip(&out.text, "Stop", &ids(&kit), out.created).unwrap(),
            user
        );
    }

    #[test]
    fn rejects_malformed_shapes() {
        assert!(merge(r#"{"hooks": []}"#, "Stop", &[h(None, "x")]).is_err());
        assert!(merge(r#"{"hooks": {"Stop": {}}}"#, "Stop", &[h(None, "x")]).is_err());
        let bad = Handler {
            matcher: None,
            handler: json!({"type": "command"}),
        };
        assert!(merge("", "Stop", &[bad]).is_err());
        assert!(merge("", "Stop", &[h(Some(""), "x")]).is_err());
    }
}
