// Mirrors the cases the TS callers of the npm `semver` package exercise, plus the
// oracle values that package produces (captured by running it) for the inputs the
// callers can actually see.
//
// Callers: `portable-manifest.ts` (valid / compare / numeric fallback),
// `providers/{cursor,codex}/capabilities.ts` (coerce / gte).
use std::cmp::Ordering;

use super::*;

#[test]
fn valid_matches_node_semver() {
    assert_eq!(valid("1.2.3").as_deref(), Some("1.2.3"));
    assert_eq!(valid("v1.2.3").as_deref(), Some("1.2.3"));
    assert_eq!(valid("  1.2.3 ").as_deref(), Some("1.2.3"));
    // Build metadata is not part of the canonical version string.
    assert_eq!(valid("1.2.3-beta.1+b5").as_deref(), Some("1.2.3-beta.1"));
    // Leading zeros, a missing patch and a range operator are all invalid.
    assert_eq!(valid("01.2.3"), None);
    assert_eq!(valid("1.2"), None);
    assert_eq!(valid("=1.2.3"), None);
    assert_eq!(valid("not-a-version"), None);
    assert_eq!(valid(""), None);
    assert_eq!(valid(&"1".repeat(300)), None);
}

#[test]
fn parse_keeps_prerelease_and_build_identifiers() {
    let v = parse("1.2.3-beta.11+build.7").expect("parses");
    assert_eq!((v.major, v.minor, v.patch), (1, 2, 3));
    assert_eq!(v.prerelease, vec!["beta".to_string(), "11".to_string()]);
    assert_eq!(v.build, vec!["build".to_string(), "7".to_string()]);
}

/// `semver.compare` oracle values.
#[test]
fn compare_orders_releases_and_prereleases() {
    let cmp = |a: &str, b: &str| parse(a).unwrap().cmp(&parse(b).unwrap());
    assert_eq!(cmp("1.0.0", "1.0.1"), Ordering::Less);
    assert_eq!(cmp("1.10.0", "1.9.0"), Ordering::Greater);
    // A prerelease precedes its release.
    assert_eq!(cmp("1.0.0-beta", "1.0.0"), Ordering::Less);
    // Numeric prerelease identifiers compare numerically, not lexically — the
    // ordering `upgrade --beta` would need if it ever ranked betas.
    assert_eq!(cmp("1.0.0-beta.2", "1.0.0-beta.10"), Ordering::Less);
    assert_eq!(cmp("1.0.0-rc.1", "1.0.0-beta.11"), Ordering::Greater);
    assert_eq!(cmp("1.0.0-alpha", "1.0.0-alpha.1"), Ordering::Less);
    assert_eq!(cmp("1.0.0-alpha.beta", "1.0.0-beta"), Ordering::Less);
    assert_eq!(cmp("1.0.0-alpha.1", "1.0.0-alpha.beta"), Ordering::Less);
    // Build metadata is ignored.
    assert_eq!(cmp("1.0.0+a", "1.0.0+b"), Ordering::Equal);
}

/// `semver.coerce` oracle values.
#[test]
fn coerce_matches_node_semver() {
    let coerced = |s: &str| coerce(s).map(|v| v.to_version_string());
    assert_eq!(coerced("3.13.10").as_deref(), Some("3.13.10"));
    assert_eq!(coerced("v2").as_deref(), Some("2.0.0"));
    assert_eq!(coerced("3.11").as_deref(), Some("3.11.0"));
    assert_eq!(coerced("x1.2.3").as_deref(), Some("1.2.3"));
    assert_eq!(coerced(".1").as_deref(), Some("1.0.0"));
    assert_eq!(coerced("42.6.7.9.3-alpha").as_deref(), Some("42.6.7"));
    // Still strict about what it emits: a leading zero is not silently dropped.
    assert_eq!(coerced("01.02.03"), None);
    // Cursor's CLI uses calendar versioning; it must not coerce into the IDE's
    // semver floor by accident.
    assert_eq!(coerced("2026.07.23"), None);
    assert_eq!(coerced("not-a-version"), None);
    assert_eq!(coerced(""), None);
}

/// The provider capability gate: `gte(coerce(detected), coerce(floor))`, as
/// `isCursorVersionSupported` / the Codex equivalent use it.
#[test]
fn coerced_at_least_gates_on_the_operational_floor() {
    const FLOOR: &str = "3.11.0";
    assert!(coerced_at_least("3.11.0", FLOOR));
    assert!(coerced_at_least("3.13.10", FLOOR));
    assert!(coerced_at_least("4.0.0", FLOOR));
    assert!(!coerced_at_least("3.10.9", FLOOR));
    assert!(!coerced_at_least("2.5.0", FLOOR));
    // Fail-closed on an unparseable version.
    assert!(!coerced_at_least("not-a-version", FLOOR));
    assert!(!coerced_at_least("", FLOOR));
}

/// `compareVersions` from `portable-manifest.ts`, which drives
/// `isEntryApplicable`: an entry whose `since` is ahead of the manifest version is
/// skipped, and an entry already applied is not reapplied.
#[test]
fn compare_versions_handles_the_absent_applied_version() {
    assert_eq!(compare_versions(None, "1.9.0"), Ordering::Less);
    assert_eq!(compare_versions(Some("1.9.0"), "1.10.0"), Ordering::Less);
    assert_eq!(compare_versions(Some("1.10.0"), "1.9.0"), Ordering::Greater);
    assert_eq!(compare_versions(Some("1.10.0"), "1.10.0"), Ordering::Equal);
    // A non-semver side falls back to numeric-aware collation.
    assert_eq!(compare_versions(Some("1.10"), "1.9-x"), Ordering::Greater);
}

/// `localeCompare(…, { numeric: true, sensitivity: "base" })` oracle values.
#[test]
fn natural_compare_is_numeric_aware_and_case_insensitive() {
    assert_eq!(natural_compare("1.10.0", "1.9.0"), Ordering::Greater);
    assert_eq!(natural_compare("1.10", "1.9-x"), Ordering::Greater);
    assert_eq!(natural_compare("A", "a"), Ordering::Equal);
    assert_eq!(natural_compare("2", "10"), Ordering::Less);
    assert_eq!(natural_compare("beta", "Beta2"), Ordering::Less);
    assert_eq!(natural_compare("1.2.3-rc1", "1.2.3"), Ordering::Greater);
    // Leading zeros do not change a numeric run's value.
    assert_eq!(natural_compare("1.07", "1.7"), Ordering::Equal);
}

#[test]
fn equality_agrees_with_comparison_on_build_metadata() {
    // node-semver: `semver.eq("1.0.0+a", "1.0.0+b")` is true and
    // `semver.compare(...)` is 0. A derived `PartialEq` said `!=` while `cmp`
    // said `Equal`, which breaks the `Ord`/`Eq` contract every sorted
    // collection relies on.
    let left = parse("1.0.0+a").expect("parses");
    let right = parse("1.0.0+b").expect("parses");
    assert_eq!(left, right);
    assert_eq!(left.cmp(&right), Ordering::Equal);
    // Build metadata is still carried, just not part of identity.
    assert_eq!(left.build, vec!["a".to_string()]);
    assert_ne!(left, parse("1.0.0-rc.1").expect("parses"));
}
