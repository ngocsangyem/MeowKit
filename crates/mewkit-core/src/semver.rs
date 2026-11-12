//! The semver operations the TypeScript CLI actually uses — and only those.
//!
//! Three call sites import the npm `semver` package, between them using four
//! operations:
//!
//! | TS call site | Operations |
//! |---|---|
//! | `migrate/reconcile/portable-manifest.ts` | `valid`, `compare`, and a `localeCompare(numeric)` fallback for non-semver versions |
//! | `migrate/providers/cursor/capabilities.ts` | `coerce`, `gte` |
//! | `migrate/providers/codex/capabilities.ts` | `coerce`, `gte` |
//!
//! No crate: the Rust `semver` crate implements the spec but NOT node-semver's
//! `coerce` (a lenient "find a version inside this string" scan) and not the
//! numeric-collation fallback, which are the two non-obvious behaviours a caller
//! depends on. Pulling it in would leave both hand-written anyway, plus a second
//! parser whose strictness has to be kept in step with this one.
//!
//! `kit::select::Version` is a SEPARATE, narrower comparator for release TAGS
//! (`vX.Y.Z[-pre]`, no build metadata, leading zeros accepted) used by the binary
//! update path. It is not a second implementation of this module's contract and
//! must not be swapped for one silently: folding the two together changes which
//! tags `update` accepts, so it belongs in the phase that owns that path.
//!
//! `upgrade --beta` does NOT compare versions semantically — it matches the
//! GitHub `prerelease` flag (or a `-beta` / `-rc` substring for a local release)
//! and compares the resolved version to the installed one with string equality. So
//! prerelease ORDERING is exercised here through `compare`, which is where the spec
//! rule (a prerelease precedes its release) is implemented.
use std::cmp::Ordering;
use std::sync::LazyLock;

use regex::Regex;

pub use natural_order::natural_compare;

#[path = "semver_natural_order.rs"]
mod natural_order;

#[path = "semver_order.rs"]
mod order;

/// node-semver's length ceiling; anything longer is invalid rather than slow.
const MAX_LENGTH: usize = 256;

/// The official semver.org pattern, plus the optional leading `v` node-semver
/// accepts. Leading zeros in a numeric identifier are invalid.
///
/// `[0-9]` where node-semver writes `\d`: a JS `\d` is ASCII, Rust's is
/// `\p{Nd}`, and a version string reaches tags, filenames and comparisons where
/// an Arabic-Indic digit must not parse as a number.
static FULL: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r"^v?(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-((?:0|[1-9][0-9]*|[0-9]*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9][0-9]*|[0-9]*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$",
    )
    .expect("semver pattern compiles")
});

/// node-semver's `COERCE`: the first `major[.minor[.patch]]` run in the string.
static COERCE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(^|[^0-9])([0-9]{1,16})(?:\.([0-9]{1,16}))?(?:\.([0-9]{1,16}))?(?:$|[^0-9])")
        .expect("coerce pattern compiles")
});

#[derive(Clone, Debug)]
pub struct Version {
    pub major: u64,
    pub minor: u64,
    pub patch: u64,
    /// Dot-separated prerelease identifiers; empty for a release.
    pub prerelease: Vec<String>,
    /// Dot-separated build identifiers. Carried, never compared.
    pub build: Vec<String>,
}

impl Version {
    /// The canonical `version` string node-semver exposes: build metadata is NOT
    /// part of it, which is why `valid("1.2.3+b5")` is `"1.2.3"`.
    pub fn to_version_string(&self) -> String {
        let mut out = format!("{}.{}.{}", self.major, self.minor, self.patch);
        if !self.prerelease.is_empty() {
            out.push('-');
            out.push_str(&self.prerelease.join("."));
        }
        out
    }
}

/// Strict parse — the `semver.parse` / `new SemVer` surface. Surrounding
/// whitespace is trimmed, as node-semver does.
pub fn parse(version: &str) -> Option<Version> {
    let trimmed = version.trim();
    if trimmed.len() > MAX_LENGTH {
        return None;
    }
    let caps = FULL.captures(trimmed)?;
    let field = |i: usize| caps.get(i)?.as_str().parse::<u64>().ok();
    let parts = |i: usize| -> Vec<String> {
        caps.get(i)
            .map(|m| m.as_str().split('.').map(str::to_string).collect())
            .unwrap_or_default()
    };
    Some(Version {
        major: field(1)?,
        minor: field(2)?,
        patch: field(3)?,
        prerelease: parts(4),
        build: parts(5),
    })
}

/// `semver.valid`: the canonical version string, or `None`.
pub fn valid(version: &str) -> Option<String> {
    parse(version).map(|v| v.to_version_string())
}

/// `semver.coerce`: the first version-shaped run in the string, with missing
/// minor/patch defaulted to 0. Still strict about what it produces, so a run with
/// a leading zero (`2026.07.23`) coerces to nothing rather than to a wrong answer.
pub fn coerce(version: &str) -> Option<Version> {
    let caps = COERCE.captures(version)?;
    let part = |i: usize| caps.get(i).map_or("0", |m| m.as_str());
    parse(&format!(
        "{}.{}.{}",
        caps.get(2)?.as_str(),
        part(3),
        part(4)
    ))
}

/// `semver.gte(coerce(version), coerce(min))` — the provider capability gate.
/// Fail-closed: an unparseable version is NOT supported.
pub fn coerced_at_least(version: &str, min: &str) -> bool {
    match (coerce(version), coerce(min)) {
        (Some(v), Some(m)) => v >= m,
        _ => false,
    }
}

/// `compareVersions` from `portable-manifest.ts`: semver where both sides are
/// valid semver, numeric-aware string collation otherwise, and "no version at all
/// is older than anything".
pub fn compare_versions(a: Option<&str>, b: &str) -> Ordering {
    let Some(a) = a else {
        return Ordering::Less;
    };
    match (parse(a), parse(b)) {
        (Some(left), Some(right)) => left.cmp(&right),
        _ => natural_compare(a, b),
    }
}

#[cfg(test)]
#[path = "semver_tests.rs"]
mod tests;
