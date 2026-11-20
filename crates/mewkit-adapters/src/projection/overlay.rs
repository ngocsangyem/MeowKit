//! What one runtime needs that the authored kit cannot be projected into:
//! keys with no authored counterpart, passages that describe behaviour only
//! that runtime has, and whole files. A runtime's overlay lives in
//! `kit/overlays/<runtime>/`:
//!
//! - `overlay.toml`: `[skill.<name>]` and `[agent.<name>]` tables of keys
//!   added to that skill's frontmatter or that agent's file, and
//!   `[[replace]]` entries (`path`, `find`, `with`) applied to a projected
//!   file, and `omit`, the installed paths this runtime does not take;
//! - `files/<installed path>`: a file with no authored source, installed as
//!   is. It may not take the place of a projected file: that would keep
//!   winning, unnoticed, after the authored file changed.
//!
//! An overlay is checked against the kit it is applied to: an entry that
//! names a skill or agent the kit lacks, or text the projected file does not
//! hold exactly once, is an error, so an overlay cannot outlive what it
//! amends without someone noticing.
use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;

use toml_edit::{DocumentMut, Item, Value};

use crate::contract::EmitError;
use crate::kit_files;

/// One passage of a projected file swapped for the runtime's own.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Replacement {
    pub find: String,
    pub with: String,
}

#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct Overlay {
    skill_keys: BTreeMap<String, Vec<(String, String)>>,
    agent_keys: BTreeMap<String, Vec<(String, String)>>,
    replacements: BTreeMap<String, Vec<Replacement>>,
    /// Installed paths projection writes that this runtime does not take.
    pub omit: Vec<String>,
    /// Installed path -> content.
    pub files: BTreeMap<String, Vec<u8>>,
}

fn bad(why: impl std::fmt::Display) -> EmitError {
    EmitError::Kit(format!("overlay: {why}"))
}

/// Keys projection writes itself; an overlay that set one would write it twice.
const PROJECTED_KEYS: &[&str] = &[
    "name",
    "description",
    "model",
    "requires_runtime",
    "developer_instructions",
];

/// `[<kind>.<name>]` tables as name -> `(key, rendered value)` in file order.
/// Only a string, a boolean or an integer: each renders the same in TOML
/// and in YAML.
fn keyed(
    doc: &DocumentMut,
    kind: &str,
) -> Result<BTreeMap<String, Vec<(String, String)>>, EmitError> {
    let mut out = BTreeMap::new();
    let Some(item) = doc.get(kind) else {
        return Ok(out);
    };
    let tables = item
        .as_table()
        .ok_or_else(|| bad(format!("`{kind}` is not a table")))?;
    for (name, keys) in tables {
        let keys = keys
            .as_table()
            .ok_or_else(|| bad(format!("`{kind}.{name}` is not a table")))?;
        let mut pairs = Vec::new();
        for (key, value) in keys {
            let at = format!("`{kind}.{name}.{key}`");
            if PROJECTED_KEYS.contains(&key) {
                return Err(bad(format!("{at}: projection writes this key")));
            }
            let rendered = match value.as_value() {
                Some(Value::String(text)) => crate::projection::frontmatter::quoted(text.value()),
                Some(Value::Boolean(flag)) => flag.value().to_string(),
                Some(Value::Integer(number)) => number.value().to_string(),
                _ => return Err(bad(format!("{at} is not a string, boolean or integer"))),
            };
            pairs.push((key.to_owned(), rendered));
        }
        out.insert(name.to_owned(), pairs);
    }
    Ok(out)
}

impl Overlay {
    /// The overlay in `dir`; an absent folder is an empty overlay.
    pub fn read(dir: &Path) -> Result<Self, EmitError> {
        let mut overlay = Self::default();
        let manifest = dir.join("overlay.toml");
        if manifest.is_file() {
            let text = std::fs::read_to_string(&manifest).map_err(bad)?;
            overlay = Self::parse(&text)?;
        }
        let files = dir.join("files");
        if files.is_dir() {
            for file in kit_files::walk(&files)? {
                let bytes = std::fs::read(files.join(&file.rel)).map_err(bad)?;
                overlay.files.insert(file.rel, bytes);
            }
        }
        Ok(overlay)
    }

