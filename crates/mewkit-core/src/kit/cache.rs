//! Project-local kit cache: `<cache>/<label>-<digest16>/{kit/, meta.json}`.
//!
//! An entry is extracted into a staging directory and renamed into place only
//! once it is complete and its contract has been read, so a half-written or
//! refused kit never appears in the cache.
//!
//! The cache sits in the project, so a cloned repository can pre-seed it. An
//! entry is used only when it re-verifies: online against a fresh extraction of
//! the verified archive, offline against the tree digest recorded when it was
//! cached. A cache git tracks is refused outright, since it arrived with the
//! repository rather than from a download.
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use super::contract::{self, KitContract};
use super::select::Version;
use super::tree_digest::tree_digest;
use super::{KitError, extract};
use crate::baseline::git_tracks_files_under;
use crate::fsx::{atomic_write_in, create_dir_all_in};
use crate::ownership::Origin;

const META: &str = "meta.json";

#[derive(Debug, Serialize, Deserialize)]
pub struct Meta {
    pub version: String,
    pub digest: String,
    pub origin: Origin,
    /// [`tree_digest`] of `kit/` when it was cached; absent in entries cached
    /// before it was recorded, which therefore cannot be re-verified offline.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tree: Option<String>,
}

/// One usable cache entry.
pub struct Entry {
    pub kit_dir: PathBuf,
    pub meta: Meta,
    pub contract: Option<KitContract>,
    /// Whether `kit/` still matches the tree recorded when it was cached. An
    /// entry that does not is reported with origin [`Origin::Unverified`].
    pub reverified: bool,
}

/// Refuse a cache reached through a symlink under `root`, or one git tracks.
fn check_cache(root: &Path, cache_dir: &Path) -> Result<(), KitError> {
    crate::fsx::refuse_symlinks(root, cache_dir).map_err(io("opening the kit cache"))?;
    if cache_dir.is_dir() && git_tracks_files_under(cache_dir, ".") {
        return Err(KitError::Unverified(format!(
            "git reports files under {} as tracked, so the kit cache arrived with the \
             repository and is not trusted; untrack it and run once online",
            cache_dir.display()
        )));
    }
    Ok(())
}

/// Extract `zip` (already verified as `digest`) into the cache. `version` is
/// the release version, or `None` to take it from the kit's contract.
/// `accept` runs on the extracted contract before the entry is published.
pub fn store(
    root: &Path,
    cache_dir: &Path,
    version: Option<&str>,
    digest: &str,
    origin: Origin,
    zip: &[u8],
    accept: &dyn Fn(Option<&KitContract>) -> Result<(), KitError>,
) -> Result<Entry, KitError> {
    check_cache(root, cache_dir)?;
    create_dir_all_in(root, cache_dir).map_err(io("creating the kit cache"))?;
    let label = version.unwrap_or("archive");
    let final_dir = cache_dir.join(format!("{label}-{}", &digest[..16]));
    // Always extracted from the verified archive: an existing entry under this
    // name is used only when its tree is byte-for-byte what the archive holds.
    let staging = tempfile::Builder::new()
        .prefix(".staging-")
        .tempdir_in(cache_dir)
        .map_err(io("staging the kit"))?;
    let kit_dir = staging.path().join("kit");
    std::fs::create_dir(&kit_dir).map_err(io("staging the kit"))?;
    extract::extract(zip, &kit_dir)?;
    let contract = contract::read(&kit_dir)?;
    accept(contract.as_ref())?;
    let meta = Meta {
        version: version
            .map(str::to_owned)
            .or_else(|| contract.as_ref().map(|c| c.kit_version.clone()))
            .unwrap_or_else(|| "unknown".into()),
        digest: digest.to_owned(),
        origin,
        tree: tree_digest(&kit_dir),
    };
    let json = serde_json::to_vec_pretty(&meta).expect("meta serializes");
    std::fs::write(staging.path().join(META), &json).map_err(io("writing kit metadata"))?;
    let entry = |meta| Entry {
        kit_dir: final_dir.join("kit"),
        meta,
        contract,
        reverified: true,
    };
    if let Ok(existing) = std::fs::symlink_metadata(&final_dir) {
        let same = existing.is_dir()
            && meta.tree.is_some()
            && tree_digest(&final_dir.join("kit")) == meta.tree;
        if same {
            // Rewritten so the entry records this run's verified origin and tree.
            atomic_write_in(root, &final_dir.join(META), &json, None)
                .map_err(io("writing kit metadata"))?;
            return Ok(entry(meta));
        }
        // Not what the archive holds: replaced, never used.
        remove_entry(&final_dir).map_err(io("replacing an unverifiable cache entry"))?;
    }
    let staged = staging.keep();
    if let Err(e) = std::fs::rename(&staged, &final_dir) {
        // Another process published the same digest first; use theirs only
        // when it re-verifies against the tree just extracted.
        let _ = std::fs::remove_dir_all(&staged);
        return load(&final_dir)?
            .filter(|hit| hit.reverified && hit.meta.tree == meta.tree)
            .map(|_| entry(meta))
            .ok_or_else(|| io("publishing the kit")(e));
    }
    Ok(entry(meta))
}

