//! Named entries in a JSON object at a key path, e.g. `mcpServers.<name>` in
//! `.cursor/mcp.json`. Key order and every unrelated entry are preserved; the
//! file is re-serialized pretty-printed (2 spaces) with a trailing newline.
use serde_json::{Map, Value};

use super::{EntriesMerged, MergeError};

/// Insert or replace `entries` in the object at `key` (created as needed).
pub fn merge(
    text: &str,
    key: &[&str],
    entries: &Map<String, Value>,
) -> Result<EntriesMerged, MergeError> {
    let mut doc = parse(text)?;
    let mut created = 0;
    let mut node = &mut doc;
    for (depth, k) in key.iter().enumerate() {
        let obj = node
            .as_object_mut()
            .ok_or_else(|| not_object(&key[..depth]))?;
        if !obj.contains_key(*k) {
            obj.insert((*k).to_owned(), Value::Object(Map::new()));
            if created == 0 {
                created = key.len() - depth;
            }
        }
        node = obj.get_mut(*k).expect("just ensured");
    }
    let target = node.as_object_mut().ok_or_else(|| not_object(key))?;
    let mut replaced = Vec::new();
    for (name, value) in entries {
        if let Some(old) = target.insert(name.clone(), value.clone())
            && &old != value
        {
            replaced.push(name.clone());
        }
    }
    Ok(EntriesMerged {
        text: render(&doc),
        created,
        replaced,
    })
}

/// Remove `names` from the object at `key`, then remove the innermost
/// `created` containers along `key` if they are empty.
pub fn strip(
    text: &str,
    key: &[&str],
    names: &[String],
    created: usize,
) -> Result<String, MergeError> {
    let mut doc = parse(text)?;
    if let Some(target) = get_mut(&mut doc, key)? {
        let obj = target.as_object_mut().ok_or_else(|| not_object(key))?;
        for name in names {
            obj.shift_remove(name);
        }
    } else {
        return Ok(text.to_owned());
    }
    for depth in (key.len().saturating_sub(created)..key.len()).rev() {
        let parent = get_mut(&mut doc, &key[..depth])?.expect("ancestor of an existing node");
        let obj = parent.as_object_mut().expect("checked on the way down");
        if obj
            .get(key[depth])
            .and_then(Value::as_object)
            .is_some_and(Map::is_empty)
        {
            obj.shift_remove(key[depth]);
        } else {
            break;
        }
    }
    Ok(render(&doc))
}

pub(super) fn parse(text: &str) -> Result<Value, MergeError> {
    if text.trim().is_empty() {
        return Ok(Value::Object(Map::new()));
    }
    let doc: Value = serde_json::from_str(text).map_err(|e| MergeError::Parse(e.to_string()))?;
    if doc.is_object() {
        Ok(doc)
    } else {
        Err(MergeError::Malformed(
            "top level is not a JSON object".into(),
        ))
    }
}

fn get_mut<'a>(doc: &'a mut Value, key: &[&str]) -> Result<Option<&'a mut Value>, MergeError> {
    let mut node = doc;
    for (depth, k) in key.iter().enumerate() {
        let obj = node
            .as_object_mut()
            .ok_or_else(|| not_object(&key[..depth]))?;
        match obj.get_mut(*k) {
            Some(next) => node = next,
            None => return Ok(None),
        }
    }
    Ok(Some(node))
}

fn not_object(key: &[&str]) -> MergeError {
    MergeError::Malformed(format!("`{}` is not a JSON object", key.join(".")))
}

pub(super) fn render(doc: &Value) -> String {
    let mut out = serde_json::to_string_pretty(doc).expect("a Value serializes");
    out.push('\n');
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;
    use serde_json::json;

    fn entries(v: Value) -> Map<String, Value> {
        v.as_object().unwrap().clone()
    }

    #[test]
    fn merges_into_existing_and_new_containers_preserving_order() {
        let user = r#"{"z": 1, "mcpServers": {"mine": {"command": "a"}}, "a": 2}"#;
        let out = merge(
            user,
            &["mcpServers"],
            &entries(json!({"meowkit": {"command": "b"}})),
        )
        .unwrap();
        assert_eq!(out.created, 0);
        let v: Value = serde_json::from_str(&out.text).unwrap();
        let keys: Vec<_> = v.as_object().unwrap().keys().cloned().collect();
        assert_eq!(keys, ["z", "mcpServers", "a"]);
        assert_eq!(
            v["mcpServers"]
                .as_object()
                .unwrap()
                .keys()
                .collect::<Vec<_>>(),
            ["mine", "meowkit"]
        );
        let fresh = merge("", &["a", "b"], &entries(json!({"x": 1}))).unwrap();
        assert_eq!(fresh.created, 2);
    }

    #[test]
    fn reports_replaced_user_entries() {
        let out = merge(
            r#"{"k": {"x": 1, "y": 2}}"#,
            &["k"],
            &entries(json!({"x": 9, "y": 2})),
        )
        .unwrap();
        assert_eq!(out.replaced, ["x"]);
    }

    #[test]
    fn strip_keeps_a_container_the_user_made() {
        let user = r#"{"k": {}}"#;
        let out = merge(user, &["k"], &entries(json!({"x": 1}))).unwrap();
        let back: Value =
            serde_json::from_str(&strip(&out.text, &["k"], &["x".into()], out.created).unwrap())
                .unwrap();
        assert_eq!(back, serde_json::from_str::<Value>(user).unwrap());
    }

    #[test]
    fn malformed_input_is_an_error() {
        assert!(matches!(
            merge("{not json", &["k"], &Map::new()),
            Err(MergeError::Parse(_))
        ));
        assert!(merge("[1]", &["k"], &Map::new()).is_err());
        assert!(merge(r#"{"k": 3}"#, &["k"], &Map::new()).is_err());
    }

    fn user_doc() -> impl Strategy<Value = Value> {
        let leaf = prop_oneof![
            any::<i32>().prop_map(Value::from),
            "[a-z]{0,4}".prop_map(Value::from)
        ];
        let obj = proptest::collection::vec(("[a-z]{1,3}", leaf.clone()), 0..4)
            .prop_map(|kv| Value::Object(kv.into_iter().collect()));
        proptest::collection::vec(("[a-z]{1,3}", prop_oneof![leaf, obj]), 0..5)
            .prop_map(|kv| Value::Object(kv.into_iter().collect()))
    }

    proptest! {
        #[test]
        fn strip_inverts_merge(user in user_doc(), depth in 1usize..3) {
            let key: Vec<&str> = ["mk1", "mk2"][..depth].to_vec();
            let text = serde_json::to_string(&user).unwrap();
            let ours = entries(json!({"mk-entry": {"command": "node"}}));
            let merged = merge(&text, &key, &ours).unwrap();
            let back = strip(&merged.text, &key, &["mk-entry".into()], merged.created).unwrap();
            let back: Value = serde_json::from_str(&back).unwrap();
            // Equal including key order (serde_json preserve_order).
            prop_assert_eq!(serde_json::to_string(&back).unwrap(), text);
        }
    }
}
