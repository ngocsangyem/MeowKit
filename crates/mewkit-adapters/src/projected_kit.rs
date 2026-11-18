//! A runtime's files as the kit installs them: the authored `.claude/` tree
//! projected for the runtime, plus the runtime's overlay, and which of its
//! skills to install.
use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;

use serde_json::Value;

use crate::agents_block;
use crate::contract::EmitError;
use crate::kit_files;
use crate::projection::{Overlay, Target, project_tree};

/// Where a runtime's overlay sits in the kit and how it lays out skills.
pub struct Spec {
    /// The runtime's display name, for errors.
    pub runtime: &'static str,
    /// The overlay's path in the kit: `overlay.toml`, `files/` and `catalog/`.
    pub overlay: &'static str,
    pub target: &'static Target,
}

/// The pack list that selects every pack in the catalog.
pub const ALL_PACKS: &str = "all";
/// The pack list for "no named pack": the catalog's default pack alone. Not a
/// valid pack name, so it cannot collide with one.
pub const DEFAULT_ONLY: &str = "@default";

/// One file to install, at its path in the project.
pub struct File {
    pub rel: String,
    pub bytes: Vec<u8>,
    /// `Some(0o755)` when the file it came from is executable.
    pub mode: Option<u32>,
}

pub struct ProjectedKit {
    pub spec: &'static Spec,
    pub files: Vec<File>,
    /// `<skills root>/`, the prefix of every skill folder.
    skills: String,
    catalog: Option<Value>,
}

impl ProjectedKit {
    pub fn open(kit_dir: &Path, spec: &'static Spec) -> Result<Self, EmitError> {
        let overlay_dir = kit_dir.join(spec.overlay);
        if !overlay_dir.join("overlay.toml").is_file() {
            return Err(EmitError::Kit(format!(
                "the kit has no {} overlay at {} (kit too old for this binary?)",
                spec.runtime, spec.overlay
            )));
        }
        let claude = kit_dir.join(".claude");
        if !claude.join("skills").is_dir() {
            return Err(EmitError::Kit(format!(
                "the kit has no .claude/skills to project for {}",
                spec.runtime
            )));
        }
        let overlay = Overlay::read(&overlay_dir)?;
        let target = spec.target;
        let skills = format!("{}/", target.skills_root);
        let mut tree = project_tree(&claude, &overlay, target)?;
        if tree.contains_key(agents_block::AGENTS_MD) {
            return Err(EmitError::Kit(format!(
                "the {} overlay ships its own AGENTS.md; the always-on text is {}",
                spec.runtime,
                agents_block::SOURCE
            )));
        }
        tree.insert(agents_block::AGENTS_MD.into(), agents_block::read(kit_dir)?);
        let files = tree
            .into_iter()
            .map(|(rel, bytes)| {
                // The execute bit comes from the file the bytes were made from.
                let source = if overlay.files.contains_key(&rel) {
                    overlay_dir.join("files").join(&rel)
                } else {
                    let inner = rel.strip_prefix(&skills).unwrap_or(&rel);
                    let inner = inner.strip_prefix(target.skill_prefix).unwrap_or(inner);
                    claude.join("skills").join(inner)
                };
                let mode = kit_files::mode(&source);
                File { rel, bytes, mode }
            })
            .collect();
        let packs = overlay_dir.join("catalog/skill-packs.json");
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
            files,
            skills,
            catalog,
        })
    }

    /// Every skill directory name the runtime gets.
    pub fn skills(&self) -> BTreeSet<&str> {
        self.files
            .iter()
            .filter_map(|f| self.skill_of(&f.rel))
            .collect()
    }

    /// Skills to install. No packs: every skill, as the npm CLI installs today.
    /// Packs: the default pack, the named packs and their `dependsOn`, closed.
    /// `disabled` names skills by installed name (`mk-x`) or kit name (`x`).
    /// The skill directory `rel` belongs to, if it is inside one.
    pub fn skill_of<'a>(&self, rel: &'a str) -> Option<&'a str> {
        rel.strip_prefix(self.skills.as_str())?
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
        // `all` names every pack; `DEFAULT_ONLY` names none, which leaves the
        // catalog's default pack (the npm CLI's reading of an empty list).
        let mut todo: Vec<String> = Vec::new();
        for name in packs {
            match name.as_str() {
                ALL_PACKS => todo.extend(table.keys().map(|k| (*k).to_owned())),
                DEFAULT_ONLY => {}
                _ => todo.push(name.clone()),
            }
        }
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
                let mut known: Vec<&str> = table.keys().copied().collect();
                known.sort_unstable();
                EmitError::Kit(format!(
                    "unknown skill pack: \"{name}\" (known: {})",
                    known.join(", ")
                ))
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