/// Remove a cache entry, or the link standing in for one.
fn remove_entry(dir: &Path) -> std::io::Result<()> {
    if std::fs::symlink_metadata(dir)?.is_dir() {
        std::fs::remove_dir_all(dir)
    } else {
        std::fs::remove_file(dir)
    }
}

/// Every readable cache entry that re-verifies, newest first. An unreadable or
/// unverifiable entry is skipped, and a cache git tracks lists nothing.
pub fn list(cache_dir: &Path) -> Vec<Entry> {
    if cache_dir.is_dir() && git_tracks_files_under(cache_dir, ".") {
        return Vec::new();
    }
    let mut out: Vec<Entry> = std::fs::read_dir(cache_dir)
        .into_iter()
        .flatten()
        .flatten()
        .filter(|d| !d.file_name().to_string_lossy().starts_with('.'))
        .filter_map(|d| load(&d.path()).ok().flatten())
        .filter(|e| e.reverified)
        .collect();
    // Newest first, by version rather than by name (2.10.0 above 2.9.0).
    out.sort_by_cached_key(|e| {
        std::cmp::Reverse(Version::parse(&format!(
            "v{}",
            e.meta.version.trim_start_matches('v')
        )))
    });
    out
}

/// The newest cached kit, or the newest of `version`, for `--offline`.
pub fn newest(root: &Path, cache_dir: &Path, version: Option<&str>) -> Result<Entry, KitError> {
    check_cache(root, cache_dir)?;
    let mut best: Option<(Option<Version>, Entry)> = None;
    let dirs = std::fs::read_dir(cache_dir).into_iter().flatten().flatten();
    for d in dirs {
        if d.file_name().to_string_lossy().starts_with('.') {
            continue;
        }
        let Some(entry) = load(&d.path())? else {
            continue;
        };
        let v = entry.meta.version.trim_start_matches('v');
        if version.is_some_and(|want| want.trim_start_matches('v') != v) {
            continue;
        }
        let parsed = Version::parse(&format!("v{v}"));
        if best.as_ref().is_none_or(|(b, _)| parsed > *b) {
            best = Some((parsed, entry));
        }
    }
    best.map(|(_, e)| e).ok_or_else(|| {
        KitError::Offline(match version {
            Some(v) => format!(
                "kit {v} is not in the cache at {}; run once online",
                cache_dir.display()
            ),
            None => format!(
                "no kit in the cache at {}; run once online",
                cache_dir.display()
            ),
        })
    })
}

fn load(dir: &Path) -> Result<Option<Entry>, KitError> {
    // A linked entry, or a linked meta.json, is not one this cache wrote.
    let is_link = |p: &Path| std::fs::symlink_metadata(p).is_ok_and(|m| m.file_type().is_symlink());
    if is_link(dir) || is_link(&dir.join(META)) {
        return Ok(None);
    }
    let Ok(text) = std::fs::read_to_string(dir.join(META)) else {
        return Ok(None);
    };
    let Ok(mut meta) = serde_json::from_str::<Meta>(&text) else {
        return Ok(None);
    };
    let kit_dir = dir.join("kit");
    let reverified = meta.tree.is_some() && tree_digest(&kit_dir) == meta.tree;
    if !reverified {
        meta.origin = Origin::Unverified;
    }
    let contract = contract::read(&kit_dir)?;
    Ok(Some(Entry {
        kit_dir,
        meta,
        contract,
        reverified,
    }))
}

fn io(action: &str) -> impl FnOnce(std::io::Error) -> KitError + '_ {
    move |source| KitError::Io {
        action: action.to_owned(),
        source,
    }
}
