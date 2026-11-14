//! The authoring-coherence suite: the default run, and each scoped check.
//!
//! One fixture carries a small but REAL authoring checkout — the CLI source
//! marker that makes the mode auto-detect, the always-on rules, one skill, one
//! agent with its generated index view, the registry, the lifecycle spec and
//! the docs that count them. Each case below compares the rows one check
//! produces about it.
use crate::npm;

/// Every authoring section at once, with the deliberate defects the fixture
/// carries (an un-pointed workflow source, two stray skill directories, no
/// committed substrate view, no pack manifest) reported exactly once each.
#[test]
fn the_authoring_run_reports_every_section() {
    let (ts, _) = npm::case("validate-authoring")
        .fixture("validate-authoring")
        .args(&["validate"])
        .run();
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stdout.contains("authoring (auto-detected)"),
        "the fixture stopped being detected as a source checkout: {}",
        ts.describe()
    );
    for section in [
        "Structure",
        "Hooks",
        "Portability",
        "Docs",
        "Workflow",
        "Gates",
        "Ownership",
        "Substrate",
        "Packs",
        "Plugin",
        "Inventory",
        "Rules",
        "Capabilities",
        "Agents",
        "Memory",
    ] {
        assert!(
            ts.stdout.contains(section),
            "the fixture stopped producing a {section} section: {}",
            ts.describe()
        );
    }
}

#[test]
fn the_authoring_run_under_strict_still_agrees() {
    npm::case("validate-authoring-strict")
        .fixture("validate-authoring")
        .args(&["validate", "--strict"])
        .run();
}

/// A prose source that does not carry the canonical pointer is drift.
#[test]
fn the_workflow_check_reports_an_unpointed_source() {
    let (ts, _) = npm::case("validate-workflow")
        .fixture("validate-authoring")
        .args(&["validate", "--workflow"])
        .run();
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stdout.contains("missing canonical source pointer"),
        "the fixture stopped exercising the pointer rule: {}",
        ts.describe()
    );
}

/// A skill directory with no SKILL.md is a structural anomaly, and the coverage
/// row counts it.
#[test]
fn the_ownership_check_reports_an_ungoverned_artifact() {
    let (ts, _) = npm::case("validate-ownership")
        .fixture("validate-authoring")
        .args(&["validate", "--ownership"])
        .run();
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stdout.contains("[FAIL] Ownership coverage"),
        "the fixture stopped exercising the coverage row: {}",
        ts.describe()
    );
}

/// Scoped `--substrate` is strict: the absent committed view is a FAIL here,
/// where the default run only WARNs about it.
#[test]
fn the_substrate_check_is_strict_when_scoped() {
    let (ts, _) = npm::case("validate-substrate")
        .fixture("validate-authoring")
        .args(&["validate", "--substrate"])
        .run();
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stdout.contains("[FAIL] Substrate view present"),
        "the strict severity is the point of the scoped run: {}",
        ts.describe()
    );
}

/// Same contrast for `--packs`: an absent manifest FAILS a CI step.
#[test]
fn the_packs_check_is_strict_when_scoped() {
    let (ts, _) = npm::case("validate-packs")
        .fixture("validate-authoring")
        .args(&["validate", "--packs"])
        .run();
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stdout.contains("[FAIL] Pack manifest installed"),
        "{}",
        ts.describe()
    );
}

#[test]
fn the_agents_check_compares_the_generated_view() {
    let (ts, _) = npm::case("validate-agents")
        .fixture("validate-authoring")
        .args(&["validate", "--agents"])
        .run();
    // The fixture's AGENTS_INDEX carries a correct generated view, so the
    // registry-view row must NOT appear as a failure.
    assert!(
        !ts.stdout.contains("AGENTS_INDEX generated view counts"),
        "the fixture's generated view stopped matching: {}",
        ts.describe()
    );
    assert!(ts.stdout.contains("Agents"), "{}", ts.describe());
}

#[test]
fn the_capabilities_check_reports_the_dead_overlay_keys() {
    let (ts, _) = npm::case("validate-capabilities")
        .fixture("validate-authoring")
        .args(&["validate", "--capabilities"])
        .run();
    // A partial install legitimately omits most flagship skills: WARN, and
    // exit 0, because that is not a broken contract.
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(
        ts.stdout
            .contains("AUTHORED_INTENTS key has no matching capability"),
        "{}",
        ts.describe()
    );
}

#[test]
fn the_capabilities_check_fails_under_strict_on_those_warnings() {
    let (ts, _) = npm::case("validate-capabilities-strict")
        .fixture("validate-authoring")
        .args(&["validate", "--capabilities", "--strict"])
        .run();
    assert_eq!(ts.code, 1, "{}", ts.describe());
}

#[test]
fn the_frontmatter_check_validates_the_fixtures_skill() {
    let (ts, _) = npm::case("validate-frontmatter")
        .fixture("validate-authoring")
        .args(&["validate", "--frontmatter"])
        .run();
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(
        ts.stdout.contains("[PASS] Skill frontmatter"),
        "{}",
        ts.describe()
    );
}

/// `--portable` adds the provider-contract matrix, which is provider data and
/// therefore identical for every project.
#[test]
fn portable_adds_the_provider_contract_matrix() {
    let (ts, _) = npm::case("validate-portable")
        .fixture("validate-flat-copy")
        .args(&["validate", "--mode", "flat-copy", "--portable"])
        .run();
    // One row per provider surface, plus the coverage row. The coverage COUNTS
    // live in that row's detail, which the renderer suppresses for a PASS, so
    // the rows themselves are what a reader (and this case) sees.
    assert_eq!(
        ts.stdout.matches("Provider contract: ").count(),
        18,
        "the surface matrix is what --portable adds: {}",
        ts.describe()
    );
    assert!(
        ts.stdout.contains("[PASS] Portability coverage"),
        "{}",
        ts.describe()
    );
    // And the honest statuses: an unsupported surface is N/A, not green.
    assert!(
        ts.stdout.contains("[N/A ] Provider contract: Cursor/skill"),
        "{}",
        ts.describe()
    );
}