    pub(crate) fn parse(text: &str) -> Result<Self, EmitError> {
        let doc: DocumentMut = text.parse().map_err(bad)?;
        if let Some((key, _)) = doc
            .iter()
            .find(|(key, _)| !["skill", "agent", "replace", "omit"].contains(key))
        {
            return Err(bad(format!("unknown key `{key}`")));
        }
        let mut replacements: BTreeMap<String, Vec<Replacement>> = BTreeMap::new();
        if let Some(entries) = doc.get("replace") {
            let entries = entries
                .as_array_of_tables()
                .ok_or_else(|| bad("`replace` is not an array of tables"))?;
            for entry in entries {
                let field = |key: &str| {
                    entry
                        .get(key)
                        .and_then(Item::as_str)
                        .map(str::to_owned)
                        .ok_or_else(|| bad(format!("a `replace` entry has no `{key}` string")))
                };
                replacements
                    .entry(field("path")?)
                    .or_default()
                    .push(Replacement {
                        find: field("find")?,
                        with: field("with")?,
                    });
            }
        }
        let mut omit = Vec::new();
        if let Some(paths) = doc.get("omit") {
            let paths = paths
                .as_array()
                .ok_or_else(|| bad("`omit` is not an array"))?;
            for path in paths {
                let path = path
                    .as_str()
                    .ok_or_else(|| bad("`omit` holds a non-string"))?;
                omit.push(path.to_owned());
            }
        }
        Ok(Self {
            omit,
            skill_keys: keyed(&doc, "skill")?,
            agent_keys: keyed(&doc, "agent")?,
            replacements,
            files: BTreeMap::new(),
        })
    }

    /// Keys added to the frontmatter of skill `name`.
    pub fn skill_keys(&self, name: &str) -> &[(String, String)] {
        self.skill_keys.get(name).map_or(&[], Vec::as_slice)
    }

    /// Keys added to the file of agent `name`.
    pub fn agent_keys(&self, name: &str) -> &[(String, String)] {
        self.agent_keys.get(name).map_or(&[], Vec::as_slice)
    }

    /// `text`, the projected body of the file installed at `path` (before
    /// any escaping for the file's format), with this overlay's passages
    /// swapped in. Each `find` must occur exactly once.
    pub fn amend(&self, path: &str, text: String) -> Result<String, EmitError> {
        let mut text = text;
        for swap in self.replacements.get(path).map_or(&[][..], Vec::as_slice) {
            let found = text.matches(&swap.find).count();
            if found != 1 {
                let start: String = swap.find.chars().take(60).collect();
                return Err(bad(format!(
                    "{path}: text to replace occurs {found} times, not once: {start:?}"
                )));
            }
            text = text.replacen(&swap.find, &swap.with, 1);
        }
        Ok(text)
    }

