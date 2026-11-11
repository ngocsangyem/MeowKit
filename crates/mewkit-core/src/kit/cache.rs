//! Project-local kit cache: `<cache>/<label>-<digest16>/{kit/, meta.json}`.
//!
//! An entry is extracted into a staging directory and renamed into place only
//! once it is complete and its contract has been read, so a half-written or
//! refused kit never appears in the cache.
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use super::contract::{self, KitContract};
use super::select::Version;
use super::{KitError, extract};
use crate::ownership::Origin;

const META: &str = "meta.json";

#[derive(Debug, Serialize, Deserialize)]
pub struct Meta {
    pub version: String,
    pub digest: String,
    pub origin: Origin,
}

/// One usable cache entry.
pub struct Entry {
    pub kit_dir: PathBuf,
    pub meta: Meta,
    pub contract: Option<KitContract>,
}

/// Extract `zip` (already verified as `digest`) into the cache. `version` is
/// the release version, or `None` to take it from the kit's contract.
/// `accept` runs on the extracted contract before the entry is published.
pub fn store(
    cache_dir: &Path,
    version: Option<&str>,
    digest: &str,
    origin: Origin,
    zip: &[u8],
    accept: &dyn Fn(Option<&KitContract>) -> Result<(), KitError>,
) -> Result<Entry, KitError> {
    std::fs::create_dir_all(cache_dir).map_err(io("creating the kit cache"))?;
    let label = version.unwrap_or("archive");
    let final_dir = cache_dir.join(format!("{label}-{}", &digest[..16]));
    if let Some(hit) = load(&final_dir)?.filter(|h| h.meta.digest == digest) {
        accept(hit.contract.as_ref())?;
        return Ok(hit);
    }
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
    };
    let json = serde_json::to_vec_pretty(&meta).expect("meta serializes");
    std::fs::write(staging.path().join(META), json).map_err(io("writing kit metadata"))?;
    let staged = staging.keep();
    if let Err(e) = std::fs::rename(&staged, &final_dir) {
        // Another process published the same digest first; use theirs.
        let _ = std::fs::remove_dir_all(&staged);
        return load(&final_dir)?.ok_or_else(|| io("publishing the kit")(e));
    }
    Ok(Entry {
        kit_dir: final_dir.join("kit"),
        meta,
        contract,
    })
}

/// Every readable cache entry, in no particular order. An unreadable entry is
/// skipped, as `--offline` skips it.
pub fn list(cache_dir: &Path) -> Vec<Entry> {
    let mut out: Vec<Entry> = std::fs::read_dir(cache_dir)
        .into_iter()
        .flatten()
        .flatten()
        .filter(|d| !d.file_name().to_string_lossy().starts_with('.'))
        .filter_map(|d| load(&d.path()).ok().flatten())
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
pub fn newest(cache_dir: &Path, version: Option<&str>) -> Result<Entry, KitError> {
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
    let Ok(text) = std::fs::read_to_string(dir.join(META)) else {
        return Ok(None);
    };
    let Ok(meta) = serde_json::from_str::<Meta>(&text) else {
        return Ok(None);
    };
    let kit_dir = dir.join("kit");
    let contract = contract::read(&kit_dir)?;
    Ok(Some(Entry {
        kit_dir,
        meta,
        contract,
    }))
}

fn io(action: &str) -> impl FnOnce(std::io::Error) -> KitError + '_ {
    move |source| KitError::Io {
        action: action.to_owned(),
        source,
    }
}
