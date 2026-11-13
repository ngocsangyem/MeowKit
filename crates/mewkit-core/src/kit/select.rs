//! Pick a kit release from the GitHub releases listing.
//!
//! Kit releases are tagged `vX.Y.Z`; the binary's own releases are tagged
//! `mewkit-vX.Y.Z` and carry no kit archive, so they are never candidates.
use serde::Deserialize;

use super::KitError;

pub const ARCHIVE_NAME: &str = "meowkit-release.zip";
pub const CHECKSUMS_NAME: &str = "checksums.txt";

#[derive(Debug, Deserialize)]
pub struct Release {
    pub tag_name: String,
    #[serde(default)]
    pub draft: bool,
    #[serde(default)]
    pub prerelease: bool,
    #[serde(default)]
    pub assets: Vec<Asset>,
}

#[derive(Debug, Deserialize)]
pub struct Asset {
    pub name: String,
    pub browser_download_url: String,
}

/// What to download for one release.
#[derive(Debug, PartialEq, Eq)]
pub struct Chosen {
    pub version: String,
    pub archive_url: String,
    /// `None` for releases published before checksums existed.
    pub checksums_url: Option<String>,
}

/// The newest eligible release, or exactly `tag` when given.
pub fn choose(releases: &[Release], tag: Option<&str>, beta: bool) -> Result<Chosen, KitError> {
    let mut best: Option<(Version, &Release)> = None;
    for r in releases {
        let Some(version) = Version::parse(&r.tag_name) else {
            continue;
        };
        let wanted = match tag {
            Some(t) => {
                !r.draft
                    && (r.tag_name == t
                        || r.tag_name.trim_start_matches('v') == t.trim_start_matches('v'))
            }
            None => !r.draft && (beta || !r.prerelease),
        };
        if wanted
            && asset(r, ARCHIVE_NAME).is_some()
            && best.as_ref().is_none_or(|(b, _)| version > *b)
        {
            best = Some((version, r));
        }
    }
    let (_, r) = best.ok_or_else(|| {
        KitError::NoRelease(match tag {
            Some(t) => format!("no kit release {t} with a {ARCHIVE_NAME} asset"),
            None => format!("no kit release with a {ARCHIVE_NAME} asset"),
        })
    })?;
    Ok(Chosen {
        version: r.tag_name.trim_start_matches('v').to_owned(),
        archive_url: asset(r, ARCHIVE_NAME).expect("checked above").to_owned(),
        checksums_url: asset(r, CHECKSUMS_NAME).map(str::to_owned),
    })
}

/// One installable kit release, as `versions` lists it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Listed {
    pub version: String,
    pub prerelease: bool,
    /// Publishes a `checksums.txt`, so it installs without `--allow-unverified-kit`.
    pub verified: bool,
}

/// Every non-draft kit release with an archive, newest first; prereleases
/// only with `beta`.
pub fn available(releases: &[Release], beta: bool) -> Vec<Listed> {
    let mut out: Vec<(Version, Listed)> = releases
        .iter()
        .filter(|r| !r.draft && (beta || !r.prerelease) && asset(r, ARCHIVE_NAME).is_some())
        .filter_map(|r| {
            Some((
                Version::parse(&r.tag_name)?,
                Listed {
                    version: r.tag_name.trim_start_matches('v').to_owned(),
                    prerelease: r.prerelease,
                    verified: asset(r, CHECKSUMS_NAME).is_some(),
                },
            ))
        })
        .collect();
    out.sort_by(|a, b| b.0.cmp(&a.0));
    out.into_iter().map(|(_, l)| l).collect()
}

fn asset<'a>(r: &'a Release, name: &str) -> Option<&'a str> {
    r.assets
        .iter()
        .find(|a| a.name == name)
        .map(|a| a.browser_download_url.as_str())
}

/// `vMAJOR.MINOR.PATCH[-pre]`. Field order is the sort order: a release
/// (`release: true`) beats every prerelease of the same core version, and
/// prerelease identifiers compare as semver says (`beta.10` above `beta.2`).
#[derive(Debug, PartialEq, Eq, PartialOrd, Ord)]
pub(crate) struct Version {
    core: (u64, u64, u64),
    release: bool,
    pre: Vec<Ident>,
}

/// One dot-separated prerelease identifier; numeric ones sort first.
#[derive(Debug, PartialEq, Eq, PartialOrd, Ord)]
enum Ident {
    Num(u64),
    Alpha(String),
}

impl Version {
    pub(crate) fn parse(tag: &str) -> Option<Self> {
        let rest = tag.strip_prefix('v')?;
        let (core, pre) = rest.split_once('-').unwrap_or((rest, ""));
        let mut nums = core.split('.').map(|n| n.parse::<u64>().ok());
        let core = (nums.next()??, nums.next()??, nums.next()??);
        if nums.next().is_some() {
            return None;
        }
        Some(Self {
            core,
            release: pre.is_empty(),
            pre: pre
                .split('.')
                .filter(|i| !i.is_empty())
                .map(|i| {
                    i.parse()
                        .map_or_else(|_| Ident::Alpha(i.to_owned()), Ident::Num)
                })
                .collect(),
        })
    }

    pub(crate) fn is_release(&self) -> bool {
        self.release
    }
}

#[cfg(test)]
#[path = "select_tests.rs"]
mod tests;