    /// Every name and path this overlay amends must exist: `skills` and
    /// `agents` are the kit's, `projected` the paths projection writes.
    pub fn check(
        &self,
        skills: &BTreeSet<String>,
        agents: &BTreeSet<String>,
        projected: &BTreeSet<String>,
    ) -> Result<(), EmitError> {
        if let Some(name) = self.skill_keys.keys().find(|n| !skills.contains(*n)) {
            return Err(bad(format!("`skill.{name}`: the kit has no such skill")));
        }
        if let Some(name) = self.agent_keys.keys().find(|n| !agents.contains(*n)) {
            return Err(bad(format!("`agent.{name}`: the kit has no such agent")));
        }
        let mut named = self.replacements.keys().chain(&self.omit);
        if let Some(path) = named.find(|p| !projected.contains(*p)) {
            return Err(bad(format!("nothing is projected to {path}")));
        }
        if let Some(path) = self.files.keys().find(|p| projected.contains(*p)) {
            return Err(bad(format!(
                "files/{path} would replace a projected file; amend it with `replace`"
            )));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const MANIFEST: &str = "[skill.cook]\ndisable-model-invocation = true\n\n\
                            [agent.tester]\nmodel_reasoning_effort = \"medium\"\nsandbox_mode = \"read-only\"\n\n\
                            [[replace]]\npath = \"a/SKILL.md\"\nfind = \"reads the model id\"\nwith = \"takes --tier\"\n";

    fn names(list: &[&str]) -> BTreeSet<String> {
        list.iter().map(|s| (*s).to_owned()).collect()
    }

    #[test]
    fn reads_keys_in_file_order_and_swaps_a_passage() {
        let overlay = Overlay::parse(MANIFEST).unwrap();
        assert_eq!(
            overlay.skill_keys("cook"),
            [("disable-model-invocation".to_owned(), "true".to_owned())]
        );
        assert_eq!(
            overlay.agent_keys("tester"),
            [
                ("model_reasoning_effort".to_owned(), "\"medium\"".to_owned()),
                ("sandbox_mode".to_owned(), "\"read-only\"".to_owned())
            ]
        );
        assert!(overlay.skill_keys("fix").is_empty());
        let out = overlay.amend("a/SKILL.md", "It reads the model id.".into());
        assert_eq!(out.unwrap(), "It takes --tier.");
        assert_eq!(overlay.amend("b.md", "same".into()).unwrap(), "same");
    }

    #[test]
    fn a_passage_that_is_gone_or_repeated_is_an_error() {
        let overlay = Overlay::parse(MANIFEST).unwrap();
        let gone = overlay.amend("a/SKILL.md", "nothing here".into());
        assert!(gone.unwrap_err().to_string().contains("occurs 0 times"));
        let twice = overlay.amend(
            "a/SKILL.md",
            "reads the model id; reads the model id".into(),
        );
        assert!(twice.unwrap_err().to_string().contains("occurs 2 times"));
    }

    #[test]
    fn an_entry_for_something_the_kit_lacks_is_an_error() {
        let overlay = Overlay::parse(MANIFEST).unwrap();
        let paths = names(&["a/SKILL.md"]);
        assert!(
            overlay
                .check(&names(&["cook"]), &names(&["tester"]), &paths)
                .is_ok()
        );
        let err = overlay.check(&names(&[]), &names(&["tester"]), &paths);
        assert!(err.unwrap_err().to_string().contains("no such skill"));
        let err = overlay.check(&names(&["cook"]), &names(&[]), &paths);
        assert!(err.unwrap_err().to_string().contains("no such agent"));
        let err = overlay.check(&names(&["cook"]), &names(&["tester"]), &names(&[]));
        assert!(
            err.unwrap_err()
                .to_string()
                .contains("nothing is projected")
        );
        assert!(
            Overlay::parse("[rules]\n")
                .unwrap_err()
                .to_string()
                .contains("unknown key")
        );
        let twice = Overlay::parse("[agent.tester]\nmodel = \"x\"\n").unwrap_err();
        assert!(twice.to_string().contains("projection writes this key"));
        let shape = Overlay::parse("[skill.cook]\nkeys = [1]\n").unwrap_err();
        assert!(
            shape
                .to_string()
                .contains("not a string, boolean or integer")
        );
        let mut shadow = Overlay::parse("").unwrap();
        shadow.files.insert("a/SKILL.md".into(), Vec::new());
        let err = shadow.check(&names(&[]), &names(&[]), &paths).unwrap_err();
        assert!(err.to_string().contains("would replace a projected file"));
    }

    #[test]
    fn reads_whole_files_and_treats_a_missing_folder_as_empty() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(
            Overlay::read(&dir.path().join("none")).unwrap(),
            Overlay::default()
        );
        std::fs::create_dir_all(dir.path().join("files/.codex/rules")).unwrap();
        std::fs::write(dir.path().join("files/.codex/rules/default.rules"), "x").unwrap();
        std::fs::write(dir.path().join("overlay.toml"), MANIFEST).unwrap();
        let overlay = Overlay::read(dir.path()).unwrap();
        assert_eq!(overlay.files[".codex/rules/default.rules"], b"x");
        assert_eq!(overlay.skill_keys("cook").len(), 1);
    }
}
