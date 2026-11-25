//! Where the kit comes from: the flags every installing command shares.
use std::path::PathBuf;

use clap::Args;
use mewkit_adapters::ScopeKind;
use mewkit_adapters::contract::{Kit, OwnershipIndex};
use mewkit_core::kit::http::UreqHttp;
use mewkit_core::kit::{self, CHECKSUMS_NAME, KitRequest, Source};
use mewkit_core::ownership::Origin;

use crate::failure::Failure;
use crate::place::Place;
use crate::prompt::{Ask, Flag, default_prompt};

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
    /// Use an unpacked kit directory as is (development only). Its content is
    /// not verified, so it needs --allow-unverified-kit; with --global it must
    /// also be confirmed at a terminal, since its hooks then run in every project.
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
    /// `yes` is the command's `--yes`: it never stands in for confirming a
    /// global install from a local directory.
    pub fn resolve(&self, place: &Place, yes: bool) -> Result<Kit, Failure> {
        self.check_kit_dir(place, yes)?;
        let cache = place.cache_dir();
        let req = KitRequest {
            source: self.source()?,
            allow_unverified: self.allow_unverified_kit,
            scope_root: &place.scope.root,
            cache_dir: &cache,
            binary_version: mewkit_core::VERSION,
        };
        Ok(kit::resolve(&req, &UreqHttp::default())?)
    }
}

impl KitArgs {
    /// `--kit-version` older than a kit installed here replaces newer files
    /// with older ones (hooks included), so it needs `--force`, and says so.
    pub fn check_downgrade(&self, place: &Place, force: bool) -> Result<(), Failure> {
        let Some(requested) = &self.kit_version else {
            return Ok(());
        };
        let mut newest: Option<String> = None;
        for runtime in place.installed()? {
            if let Some(index) = place.index(runtime)?
                && newest
                    .as_deref()
                    .is_none_or(|n| kit::is_older_kit(n, &index.kit_version))
            {
                newest = Some(index.kit_version);
            }
        }
        let Some(installed) = newest.filter(|n| kit::is_older_kit(requested, n)) else {
            return Ok(());
        };
        if !force {
            return Err(Failure::usage(format!(
                "--kit-version {requested} is older than the installed kit {installed}; \
                 pass --force to downgrade"
            )));
        }
        eprintln!("warning: downgrading the kit from {installed} to {requested} (--force)");
        Ok(())
    }

    /// `--kit-dir` installs whatever the directory holds, hooks included, with
    /// no checksum. It is refused unless the caller also says the kit is
    /// unverified, and a global install from one (hooks written to the home
    /// directory's runtime settings, so they run in every project) is refused
    /// unless a person confirms it at a terminal.
    fn check_kit_dir(&self, place: &Place, yes: bool) -> Result<(), Failure> {
        let Some(dir) = &self.kit_dir else {
            return Ok(());
        };
        if !self.allow_unverified_kit {
            return Err(Failure::usage(
                "--kit-dir installs a local directory nobody verified; pass --allow-unverified-kit with it",
            ));
        }
        if place.scope.kind != ScopeKind::Global {
            return Ok(());
        }
        if yes || !crate::prompt::is_interactive() {
            return Err(Failure::usage(format!(
                "--kit-dir with --global installs {} into your home directory, where its hooks run \
                 in every project; that is refused with --yes or without a terminal to confirm it",
                dir.display()
            )));
        }
        let message = format!(
            "Install the unverified local kit {} into your home directory? Its hooks will run in every project.",
            dir.display()
        );
        let ask = Ask::new(&message, Flag::new("--kit-dir"));
        if default_prompt().confirm(&ask, false)? {
            Ok(())
        } else {
            Err(Failure::usage("not confirmed: nothing was installed"))
        }
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
        scope_root: &place.scope.root,
        cache_dir: &cache,
        binary_version: mewkit_core::VERSION,
    };
    kit::resolve(&req, &UreqHttp::default()).ok()
}

/// [`cached`] for comparison only: an entry that no longer re-verifies is
/// still returned. Safe only for callers that act on the bytes where they also
/// equal the ownership ledger; see [`kit::cached_for_comparison`].
fn cached_for_comparison(place: &Place, version: &str, allow_unverified: bool) -> Option<Kit> {
    kit::cached_for_comparison(
        &place.scope.root,
        &place.cache_dir(),
        version,
        allow_unverified,
        mewkit_core::VERSION,
    )
    .ok()
}

/// The kit an existing install was made from, from the cache only, to compare
/// against: `doctor` reads the hook coverage it shipped, which only shapes a
/// report. `None` when it is not cached (or came from a local directory, which
/// is never cached).
pub fn installed_kit(place: &Place, index: &OwnershipIndex) -> Option<Kit> {
    if index.origin == Origin::LocalDir {
        return None;
    }
    cached_for_comparison(
        place,
        &index.kit_version,
        index.origin == Origin::Unverified,
    )
}

/// The kit an existing install was made from, from the cache or downloaded
/// when the cache has lost it, to compare the install against: the upgrade's
/// merge base and the hashes that corroborate a removal. Both act only where
/// the bytes also equal the ownership ledger, so a cached entry that no longer
/// re-verifies is acceptable here.
///
/// The cache is machine-local and outside git, so a clone, another machine or
/// a cleaned project has an install record and no copy of the kit behind it.
/// Without that copy nothing the new kit dropped can be told from a file of
/// the user's, and every retired file would stay. An install made from a
/// published release names that release, so it is downloaded again and
/// checked as any other. An install from a local archive or directory names
/// no release, and `may_fetch` is false for a command told to stay offline.
pub fn previous_kit_for_comparison(
    place: &Place,
    index: &OwnershipIndex,
    may_fetch: bool,
) -> Option<Kit> {
    installed_via(place, index, may_fetch, cached_for_comparison)
}

/// As [`previous_kit_for_comparison`], but for a caller that INSTALLS from the
/// kit (a runtime replanned and written from it), so a cached entry must
/// re-verify.
pub fn installed_kit_or_fetch(
    place: &Place,
    index: &OwnershipIndex,
    may_fetch: bool,
) -> Option<Kit> {
    installed_via(place, index, may_fetch, cached)
}

type CacheLookup = fn(&Place, &str, bool) -> Option<Kit>;

fn installed_via(
    place: &Place,
    index: &OwnershipIndex,
    may_fetch: bool,
    lookup: CacheLookup,
) -> Option<Kit> {
    if index.origin == Origin::LocalDir {
        return None;
    }
    let published = matches!(index.origin, Origin::Release | Origin::Unverified);
    release_via(
        place,
        &index.kit_version,
        index.origin == Origin::Unverified,
        may_fetch && published,
        lookup,
    )
}

/// The kit release `version`: from the cache, else downloaded when `may_fetch`.
/// A cached entry must re-verify: callers build an install record from it.
pub fn release(
    place: &Place,
    version: &str,
    allow_unverified: bool,
    may_fetch: bool,
) -> Option<Kit> {
    release_via(place, version, allow_unverified, may_fetch, cached)
}

fn release_via(
    place: &Place,
    version: &str,
    allow_unverified: bool,
    may_fetch: bool,
    lookup: CacheLookup,
) -> Option<Kit> {
    if let Some(kit) = lookup(place, version, allow_unverified) {
        return Some(kit);
    }
    if !may_fetch {
        return None;
    }
    let cache = place.cache_dir();
    let req = KitRequest {
        source: Source::Tag(format!("v{}", version.trim_start_matches('v'))),
        allow_unverified,
        scope_root: &place.scope.root,
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
