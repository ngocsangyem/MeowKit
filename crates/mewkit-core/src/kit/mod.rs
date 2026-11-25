//! Find, verify and unpack the kit an install reads from.
//!
//! Network access is confined to [`http::Http`]; everything else works on
//! bytes and directories. A digest mismatch is terminal; a release without
//! `checksums.txt` or a kit without a contract is refused unless the caller
//! passes `allow_unverified`, which is then recorded as the install's origin.
mod cache;
pub mod channels;
pub(crate) mod checksum;
pub mod contract;
mod extract;
pub mod http;
pub(crate) mod select;
mod tree_digest;

use std::path::{Path, PathBuf};

pub use cache::{Entry as CachedKit, list as cached_kits};
pub use checksum::expected_for;
pub use contract::KitContract;
pub use select::{ARCHIVE_NAME, CHECKSUMS_NAME, Listed, Release};

use crate::fsx::sha256_hex;
use crate::ownership::Origin;
use http::Http;

pub const RELEASES_URL: &str =
    "https://api.github.com/repos/ngocsangyem/MeowKit/releases?per_page=100";
/// Archive and checksum URLs must point here; anything else in the listing is refused.
pub const DOWNLOAD_PREFIX: &str = "https://github.com/ngocsangyem/MeowKit/releases/download/";
pub(crate) const MAX_LISTING_BYTES: u64 = 8 * 1024 * 1024;
const MAX_ARCHIVE_BYTES: u64 = 256 * 1024 * 1024;
const MAX_CHECKSUMS_BYTES: u64 = 64 * 1024;

#[derive(Debug, thiserror::Error)]
pub enum KitError {
    #[error("{0}")]
    Http(String),
    #[error("{0}")]
    NoRelease(String),
    #[error("checksum: {0}")]
    Checksum(String),
    #[error("unverified kit: {0}")]
    Unverified(String),
    #[error("unsafe kit archive: {0}")]
    Unsafe(String),
    #[error("kit contract: {0}")]
    Contract(String),
    #[error("offline: {0}")]
    Offline(String),
    #[error("{action} failed: {source}")]
    Io {
        action: String,
        source: std::io::Error,
    },
}

/// Where the kit comes from.
pub enum Source {
    /// The newest kit release (`beta`: prereleases count too).
    Latest { beta: bool },
    /// Exactly this kit release tag.
    Tag(String),
    /// The newest cached kit, or the cached `version`; no network.
    Offline { version: Option<String> },
    /// A local `meowkit-release.zip` with its expected SHA-256.
    Archive { file: PathBuf, sha256: String },
    /// An unpacked kit directory, used as is (development only).
    Dir(PathBuf),
}

pub struct KitRequest<'a> {
    pub source: Source,
    pub allow_unverified: bool,
    /// The scope root the cache sits under; no directory between it and the
    /// cache may be a symlink.
    pub scope_root: &'a Path,
    pub cache_dir: &'a Path,
    /// This binary's version, checked against the kit's `mewkitMin`.
    pub binary_version: &'a str,
}

/// A kit ready to read, and how far it can be trusted.
#[derive(Debug)]
pub struct Kit {
    pub dir: PathBuf,
    pub version: String,
    pub digest: Option<String>,
    pub origin: Origin,
    pub contract: Option<KitContract>,
    pub notices: Vec<String>,
}

pub fn resolve(req: &KitRequest, http: &dyn Http) -> Result<Kit, KitError> {
    let mut notices = Vec::new();
    let accept =
        |c: Option<&KitContract>| contract::accept(c, req.allow_unverified, req.binary_version);
    let (entry, digest) = match &req.source {
        Source::Latest { beta } => fetch(req, http, None, *beta)?,
        Source::Tag(tag) => fetch(req, http, Some(tag), true)?,
        Source::Offline { version } => {
            let e = cache::newest(req.scope_root, req.cache_dir, version.as_deref())?;
            if !e.reverified && !req.allow_unverified {
                return Err(KitError::Unverified(format!(
                    "the cached kit {} does not match the tree recorded when it was verified \
                     (or was cached before mewkit recorded one); run once online to re-fetch it, \
                     or pass --allow-unverified-kit to use it",
                    e.meta.version
                )));
            }
            if e.meta.origin == Origin::Unverified && !req.allow_unverified {
                return Err(KitError::Unverified(format!(
                    "the cached kit {} was never verified; pass --allow-unverified-kit to use it",
                    e.meta.version
                )));
            }
            accept(e.contract.as_ref())?;
            let d = e.meta.digest.clone();
            (e, d)
        }
        Source::Archive { file, sha256 } => {
            let zip = std::fs::read(file).map_err(|source| KitError::Io {
                action: format!("reading {}", file.display()),
                source,
            })?;
            let digest = checksum::verify(&zip, sha256, &file.display().to_string())?;
            let e = cache::store(
                req.scope_root,
                req.cache_dir,
                None,
                &digest,
                Origin::Archive,
                &zip,
                &accept,
            )?;
            (e, digest)
        }
        Source::Dir(dir) => {
            let contract = contract::read(dir)?;
            accept(contract.as_ref())?;
            notices.push(format!(
                "installing from the local directory {}; its contents are not verified",
                dir.display()
            ));
            return Ok(Kit {
                dir: dir.clone(),
                version: contract
                    .as_ref()
                    .map_or_else(|| "local".into(), |c| c.kit_version.clone()),
                digest: None,
                origin: Origin::LocalDir,
                contract,
                notices,
            });
        }
    };
    if entry.contract.is_none() {
        notices.push(
            "this kit has no kit-contract.json; installing it anyway (--allow-unverified-kit)"
                .into(),
        );
    }
    if entry.meta.origin == Origin::Unverified {
        notices.push(format!(
            "kit {} was installed without a checksum",
            entry.meta.version
        ));
    }
    Ok(Kit {
        dir: entry.kit_dir,
        version: entry.meta.version,
        digest: Some(digest),
        origin: entry.meta.origin,
        contract: entry.contract,
        notices,
    })
}

