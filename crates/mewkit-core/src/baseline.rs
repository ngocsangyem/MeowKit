//! The npm CLI's install baseline (`metadata.json`): reading it, saying what
//! it can prove about each file, and rebuilding it from the local kit cache.
//!
//! Adoption compares against the cache and NOTHING else. The tempting
//! alternative — record what is on disk as kit content — is exactly wrong: a
//! teammate's edited file would be recorded as the kit's with a matching
//! checksum, and the next uninstall would delete it as pristine. A file the
//! cache does not hold is recorded as the user's.
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use serde_json::{Map, Value, json};

use crate::fsx::{atomic_write, sha256_hex};
use crate::snapshot::iso_millis;
use crate::time_utc::now_millis;

const CACHE_REL: &str = ".meowkit/cache";
const OWNERS: [&str; 3] = ["meowkit", "user", "meowkit-modified"];
const LAYERS: [&str; 3] = ["core", "skill", "user"];

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FileEntry {
    pub path: String,
    pub owner: String,
    pub layer: String,
    pub checksum: String,
    pub base_checksum: String,
    pub installed_version: Option<String>,
    pub installed_at: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Metadata {
    pub version: String,
    pub scope: Option<String>,
    pub installed_at: String,
    pub files: Vec<FileEntry>,
    pub profile: Option<String>,
    pub packs: Option<Vec<String>>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Source {
    /// A canonical file carrying `schemaVersion`.
    New,
    /// A version-only record from an older CLI.
    Legacy,
    None,
}

impl Source {
    pub fn name(self) -> &'static str {
        match self {
            Source::New => "new",
            Source::Legacy => "legacy-metadata",
            Source::None => "none",
        }
    }
}

fn metadata_path(root: &Path) -> PathBuf {
    let canonical = root.join(".meowkit/metadata.json");
    let legacy = root.join(".claude/metadata.json");
    if !canonical.exists() && legacy.exists() {
        legacy
    } else {
        canonical
    }
}

fn text(v: &Value, key: &str) -> Option<String> {
    v.get(key).and_then(Value::as_str).map(String::from)
}

fn parse_entry(v: &Value) -> Result<FileEntry, String> {
    let need = |key: &str| text(v, key).ok_or(format!("files: {key} is required"));
    let owner = need("owner")?;
    let layer = need("layer")?;
    if !OWNERS.contains(&owner.as_str()) || !LAYERS.contains(&layer.as_str()) {
        return Err(format!(
            "files: invalid owner or layer for {}",
            need("path")?
        ));
    }
    Ok(FileEntry {
        path: need("path")?,
        owner,
        layer,
        checksum: need("checksum")?,
        base_checksum: need("baseChecksum")?,
        installed_version: text(v, "installedVersion"),
        installed_at: text(v, "installedAt"),
    })
}

/// Read the baseline. A file that carries `schemaVersion` but fails
/// validation is an `Err` naming the problem: a corrupt record must not read
/// as an absent one.
pub fn read_install_metadata(root: &Path) -> Result<(Source, Option<Metadata>), String> {
    let Ok(bytes) = std::fs::read(metadata_path(root)) else {
        return Ok((Source::None, None));
    };
    let parsed: Option<Value> = serde_json::from_slice(&bytes).ok();
    let Some(obj) = parsed.filter(Value::is_object) else {
        return Ok((Source::None, None));
    };
    if obj.get("schemaVersion").is_some() {
        let files = obj
            .get("files")
            .and_then(Value::as_array)
            .ok_or("files: Required")?;
        if text(&obj, "schemaVersion").as_deref() != Some("1.0") {
            return Err("schemaVersion: Invalid literal value, expected \"1.0\"".into());
        }
        return Ok((
            Source::New,
            Some(Metadata {
                version: text(&obj, "version").ok_or("version: Required")?,
                scope: text(&obj, "scope"),
                installed_at: text(&obj, "installedAt").ok_or("installedAt: Required")?,
                files: files.iter().map(parse_entry).collect::<Result<_, _>>()?,
                profile: text(&obj, "profile"),
                packs: obj.get("packs").and_then(Value::as_array).map(|p| {
                    p.iter()
                        .filter_map(Value::as_str)
                        .map(String::from)
                        .collect()
                }),
            }),
        ));
    }
    Ok(match text(&obj, "version") {
        Some(version) => (
            Source::Legacy,
            Some(Metadata {
                version,
                scope: None,
                installed_at: String::new(),
                files: Vec::new(),
                profile: None,
                packs: None,
            }),
        ),
        None => (Source::None, None),
    })
}

/// Publish `meta` at `.meowkit/metadata.json` and retire a pre-move
/// `.claude/metadata.json`, so a project holds exactly one baseline.
pub fn write_install_metadata(root: &Path, meta: &Metadata) -> std::io::Result<()> {
    let files: Vec<Value> = meta
        .files
        .iter()
        .map(|f| {
            let mut m = Map::new();
            m.insert("path".into(), f.path.clone().into());
            m.insert("owner".into(), f.owner.clone().into());
            m.insert("layer".into(), f.layer.clone().into());
            m.insert("checksum".into(), f.checksum.clone().into());
            m.insert("baseChecksum".into(), f.base_checksum.clone().into());
            for (k, v) in [
                ("installedVersion", &f.installed_version),
                ("installedAt", &f.installed_at),
            ] {
                if let Some(v) = v {
                    m.insert(k.into(), v.clone().into());
                }
            }
            Value::Object(m)
        })
        .collect();
    let mut doc = Map::new();
    doc.insert("schemaVersion".into(), "1.0".into());
    doc.insert("tool".into(), "meowkit".into());
    doc.insert("version".into(), meta.version.clone().into());
    if let Some(scope) = &meta.scope {
        doc.insert("scope".into(), scope.clone().into());
    }
    doc.insert("installedAt".into(), meta.installed_at.clone().into());
    doc.insert("files".into(), Value::Array(files));
    if let Some(profile) = &meta.profile {
        doc.insert("profile".into(), profile.clone().into());
    }
    if let Some(packs) = &meta.packs {
        doc.insert("packs".into(), json!(packs));
    }
    let body = format!(
        "{}\n",
        serde_json::to_string_pretty(&Value::Object(doc)).unwrap_or_default()
    );
    atomic_write(&root.join(".meowkit/metadata.json"), body.as_bytes(), None)?;
    // Only after the canonical file is published: removing the old one first
    // would leave no baseline at all if the write failed.
    let _ = std::fs::remove_file(root.join(".claude/metadata.json"));
    Ok(())
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Provenance {
    Verified,
    KnownModified,
    Unknown,
}

/// What one entry's provenance can be proven to be from local evidence alone.
/// A pristine match proves as-shipped identity ONLY against a trusted
/// (release-sourced) baseline: a legacy baseline is rebuilt from the disk
/// itself, so matching it proves nothing.
pub fn classify_provenance(entry: &FileEntry, trusted_baseline: bool) -> Provenance {
    if entry.base_checksum.is_empty() {
        Provenance::Unknown
    } else if entry.owner == "user" {
        Provenance::Verified
    } else if entry.owner == "meowkit-modified" || entry.checksum != entry.base_checksum {
        Provenance::KnownModified
    } else if trusted_baseline {
        Provenance::Verified
    } else {
        Provenance::Unknown
    }
}

// ── the local kit cache ─────────────────────────────────────────────────────

/// The version the cache records, or `None` when it has none.
pub fn cached_kit_version(root: &Path) -> Option<String> {
    let text = std::fs::read_to_string(root.join(CACHE_REL).join("version")).ok()?;
    let text = text.trim();
    (!text.is_empty()).then(|| text.to_string())
}

/// The cached file for one project-relative path. `rel` comes from a file in
/// the project, so containment is asserted rather than left to a lookup miss.
fn cached_kit_file(root: &Path, rel: &str) -> Option<PathBuf> {
    let dir = root.join(CACHE_REL);
    let mut file = dir.clone();
    for part in rel.split('/') {
        match part {
            "" | "." => {}
            ".." => {
                file.pop();
            }
            other => file.push(other),
        }
    }
    (file.starts_with(&dir) && file != dir && file.is_file()).then_some(file)
}

/// Whether git reports anything under the cache as tracked, checked per run.
fn cache_is_tracked(root: &Path) -> bool {
    Command::new("git")
        .args(["ls-files", "--", CACHE_REL])
        .current_dir(root)
        .stderr(Stdio::null())
        .output()
        .is_ok_and(|o| o.status.success() && !String::from_utf8_lossy(&o.stdout).trim().is_empty())
}

/// `Ok(())` when the cache can be trusted, else what to tell the user.
pub fn assess_cache(root: &Path, recorded: Option<&str>) -> Result<(), String> {
    let cached = cached_kit_version(root);
    let Some(cached) = cached.filter(|_| root.join(CACHE_REL).exists()) else {
        return Err("the local kit cache is missing, so there is nothing to check this file's content against. Run `mewkit upgrade` to re-fetch it.".into());
    };
    if cache_is_tracked(root) {
        return Err(format!(
            "git reports files under {CACHE_REL} as tracked, so the cache is reachable from a pull request and is not trusted. Untrack it, then run `mewkit upgrade`."
        ));
    }
    match recorded {
        None | Some("unknown") => Err("the baseline does not record which release it came from, so the cache cannot be checked against it. Run `mewkit upgrade` to record one.".into()),
        Some(r) if r != cached => Err(format!("the cache holds kit {cached} while this install records {r}, so its content is the wrong release to compare against. Run `mewkit upgrade` to refresh it.")),
        Some(_) => Ok(()),
    }
}

// ── adoption ────────────────────────────────────────────────────────────────

const USER_FILES: [&str; 8] = [
    "CLAUDE.md",
    "meowkit.config.json",
    ".env",
    "env.example",
    "mcp.json.example",
    "mcp.json",
    "gitignore.meowkit",
    "meowkit.manifest.json",
];
const CORE_DIRS: [&str; 6] = ["agents", "commands", "hooks", "modes", "rules", "scripts"];

/// `core`, `skill` or `user`, by where the path sits under `.claude/`.
pub fn classify_layer(rel: &str) -> &'static str {
    let base = rel.rsplit('/').next().unwrap_or("");
    if USER_FILES.contains(&base) || USER_FILES.contains(&rel) {
        return "user";
    }
    match rel.split('/').next().unwrap_or("") {
        "memory" | "logs" => "user",
        "skills" => "skill",
        "settings.json" => "core",
        top if CORE_DIRS.contains(&top) => "core",
        _ => "user",
    }
}

/// Every regular file under `dir`, relative to it, each directory's entries
/// in name order. Symlinks are skipped, never followed, and the CLI's own
/// state files are not content.
pub fn collect_files(dir: &Path) -> Vec<String> {
    const SKIP: [&str; 6] = [
        "__pycache__",
        "node_modules",
        ".DS_Store",
        "meowkit.manifest.json",
        "metadata.json",
        ".metadata.lock",
    ];
    fn walk(dir: &Path, prefix: &str, out: &mut Vec<String>) {
        let Ok(read) = std::fs::read_dir(dir) else {
            return;
        };
        let mut names: Vec<String> = read
            .filter_map(Result::ok)
            .map(|e| e.file_name().to_string_lossy().into_owned())
            .collect();
        names.sort();
        for name in names {
            if SKIP.contains(&name.as_str()) {
                continue;
            }
            let rel = if prefix.is_empty() {
                name.clone()
            } else {
                format!("{prefix}/{name}")
            };
            let Ok(meta) = std::fs::symlink_metadata(dir.join(&name)) else {
                continue;
            };
            if meta.file_type().is_symlink() {
                continue;
            }
            if meta.is_dir() {
                walk(&dir.join(&name), &rel, out);
            } else {
                out.push(rel);
            }
        }
    }
    let mut out = Vec::new();
    walk(dir, "", &mut out);
    out
}

pub struct Counts {
    pub meowkit: usize,
    pub modified: usize,
    pub user: usize,
}

pub struct Plan {
    pub meta: Metadata,
    pub counts: Counts,
}

fn hash_file(path: &Path) -> String {
    sha256_hex(&std::fs::read(path).unwrap_or_default())
}

#[cfg(test)]
#[path = "baseline_tests.rs"]
mod baseline_tests;

/// Plan the baseline without writing it, so a caller can report or apply.
pub fn plan_adoption(root: &Path) -> Result<Plan, (String, Option<&'static str>)> {
    let existing = read_install_metadata(root)
        .map_err(|e| (format!("Corrupt install metadata.json: {e}"), None))?
        .1;
    let recorded = existing
        .as_ref()
        .map(|m| m.version.clone())
        .or_else(|| cached_kit_version(root));
    if let Err(reason) = assess_cache(root, recorded.as_deref()) {
        return Err((
            format!("Cannot adopt a baseline: {reason}"),
            Some(
                "mewkit upgrade — it re-fetches the kit and writes the cache this would compare against",
            ),
        ));
    }
    let Some(version) = cached_kit_version(root) else {
        return Err((
            format!("Cannot adopt a baseline: {CACHE_REL} records no version."),
            Some("mewkit upgrade"),
        ));
    };
    let claude = root.join(".claude");
    let installed_at = iso_millis(now_millis());
    let mut counts = Counts {
        meowkit: 0,
        modified: 0,
        user: 0,
    };
    let mut files = Vec::new();
    for rel in collect_files(&claude) {
        // The classifier's own scope exclusion, so a baseline and a
        // classification never disagree about what is installed.
        if rel.starts_with("worktrees/") || rel.starts_with("logs/") {
            continue;
        }
        let on_disk = hash_file(&claude.join(&rel));
        let layer = classify_layer(&rel);
        let cached = if layer == "user" {
            None
        } else {
            cached_kit_file(root, &format!(".claude/{rel}"))
        };
        let entry = |owner: &str, layer: &str, base: String| FileEntry {
            path: rel.clone(),
            owner: owner.into(),
            layer: layer.into(),
            checksum: on_disk.clone(),
            base_checksum: base,
            installed_version: Some(version.clone()),
            installed_at: Some(installed_at.clone()),
        };
        // Either the kit does not ship this path or the install classifies it as
        // the user's. Both make it the user's whatever it looks like.
        let Some(cached) = cached else {
            counts.user += 1;
            files.push(entry("user", "user", on_disk.clone()));
            continue;
        };
        let kit_hash = hash_file(&cached);
        let clean = kit_hash == on_disk;
        if clean {
            counts.meowkit += 1
        } else {
            counts.modified += 1
        }
        files.push(entry(
            if clean { "meowkit" } else { "meowkit-modified" },
            layer,
            kit_hash,
        ));
    }
    let meta = Metadata {
        version,
        scope: Some(
            existing
                .as_ref()
                .and_then(|m| m.scope.clone())
                .unwrap_or_else(|| "local".into()),
        ),
        installed_at: existing
            .as_ref()
            .map_or(installed_at, |m| m.installed_at.clone()),
        files,
        profile: existing.as_ref().and_then(|m| m.profile.clone()),
        packs: existing.and_then(|m| m.packs),
    };
    Ok(Plan { meta, counts })
}
