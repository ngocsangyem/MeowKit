//! `self-update`: find the newest `mewkit-v*` release on a channel, read its
//! `binary-manifest.json`, and replace the running binary with the archive
//! for this target once its size and SHA-256 match.
//!
//! Order: manifest → not older than the running version → archive size and
//! SHA-256 → binary taken out in memory → atomic replace. A manifest older
//! than the running binary (a replayed one) is refused, never applied.
mod aliases;
mod archive;
pub mod manifest;
mod replace;

use std::path::{Path, PathBuf};

pub use aliases::refresh as refresh_aliases;
pub use archive::binary_name;
pub use manifest::{Manifest, Target, current_target};

use crate::kit::http::Http;
use crate::kit::select::Release;
use crate::kit::{KitError, MAX_LISTING_BYTES, RELEASES_URL, checksum};

/// Tag prefix of the binary's releases; kit releases are plain `v*`.
pub const TAG_PREFIX: &str = "mewkit-v";
pub const MANIFEST_NAME: &str = "binary-manifest.json";
const MAX_MANIFEST_BYTES: u64 = 256 * 1024;
const MAX_ARCHIVE_BYTES: u64 = 64 * 1024 * 1024;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Channel {
    Stable,
    Beta,
}

/// What the channel offers compared with the running binary.
#[derive(Debug)]
pub struct Offer {
    pub running: String,
    pub latest: String,
    pub target: &'static str,
    /// The archive for this target; `None` when the channel is not ahead.
    pub archive: Option<Target>,
    /// The running version is below the manifest's `min_supported`.
    pub withdrawn: bool,
}

impl Offer {
    pub fn is_newer(&self) -> bool {
        manifest::version(&self.latest) > manifest::version(&self.running)
    }

    /// The running binary is newer than anything on the channel (a beta
    /// build asked about stable, or a release whose manifest is not up yet).
    pub fn is_ahead(&self) -> bool {
        manifest::version(&self.latest) < manifest::version(&self.running)
    }
}

/// The newest release on `channel` and what it means for `running`.
pub fn check(http: &dyn Http, running: &str, channel: Channel) -> Result<Offer, KitError> {
    let target = current_target().ok_or_else(|| {
        KitError::NoRelease(format!(
            "no release is built for {}/{}",
            std::env::consts::OS,
            std::env::consts::ARCH
        ))
    })?;
    let listing = http.get(RELEASES_URL, MAX_LISTING_BYTES)?;
    let releases: Vec<Release> = serde_json::from_slice(&listing)
        .map_err(|e| KitError::Http(format!("unreadable release listing: {e}")))?;
    let (tag_version, manifest_url) = newest(&releases, channel)?;
    let m = Manifest::parse(&http.get(&manifest_url, MAX_MANIFEST_BYTES)?)?;
    if manifest::version(&m.version) != manifest::version(&tag_version) {
        return Err(KitError::Checksum(format!(
            "binary-manifest.json says {} but its release is {tag_version}; refusing it",
            m.version
        )));
    }
    if channel == Channel::Stable && m.channel != "stable" {
        return Err(KitError::Checksum(format!(
            "release {} is published as {}, not stable; refusing it",
            m.version, m.channel
        )));
    }
    let running_v = manifest::version(running);
    let mut offer = Offer {
        running: running.to_owned(),
        withdrawn: running_v < manifest::version(&m.min_supported),
        latest: m.version.clone(),
        target,
        archive: None,
    };
    if offer.is_newer() {
        offer.archive = Some(m.targets.get(target).cloned().ok_or_else(|| {
            KitError::NoRelease(format!("release {} has no build for {target}", m.version))
        })?);
    }
    Ok(offer)
}

/// Download the offered archive, verify it and replace `exe`. Returns where
/// the previous binary was kept. Never moves to an older or equal version.
pub fn apply(http: &dyn Http, offer: &Offer, exe: &Path) -> Result<PathBuf, KitError> {
    let t = match &offer.archive {
        Some(t) if offer.is_newer() => t,
        _ => {
            return Err(KitError::Checksum(format!(
                "{} is not newer than the running {}; refusing it",
                offer.latest, offer.running
            )));
        }
    };
    let bytes = http.get(&t.url, t.size.min(MAX_ARCHIVE_BYTES) + 1)?;
    if bytes.len() as u64 != t.size {
        return Err(KitError::Checksum(format!(
            "{} is {} bytes, expected {}; refusing it",
            t.url,
            bytes.len(),
            t.size
        )));
    }
    checksum::verify(&bytes, &t.sha256, &t.url)?;
    let binary = archive::binary_in(&bytes)?;
    // Replace the real file, never a link to it (`mk`): replacing the link would leave
    // the binary old and the kept `.old` copy pointing at the new one.
    let exe = &exe.canonicalize().map_err(|source| KitError::Io {
        action: format!("resolving {}", exe.display()),
        source,
    })?;
    replace::replace(exe, &binary).map_err(|source| KitError::Io {
        action: format!("replacing {}", exe.display()),
        source,
    })
}

/// The tag version and manifest URL of the newest binary release on `channel`.
fn newest(releases: &[Release], channel: Channel) -> Result<(String, String), KitError> {
    releases
        .iter()
        .filter(|r| !r.draft && (channel == Channel::Beta || !r.prerelease))
        .filter_map(|r| {
            let v = r.tag_name.strip_prefix(TAG_PREFIX)?;
            let parsed = manifest::version(v)?;
            // Stable takes releases only, whatever the release's flag says.
            if channel == Channel::Stable && !parsed.is_release() {
                return None;
            }
            let url = r.assets.iter().find(|a| {
                a.name == MANIFEST_NAME
                    && a.browser_download_url
                        .starts_with(manifest::DOWNLOAD_PREFIX)
            })?;
            Some((parsed, v.to_owned(), url.browser_download_url.clone()))
        })
        .max_by(|a, b| a.0.cmp(&b.0))
        .map(|(_, v, url)| (v, url))
        .ok_or_else(|| {
            KitError::NoRelease(format!(
                "no {TAG_PREFIX}* release with {MANIFEST_NAME} on the {} channel",
                if channel == Channel::Beta {
                    "beta"
                } else {
                    "stable"
                }
            ))
        })
}

#[cfg(test)]
mod tests;
