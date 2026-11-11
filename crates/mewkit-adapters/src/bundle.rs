//! An authored runtime bundle the kit carries (Codex, Cursor), and which of
//! its skills to install.
use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;

use serde_json::Value;

use crate::contract::EmitError;
use crate::kit_files::{self, KitFile};

/// Where a runtime's bundle sits in the kit and how it lays out skills.
pub struct Spec {
    /// The runtime's display name, for errors.
    pub runtime: &'static str,
    /// The bundle's source path in the repo, which the kit artifact keeps.
    pub dir: &'static str,
    /// Where skill directories live inside `root`, with a trailing `/`.
    pub skills: &'static str,
}

pub struct Bundle {
    pub spec: &'static Spec,
    /// Files of `<kit>/<BUNDLE>/root`; their paths map 1:1 onto project paths.
    pub files: Vec<KitFile>,
    catalog: Option<Value>,
}

impl Bundle {
    pub fn open(kit_dir: &Path, spec: &'static Spec) -> Result<Self, EmitError> {
        let base = kit_dir.join(spec.dir);
        let root = base.join("root");
        if !root.is_dir() {
            return Err(EmitError::Kit(format!(
                "the kit has no {} bundle at {}/root (kit too old for mewkit-next?)",
                spec.runtime, spec.dir
            )));
        }
        let packs = base.join("catalog/skill-packs.json");
        let catalog = if packs.is_file() {
            Some(
                serde_json::from_str(&kit_files::read_text(&packs)?)
                    .map_err(|e| EmitError::Kit(format!("skill-packs.json: {e}")))?,
            )
        } else {
            None
        };
        Ok(Self {
            spec,
            files: kit_files::walk(&root)?,
            catalog,
        })
    }

    /// Every skill directory name in the bundle.
    pub fn skills(&self) -> BTreeSet<&str> {
        self.files
            .iter()
            .filter_map(|f| self.skill_of(&f.rel))
            .collect()
    }

    /// Skills to install. No packs: every skill, as the npm CLI installs today.
    /// Packs: the default pack, the named packs and their `dependsOn`, closed.
    /// `disabled` names skills by bundle name (`mk-x`) or kit name (`x`).
    /// The skill directory `rel` belongs to, if it is inside one.
    pub fn skill_of<'a>(&self, rel: &'a str) -> Option<&'a str> {
        rel.strip_prefix(self.spec.skills)?
            .split_once('/')
            .map(|(s, _)| s)
    }

    pub fn select(
        &self,
        packs: &[String],
        disabled: &[String],
    ) -> Result<BTreeSet<String>, EmitError> {
        let mut chosen: BTreeSet<String> = if packs.is_empty() {
            self.skills().into_iter().map(str::to_owned).collect()
        } else {
            self.pack_skills(packs)?
        };
        chosen.retain(|s| {
            !disabled
                .iter()
                .any(|d| d == s || s.strip_prefix("mk-") == Some(d.as_str()))
        });
        Ok(chosen)
    }

    fn pack_skills(&self, packs: &[String]) -> Result<BTreeSet<String>, EmitError> {
        let catalog = self.catalog.as_ref().ok_or_else(|| {
            EmitError::Kit(format!(
                "packs requested but the kit has no {} pack catalog",
                self.spec.runtime
            ))
        })?;
        let table: BTreeMap<&str, &Value> = catalog["packs"]
            .as_object()
            .ok_or_else(|| EmitError::Kit("skill-packs.json has no `packs` object".into()))?
            .iter()
            .map(|(k, v)| (k.as_str(), v))
            .collect();
        let mut todo: Vec<String> = packs.to_vec();
        if let Some(default) = catalog["defaultPack"].as_str() {
            todo.push(default.to_owned());
        }
        let mut seen = BTreeSet::new();
        let mut skills = BTreeSet::new();
        while let Some(name) = todo.pop() {
            if !seen.insert(name.clone()) {
                continue;
            }
            let pack = table.get(name.as_str()).ok_or_else(|| {
                EmitError::Kit(format!("unknown {} skill pack {name:?}", self.spec.runtime))
            })?;
            for s in pack["skills"].as_array().into_iter().flatten() {
                skills.insert(s.as_str().unwrap_or_default().to_owned());
            }
            for d in pack["dependsOn"].as_array().into_iter().flatten() {
                todo.push(d.as_str().unwrap_or_default().to_owned());
            }
        }
        Ok(skills)
    }
}
