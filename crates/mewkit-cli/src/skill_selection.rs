//! Which opt-in skills this machine installs.
//!
//! A skill whose SKILL.md sets `install_default: false` installs only when it
//! is selected: named in the selection file, inside a pack the install chose,
//! or already installed here. The kit's `retiredSkills` list overrides all of
//! that: a retired skill never installs. Everything else installs as before,
//! so a kit with neither marker plans exactly what it always did.
//!
//! Counting what is installed as selected is what keeps a later, smaller
//! default from removing skills during `upgrade`, `init` or `uninstall`: the
//! smaller default reaches fresh installs only.
use std::collections::BTreeSet;
use std::path::Path;

use mewkit_adapters::contract::Kit;
use mewkit_core::fsx::atomic_write;
use mewkit_core::validate::{has_pack_manifest, load_pack_manifest, resolve_packs};
use serde_json::{Value, json};

use crate::failure::Failure;
use crate::place::Place;

const VERSION: u32 = 1;

/// The machine-local selection file: `{"version": 1, "skills": [...]}`.
#[derive(Debug, Default)]
pub struct SelectionFile {
    pub version: u32,
    /// Kit skill names (`ghpm`, not `mk:ghpm`).
    pub skills: BTreeSet<String>,
}

/// The selection file here, or `None` when there is none yet.
pub fn load(place: &Place) -> Result<Option<SelectionFile>, Failure> {
    let path = place.selection_file();
    let Ok(text) = std::fs::read_to_string(&path) else {
        return Ok(None);
    };
    let invalid = |why: String| {
        Failure::failed(format!(
            "{} is not a valid skill selection ({why}); fix it or delete it",
            path.display()
        ))
    };
    let doc: Value = serde_json::from_str(&text).map_err(|e| invalid(e.to_string()))?;
    let version = doc.get("version").and_then(Value::as_u64).unwrap_or(0);
    let skills = match doc.get("skills") {
        None => BTreeSet::new(),
        Some(Value::Array(items)) => items
            .iter()
            .map(|v| {
                v.as_str()
                    .map(|s| s.strip_prefix("mk:").unwrap_or(s).to_owned())
            })
            .collect::<Option<_>>()
            .ok_or_else(|| invalid("`skills` must list skill names".into()))?,
        Some(_) => return Err(invalid("`skills` must be an array".into())),
    };
    Ok(Some(SelectionFile {
        version: u32::try_from(version).unwrap_or(0),
        skills,
    }))
}

/// The kit skills this install leaves out, by kit name.
pub fn disabled(place: &Place, kit: &Kit, packs: &[String]) -> Result<Vec<String>, Failure> {
    let claude = kit.dir.join(".claude");
    let retired = retired_skills(&claude)?;
    let opt_in = opt_in_skills(&claude);
    if retired.is_empty() && opt_in.is_empty() {
        return Ok(Vec::new());
    }
    let mut selected = load(place)?.map(|s| s.skills).unwrap_or_default();
    selected.extend(installed_skills(place, &kit_skills(&claude))?);
    selected.extend(pack_skills(&claude, packs)?);
    let mut out: BTreeSet<String> = opt_in.difference(&selected).cloned().collect();
    out.extend(retired);
    Ok(out.into_iter().collect())
}

/// Record every kit skill installed here as selected, keeping what the file
/// already names. Written by `upgrade`, so the first upgrade of an install
/// made before selections existed pins the skills it has.
pub fn record_installed(place: &Place, kit: &Kit) -> Result<(), Failure> {
    let claude = kit.dir.join(".claude");
    let mut file = load(place)?.unwrap_or_default();
    let before = file.skills.len();
    let fresh = !place.selection_file().exists();
    file.skills
        .extend(installed_skills(place, &kit_skills(&claude))?);
    if !fresh && file.skills.len() == before && file.version == VERSION {
        return Ok(());
    }
    file.version = VERSION;
    let doc = json!({ "version": file.version, "skills": file.skills });
    let mut bytes = serde_json::to_vec_pretty(&doc).expect("a selection serializes");
    bytes.push(b'\n');
    let path = place.selection_file();
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir)?;
    }
    atomic_write(&path, &bytes, None)?;
    Ok(())
}

/// Every skill directory in the kit's `.claude/skills/`.
fn kit_skills(claude: &Path) -> BTreeSet<String> {
    let Ok(entries) = std::fs::read_dir(claude.join("skills")) else {
        return BTreeSet::new();
    };
    entries
        .flatten()
        .filter(|e| e.path().join("SKILL.md").is_file())
        .filter_map(|e| e.file_name().into_string().ok())
        .collect()
}

/// Kit skills whose frontmatter sets `install_default: false`.
fn opt_in_skills(claude: &Path) -> BTreeSet<String> {
    kit_skills(claude)
        .into_iter()
        .filter(|name| {
            let file = claude.join("skills").join(name).join("SKILL.md");
            // Most SKILL.md files never mention the key; skip parsing those.
            let mentions =
                std::fs::read_to_string(&file).is_ok_and(|text| text.contains("install_default"));
            mentions
                && mewkit_core::validate::read_frontmatter(&file).get("install_default")
                    == Some(&serde_json::Value::Bool(false))
        })
        .collect()
}

/// The kit's `retiredSkills`, by kit name. Empty without a pack manifest.
fn retired_skills(claude: &Path) -> Result<BTreeSet<String>, Failure> {
    if !has_pack_manifest(claude) {
        return Ok(BTreeSet::new());
    }
    let manifest = load_pack_manifest(claude)
        .map_err(|e| Failure::failed(format!("pack-manifest.json: {e}")))?;
    Ok(manifest
        .retired_skills
        .iter()
        .map(|s| s.strip_prefix("mk:").unwrap_or(s).to_owned())
        .collect())
}

/// Skills inside the packs the install chose. None for a full install: taking
/// everything is not a choice of any one opt-in skill.
fn pack_skills(claude: &Path, packs: &[String]) -> Result<BTreeSet<String>, Failure> {
    if packs.is_empty() || !has_pack_manifest(claude) {
        return Ok(BTreeSet::new());
    }
    let manifest = load_pack_manifest(claude)
        .map_err(|e| Failure::failed(format!("pack-manifest.json: {e}")))?;
    let resolved =
        resolve_packs(claude, &manifest, packs).map_err(|e| Failure::failed(e.to_string()))?;
    Ok(resolved
        .paths
        .iter()
        .filter_map(|p| p.strip_prefix("skills/")?.split_once('/'))
        .map(|(dir, _)| dir.to_owned())
        .collect())
}

/// Kit skills some runtime here has installed. A projected runtime names its
/// skill directories `mk-<name>`, so both forms map back to the kit name.
fn installed_skills(place: &Place, known: &BTreeSet<String>) -> Result<BTreeSet<String>, Failure> {
    let mut out = BTreeSet::new();
    for runtime in place.installed()? {
        let Some(index) = place.index(runtime)? else {
            continue;
        };
        for path in index.paths.keys() {
            let mut parts = path.split('/');
            while let Some(part) = parts.next() {
                if part != "skills" {
                    continue;
                }
                let Some(dir) = parts.next() else { break };
                let name = dir.strip_prefix("mk-").filter(|n| known.contains(*n));
                if let Some(name) = name.or(known.contains(dir).then_some(dir)) {
                    out.insert(name.to_owned());
                }
                break;
            }
        }
    }
    Ok(out)
}
