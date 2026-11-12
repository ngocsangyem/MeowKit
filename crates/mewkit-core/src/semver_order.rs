//! How two versions compare, and what makes them EQUAL.
//!
//! Split from [`super`] so the parse surface and the ordering rules each read on
//! one screen. Nothing here is a second comparator: `Ord` is the only ordering,
//! and `PartialEq` is defined in terms of it.

use std::cmp::Ordering;

use super::Version;

impl std::fmt::Display for Version {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.to_version_string())
    }
}

/// Equality IS comparison. A derived `PartialEq` compares `build`, which
/// [`Ord::cmp`] ignores per the semver spec, so `1.0.0+a != 1.0.0+b` while
/// `cmp` answered `Equal` — a broken `Ord`/`Eq` contract that makes `BTreeMap`
/// and `max()` disagree with `==`. Build metadata is still CARRIED; it is just
/// not part of identity, which is what node-semver's `eq` also reports.
impl PartialEq for Version {
    fn eq(&self, other: &Self) -> bool {
        self.cmp(other) == Ordering::Equal
    }
}

impl Eq for Version {}

impl std::hash::Hash for Version {
    fn hash<H: std::hash::Hasher>(&self, state: &mut H) {
        // Hash exactly the fields `cmp` compares, or two equal versions could
        // land in different buckets.
        self.major.hash(state);
        self.minor.hash(state);
        self.patch.hash(state);
        self.prerelease.hash(state);
    }
}

impl Ord for Version {
    fn cmp(&self, other: &Self) -> Ordering {
        self.major
            .cmp(&other.major)
            .then_with(|| self.minor.cmp(&other.minor))
            .then_with(|| self.patch.cmp(&other.patch))
            .then_with(|| compare_prerelease(&self.prerelease, &other.prerelease))
    }
}

impl PartialOrd for Version {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

/// A version WITHOUT a prerelease outranks one with it; otherwise identifiers are
/// compared pairwise and a longer list wins a tie.
fn compare_prerelease(a: &[String], b: &[String]) -> Ordering {
    match (a.is_empty(), b.is_empty()) {
        (true, true) => return Ordering::Equal,
        (true, false) => return Ordering::Greater,
        (false, true) => return Ordering::Less,
        (false, false) => {}
    }
    for (left, right) in a.iter().zip(b.iter()) {
        let order = match (left.parse::<u64>().ok(), right.parse::<u64>().ok()) {
            // Numeric identifiers compare numerically and always rank below
            // alphanumeric ones.
            (Some(l), Some(r)) => l.cmp(&r),
            (Some(_), None) => Ordering::Less,
            (None, Some(_)) => Ordering::Greater,
            (None, None) => left.as_str().cmp(right.as_str()),
        };
        if order != Ordering::Equal {
            return order;
        }
    }
    a.len().cmp(&b.len())
}
