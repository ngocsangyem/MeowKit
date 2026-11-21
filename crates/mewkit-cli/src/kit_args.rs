//! Where the kit comes from: the flags every installing command shares.
use std::path::PathBuf;

use clap::Args;
use mewkit_adapters::contract::{Kit, OwnershipIndex};
use mewkit_core::kit::http::UreqHttp;
use mewkit_core::kit::{self, CHECKSUMS_NAME, KitRequest, Source};
use mewkit_core::ownership::Origin;

use crate::failure::Failure;
use crate::place::Place;

#[derive(Args, Debug, Default)]
pub struct KitArgs {
    /// Install exactly this kit release (e.g. v2.16.0).
    #[arg(long, value_name = "TAG")]
    pub kit_version: Option<String>,
    /// Let a prerelease be the newest kit.
    #[arg(long)]
    pub beta: bool,
    /// Make no network request: use the newest kit in this scope's cache
    /// (or the cached --kit-version).
    #[arg(long)]
    pub offline: bool,
    /// Install from a local meowkit-release.zip; its SHA-256 comes from
    /// --kit-sha256 or a checksums.txt beside it.
    #[arg(long, value_name = "ZIP", conflicts_with_all = ["offline", "kit_dir"])]
    pub kit_archive: Option<PathBuf>,
    /// The expected SHA-256 of the --kit-archive zip, in hex.
    #[arg(long, value_name = "HEX", requires = "kit_archive")]
    pub kit_sha256: Option<String>,
    /// Use an unpacked kit directory as is (development only).
    #[arg(long, value_name = "DIR", hide = true, conflicts_with = "offline")]
    pub kit_dir: Option<PathBuf>,
    /// Accept a kit with no checksum or no kit-contract.json.
    #[arg(long)]
    pub allow_unverified_kit: bool,
}

impl KitArgs {
    fn source(&self) -> Result<Source, Failure> {
        if let Some(dir) = &self.kit_dir {
            return Ok(Source::Dir(dir.clone()));
        }
        if let Some(file) = &self.kit_archive {
            let sha256 = match &self.kit_sha256 {
                Some(hex) => hex.clone(),
                None => archive_sha256(file)?,
            };
            return Ok(Source::Archive {
                file: file.clone(),
                sha256,
            });
        }
        Ok(match (self.offline, &self.kit_version) {
            (true, version) => Source::Offline {
                version: version.clone(),
            },
            (false, Some(tag)) => Source::Tag(tag.clone()),
            (false, None) => Source::Latest { beta: self.beta },
        })
    }

    /// Whether this command may download a kit it was not handed: false when
    /// it was told to stay offline or given its kit as a local file.
    pub fn may_fetch(&self) -> bool {
        !self.offline && self.kit_dir.is_none() && self.kit_archive.is_none()
    }

    /// The kit these flags name, verified and unpacked into `place`'s cache.
    pub fn resolve(&self, place: &Place) -> Result<Kit, Failure> {
        let cache = place.cache_dir();
        let req = KitRequest {
            source: self.source()?,
            allow_unverified: self.allow_unverified_kit,
            cache_dir: &cache,
            binary_version: mewkit_core::VERSION,
        };
        Ok(kit::resolve(&req, &UreqHttp::default())?)
    }
}

/// The cached kit `version`, with no network request.
fn cached(place: &Place, version: &str, allow_unverified: bool) -> Option<Kit> {
    let cache = place.cache_dir();
    let req = KitRequest {
        source: Source::Offline {
            version: Some(version.to_owned()),
        },
        allow_unverified,
        cache_dir: &cache,
        binary_version: mewkit_core::VERSION,
    };
    kit::resolve(&req, &UreqHttp::default()).ok()
}

/// The kit an existing install was made from, from the cache only: what
/// upgrade and uninstall need to corroborate a removal. `None` when it is
/// not cached (or came from a local directory, which is never cached).
pub fn installed_kit(place: &Place, index: &OwnershipIndex) -> Option<Kit> {
    if index.origin == Origin::LocalDir {
        return None;
    }
    cached(
        place,
        &index.kit_version,
        index.origin == Origin::Unverified,
    )
}

/// As [`installed_kit`], downloading the release when the cache has lost it.
///
/// The cache is machine-local and outside git, so a clone, another machine or
/// a cleaned project has an install record and no copy of the kit behind it.
/// Without that copy nothing the new kit dropped can be told from a file of
/// the user's, and every retired file would stay. An install made from a
/// published release names that release, so it is downloaded again and
/// checked as any other. An install from a local archive or directory names
/// no release, and `may_fetch` is false for a command told to stay offline.
pub fn installed_kit_or_fetch(
    place: &Place,
    index: &OwnershipIndex,
    may_fetch: bool,
) -> Option<Kit> {
    if index.origin == Origin::LocalDir {
        return None;
    }
    let published = matches!(index.origin, Origin::Release | Origin::Unverified);
    release(
        place,
        &index.kit_version,
        index.origin == Origin::Unverified,
        may_fetch && published,
    )
}

/// The kit release `version`: from the cache, else downloaded when `may_fetch`.
pub fn release(
    place: &Place,
    version: &str,
    allow_unverified: bool,
    may_fetch: bool,
) -> Option<Kit> {
    if let Some(kit) = cached(place, version, allow_unverified) {
        return Some(kit);
    }
    if !may_fetch {
        return None;
    }
    let cache = place.cache_dir();
    let req = KitRequest {
        source: Source::Tag(format!("v{}", version.trim_start_matches('v'))),
        allow_unverified,
        cache_dir: &cache,
        binary_version: mewkit_core::VERSION,
    };
    kit::resolve(&req, &UreqHttp::default()).ok()
}

/// What an index records about the kit an install was made from.
pub fn contract_label(kit: &Kit) -> String {
    kit.contract
        .as_ref()
        .map_or_else(|| "none".into(), |c| c.kit_contract.to_string())
}

fn archive_sha256(file: &std::path::Path) -> Result<String, Failure> {
    let sums = file.with_file_name(CHECKSUMS_NAME);
    let text = std::fs::read_to_string(&sums).map_err(|_| {
        Failure::usage(format!(
            "--kit-archive needs --kit-sha256 or a {CHECKSUMS_NAME} beside {}",
            file.display()
        ))
    })?;
    let name = file
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    Ok(kit::expected_for(&text, &name)?)
}
