//! The kit's release channels, for `upgrade --check` and `upgrade --list`:
//! which release is newest on each channel and which one an upgrade would
//! install. Read-only — nothing here downloads or caches a kit.
use std::path::Path;

use super::http::Http;
use super::select::{Listed, Version};
use super::{KitError, cached_kits, list_available};

/// Releases newest first, with the head of each channel picked out.
#[derive(Debug, PartialEq, Eq)]
pub struct Channels {
    pub stable: Option<Listed>,
    pub beta: Option<Listed>,
    pub releases: Vec<Listed>,
}

impl Channels {
    /// Split a newest-first listing into its two channels.
    pub fn from_listing(releases: Vec<Listed>) -> Self {
        let stable = releases.iter().find(|r| !r.prerelease).cloned();
        let beta = releases.iter().find(|r| r.prerelease).cloned();
        Self {
            stable,
            beta,
            releases,
        }
    }

    /// The release `upgrade` would install: the newest beta with `beta` (the
    /// newest stable when no beta exists), else the newest stable.
    pub fn target(&self, beta: bool) -> Option<&Listed> {
        if beta {
            self.beta.as_ref().or(self.stable.as_ref())
        } else {
            self.stable.as_ref()
        }
    }
}

/// Every installable release on GitHub, prereleases included (network).
pub fn online(http: &dyn Http) -> Result<Channels, KitError> {
    Ok(Channels::from_listing(list_available(http, true)?))
}

/// The kits already in `cache_dir`, as if they were the published releases:
/// what `--offline` can compare against without a network request.
pub fn offline(cache_dir: &Path) -> Channels {
    let mut kits: Vec<(Version, Listed)> = cached_kits(cache_dir)
        .into_iter()
        .filter_map(|k| {
            let version = k.meta.version.trim_start_matches('v').to_owned();
            let parsed = Version::parse(&format!("v{version}"))?;
            Some((
                parsed,
                Listed {
                    prerelease: version.contains('-'),
                    version,
                    // A cached kit was verified when it was cached.
                    verified: true,
                },
            ))
        })
        .collect();
    kits.sort_by(|a, b| b.0.cmp(&a.0));
    kits.dedup_by(|a, b| a.1.version == b.1.version);
    Channels::from_listing(kits.into_iter().map(|(_, l)| l).collect())
}

#[cfg(test)]
#[path = "channels_tests.rs"]
mod tests;
