//! Named entries in a TOML table at a key path, e.g. `[mcp_servers.<name>]` in
//! `.codex/config.toml`. Format-preserving: comments, whitespace and ordering
//! of everything the kit did not add survive byte for byte.
use serde_json::{Map, Value};
use toml_edit::{DocumentMut, Item, Table};

use super::{EntriesMerged, MergeError};

/// Insert or replace `entries` in the table at `key` (created as needed).
/// JSON objects become TOML tables, other JSON values become TOML values.
pub fn merge(
    text: &str,
    key: &[&str],
    entries: &Map<String, Value>,
) -> Result<EntriesMerged, MergeError> {
    let mut doc = parse(text)?;
    let mut created = 0;
    let mut table = doc.as_table_mut();
    for (depth, k) in key.iter().enumerate() {
        if !table.contains_key(k) {
            let mut fresh = Table::new();
            // Implicit: the header is written only if the table gets plain keys, so
            // `[a.b.name]` appears without empty `[a]` / `[a.b]` headers.
            fresh.set_implicit(true);
            table.insert(k, Item::Table(fresh));
            if created == 0 {
                created = key.len() - depth;
            }
        }
        table = table
            .get_mut(k)
            .and_then(Item::as_table_mut)
            .ok_or_else(|| not_table(&key[..=depth]))?;
    }
    let (mut replaced, mut already) = (Vec::new(), Vec::new());
    for (name, value) in entries {
        let item = to_item(value)?;
        if let Some(old) = table.get(name) {
            if old.to_string().trim() == item.to_string().trim() {
                already.push(name.clone());
            } else {
                replaced.push(name.clone());
            }
        }
        table.insert(name, item);
    }
    Ok(EntriesMerged {
        text: doc.to_string(),
        created,
        replaced,
        already,
    })
}

/// Remove `names` from the table at `key`, then remove the innermost `created`
/// tables along `key` if they are empty.
pub fn strip(
    text: &str,
    key: &[&str],
    names: &[String],
    created: usize,
) -> Result<String, MergeError> {
    let mut doc = parse(text)?;
    let Some(target) = get_mut(doc.as_table_mut(), key)? else {
        return Ok(text.to_owned());
    };
    for name in names {
        target.remove(name);
    }
    for depth in (key.len().saturating_sub(created)..key.len()).rev() {
        let parent =
            get_mut(doc.as_table_mut(), &key[..depth])?.expect("ancestor of an existing table");
        if parent
            .get(key[depth])
            .and_then(Item::as_table)
            .is_some_and(Table::is_empty)
        {
            parent.remove(key[depth]);
        } else {
            break;
        }
    }
    Ok(doc.to_string())
}

fn parse(text: &str) -> Result<DocumentMut, MergeError> {
    text.parse()
        .map_err(|e: toml_edit::TomlError| MergeError::Parse(e.to_string()))
}

fn get_mut<'a>(
    mut table: &'a mut Table,
    key: &[&str],
) -> Result<Option<&'a mut Table>, MergeError> {
    for (depth, k) in key.iter().enumerate() {
        match table.get_mut(k) {
            None => return Ok(None),
            Some(item) => {
                table = item
                    .as_table_mut()
                    .ok_or_else(|| not_table(&key[..=depth]))?;
            }
        }
    }
    Ok(Some(table))
}

fn not_table(key: &[&str]) -> MergeError {
    MergeError::Malformed(format!("`{}` is not a TOML table", key.join(".")))
}

fn to_item(value: &Value) -> Result<Item, MergeError> {
    match value {
        Value::Object(map) => {
            let mut table = Table::new();
            for (k, v) in map {
                table.insert(k, to_item(v)?);
            }
            Ok(Item::Table(table))
        }
        other => Ok(Item::Value(to_value(other)?)),
    }
}

fn to_value(value: &Value) -> Result<toml_edit::Value, MergeError> {
    Ok(match value {
        Value::Null => return Err(MergeError::Malformed("TOML has no null".into())),
        Value::Bool(b) => (*b).into(),
        Value::Number(n) => match n.as_i64() {
            Some(i) => i.into(),
            None => n.as_f64().unwrap_or_default().into(),
        },
        Value::String(s) => s.as_str().into(),
        Value::Array(items) => {
            let mut arr = toml_edit::Array::new();
            for v in items {
                arr.push(to_value(v)?);
            }
            arr.into()
        }
        Value::Object(map) => {
            let mut inline = toml_edit::InlineTable::new();
            for (k, v) in map {
                inline.insert(k, to_value(v)?);
            }
            inline.into()
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;
    use serde_json::json;

    fn ours() -> Map<String, Value> {
        json!({"meowkit": {"command": "node", "args": ["x.cjs"], "env": {"A": "1"}}})
            .as_object()
            .unwrap()
            .clone()
    }

    const SAMPLES: [&str; 5] = [
        "",
        "# just a comment\n",
        "model = \"o4\"  # trailing comment\n\n[mcp_servers.mine]\ncommand = \"a\" # keep\n",
        "[mcp_servers]\n# user's empty table, with a comment\n",
        "[profiles.x]\nmodel = 'y'\n\n# footer\n",
    ];

    #[test]
    fn merge_writes_a_dotted_table_and_keeps_comments() {
        let out = merge(SAMPLES[2], &["mcp_servers"], &ours()).unwrap();
        assert!(out.text.contains("[mcp_servers.meowkit]"), "{}", out.text);
        assert!(out.text.contains("command = \"a\" # keep"));
        assert!(out.text.contains("# trailing comment"));
        assert_eq!(out.created, 0);
        let fresh = merge("", &["mcp_servers"], &ours()).unwrap();
        assert!(!fresh.text.contains("[mcp_servers]\n"), "{}", fresh.text);
    }

    #[test]
    fn strip_restores_each_sample_byte_for_byte() {
        for user in SAMPLES {
            for key in [&["mcp_servers"][..], &["a", "b"][..]] {
                let out = merge(user, key, &ours()).unwrap();
                let back = strip(&out.text, key, &["meowkit".into()], out.created).unwrap();
                assert_eq!(back, user, "key {key:?}");
            }
        }
    }

    #[test]
    fn malformed_input_is_an_error() {
        assert!(matches!(
            merge("[unclosed", &["k"], &ours()),
            Err(MergeError::Parse(_))
        ));
        assert!(merge("k = 1\n", &["k"], &ours()).is_err());
        let null = json!({"x": null}).as_object().unwrap().clone();
        assert!(merge("", &["k"], &null).is_err());
    }

    proptest! {
        #[test]
        fn strip_inverts_merge(
            keys in proptest::collection::btree_map("[a-z]{1,4}", "[a-z0-9 ]{0,6}", 0..4),
            comment in "[a-z ]{0,10}",
            sample in 0usize..SAMPLES.len(),
        ) {
            let mut user = String::from(SAMPLES[sample]);
            user.push_str(&format!("# {comment}\n[user]\n"));
            for (k, v) in &keys {
                user.push_str(&format!("{k} = \"{v}\"\n"));
            }
            let out = merge(&user, &["mcp_servers"], &ours()).unwrap();
            let back = strip(&out.text, &["mcp_servers"], &["meowkit".into()], out.created).unwrap();
            prop_assert_eq!(back, user);
        }
    }
}