/// The cached kit `version`, to compare an existing install against; never a
/// source to install from (that is [`Source::Offline`], which refuses an entry
/// that does not re-verify).
///
/// Here an entry that does not re-verify (edited, or cached by an older mewkit
/// before tree digests were recorded) is still returned, reported with origin
/// [`Origin::Unverified`]. That is safe because every caller only compares
/// these bytes, and acts only where they also equal what the ownership ledger
/// recorded as installed: an upgrade merge refuses a base whose hash is not the
/// ledger's, and a removal needs the file on disk to equal both the ledger and
/// this kit. A forged entry can therefore withhold a merge or a removal, never
/// cause one the ledger does not already allow. The symlink and tracked-cache
/// refusals still apply.
pub fn cached_for_comparison(
    scope_root: &Path,
    cache_dir: &Path,
    version: &str,
    allow_unverified: bool,
    binary_version: &str,
) -> Result<Kit, KitError> {
    let e = cache::newest(scope_root, cache_dir, Some(version))?;
    contract::accept(e.contract.as_ref(), allow_unverified, binary_version)?;
    Ok(Kit {
        dir: e.kit_dir,
        version: e.meta.version,
        digest: Some(e.meta.digest),
        origin: e.meta.origin,
        contract: e.contract,
        notices: Vec::new(),
    })
}

/// Whether kit version `requested` sorts below `installed` (both with or
/// without a leading `v`). `false` when either is not a kit version.
pub fn is_older_kit(requested: &str, installed: &str) -> bool {
    let parse = |v: &str| select::Version::parse(&format!("v{}", v.trim_start_matches('v')));
    matches!((parse(requested), parse(installed)), (Some(r), Some(i)) if r < i)
}

/// Kit releases that can be installed, newest first (network).
pub fn list_available(http: &dyn Http, beta: bool) -> Result<Vec<select::Listed>, KitError> {
    let listing = http.get(RELEASES_URL, MAX_LISTING_BYTES)?;
    let releases: Vec<Release> = serde_json::from_slice(&listing)
        .map_err(|e| KitError::Http(format!("unreadable release listing: {e}")))?;
    Ok(select::available(&releases, beta))
}

/// Download, verify and cache one release.
fn fetch(
    req: &KitRequest,
    http: &dyn Http,
    tag: Option<&str>,
    beta: bool,
) -> Result<(cache::Entry, String), KitError> {
    let listing = http.get(RELEASES_URL, MAX_LISTING_BYTES)?;
    let releases: Vec<Release> = serde_json::from_slice(&listing)
        .map_err(|e| KitError::Http(format!("unreadable release listing: {e}")))?;
    let chosen = select::choose(&releases, tag, beta)?;
    for url in std::iter::once(&chosen.archive_url).chain(&chosen.checksums_url) {
        if !url.starts_with(DOWNLOAD_PREFIX) {
            return Err(KitError::Http(format!(
                "refusing kit asset URL {url}: not a release download of this repository"
            )));
        }
    }
    let zip = http.get(&chosen.archive_url, MAX_ARCHIVE_BYTES)?;
    let (digest, origin) = match &chosen.checksums_url {
        Some(url) => {
            let body = http.get(url, MAX_CHECKSUMS_BYTES)?;
            let text = String::from_utf8_lossy(&body);
            let expected = checksum::expected_for(&text, ARCHIVE_NAME)?;
            (
                checksum::verify(&zip, &expected, ARCHIVE_NAME)?,
                Origin::Release,
            )
        }
        None if req.allow_unverified => (sha256_hex(&zip), Origin::Unverified),
        None => {
            return Err(KitError::Unverified(format!(
                "kit {} has no {CHECKSUMS_NAME}, so its archive cannot be verified; \
                 pass --allow-unverified-kit to install it anyway",
                chosen.version
            )));
        }
    };
    let accept =
        |c: Option<&KitContract>| contract::accept(c, req.allow_unverified, req.binary_version);
    let entry = cache::store(
        req.scope_root,
        req.cache_dir,
        Some(&chosen.version),
        &digest,
        origin,
        &zip,
        &accept,
    )?;
    Ok((entry, digest))
}
