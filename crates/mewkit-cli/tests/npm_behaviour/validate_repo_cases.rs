//! `validate` run over THIS repository's own kit, not a fixture.
//!
//! A fixture holds what its author thought to put in it. The kit in this
//! checkout holds ~hundreds of prose files, every real hook and agent, the
//! actual registry, the real lifecycle spec, the real docs-reference contract
//! and the committed capability overlay — so these are the cases that catch a
//! check that is right about a toy tree and wrong about the tree it ships
//! against.
//!
//! They run in the repository root with a temp HOME, and nothing they invoke
//! writes: `validate` reads. The npm CLI's output on this tree is not frozen —
//! the tree changes with every commit, so it would go stale at once — which
//! leaves each case to assert that the run actually read the kit.
use crate::npm;

/// Run one argv in the repository root and check that it wrote nothing.
fn compare_in_repo(name: &'static str, args: &[&str]) -> npm::Run {
    let scratch = tempfile::Builder::new()
        .prefix("mewkit-repo-validate-")
        .tempdir()
        .expect("create the scratch dir");
    let home = scratch.path().join("home");
    std::fs::create_dir_all(&home).expect("create the temp HOME");

    let run = npm::run_rust(&npm::repo_root(), &home, args, &[], None);
    assert!(
        !home.join(".meowkit").exists(),
        "[{name}] a read-only check wrote into HOME"
    );
    run
}

/// Hold a repo case to actually having read the kit: two CLIs that both report
/// nothing agree, and that is not the property under test.
fn assert_substantial(name: &str, run: &npm::Run, needle: &str) {
    assert!(
        run.stdout.contains(needle),
        "[{name}] the repository stopped producing {needle:?}: {}",
        run.describe()
    );
}

/// The headline case: `validate` with no flags, in a source checkout, so the
/// mode auto-detects to `authoring` and EVERY check in the suite runs against
/// the real kit.
#[test]
fn the_default_run_matches_on_this_repositorys_own_kit() {
    let run = compare_in_repo("repo-validate-default", &["validate"]);
    assert_substantial("repo-validate-default", &run, "authoring (auto-detected)");
    // Every section the authoring suite produces, on real data.
    for section in [
        "Structure",
        "Hooks",
        "Portability",
        "Docs",
        "Workflow",
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
        assert_substantial("repo-validate-default", &run, section);
    }
    // The real kit produces tens of rows across those sections; a handful
    // would mean a check silently stopped reading the tree.
    assert!(
        run.stdout.matches("[PASS]").count() > 30 && run.stdout.matches("[WARN]").count() > 10,
        "a handful of rows is not this kit: {}",
        run.describe()
    );
}

/// The same kit in the consumer profile: the authoring-coherence sections are
/// suppressed, which is the behaviour a flat-copy install depends on.
#[test]
fn the_consumer_run_matches_on_this_repositorys_own_kit() {
    let run = compare_in_repo(
        "repo-validate-flat-copy",
        &["validate", "--mode", "flat-copy"],
    );
    assert_substantial("repo-validate-flat-copy", &run, "[PASS] Hook executable: ");
    assert_substantial("repo-validate-flat-copy", &run, "Team memory store lint");
    assert!(
        !run.stdout.contains("Ownership") && !run.stdout.contains("Substrate"),
        "the authoring sections must be suppressed in flat-copy mode: {}",
        run.describe()
    );
}

/// `--portable` over the real kit: the provider matrix plus every default row.
#[test]
fn the_portable_run_matches_on_this_repositorys_own_kit() {
    let run = compare_in_repo("repo-validate-portable", &["validate", "--portable"]);
    assert_eq!(
        run.stdout.matches("Provider contract: ").count(),
        18,
        "{}",
        run.describe()
    );
}

/// `--strict`, where the kit's own WARN rows decide the exit code.
#[test]
fn the_strict_run_matches_on_this_repositorys_own_kit() {
    let run = compare_in_repo("repo-validate-strict", &["validate", "--strict"]);
    assert!(
        run.stdout.contains("warnings"),
        "a strict run with no warnings proves nothing about --strict: {}",
        run.describe()
    );
}

/// This repository's own memory store, linted by both CLIs — the invocation the
/// pre-ship guard makes here.
///
/// The `Project root:` line is the substance: it comes from the resolver port,
/// and this is the only case that exercises it against a real `.git` (a
/// worktree's `.git` is a FILE, which a directory-only check gets wrong).
#[test]
fn the_memory_lint_matches_on_this_repositorys_own_store() {
    let run = compare_in_repo("repo-validate-memory", &["validate", "--memory"]);
    assert_substantial("repo-validate-memory", &run, "Team memory store lint");
    assert_substantial(
        "repo-validate-memory",
        &run,
        &format!("Project root: {}", npm::repo_root().display()),
    );
}

#[test]
fn the_docs_reference_check_matches_against_the_real_contract() {
    let run = compare_in_repo("repo-validate-docs-refs", &["validate", "--docs-refs"]);
    // With no contract the check is N/A, and an N/A row renders as a PASS —
    // which would make this case agree about having checked nothing.
    assert!(
        !run.stdout.contains("N/A — maintainer contract absent"),
        "{}",
        run.describe()
    );
    assert!(
        npm::repo_root()
            .join("scripts")
            .join("docs-reference-contract.md")
            .exists(),
        "this case stops meaning anything once the contract moves"
    );
    assert_substantial(
        "repo-validate-docs-refs",
        &run,
        "Docs references on Type-1 allowlist",
    );
}

#[test]
fn the_routing_breadth_check_matches_on_the_real_rule_set() {
    let run = compare_in_repo("repo-validate-rules", &["validate", "--rules"]);
    assert_substantial("repo-validate-rules", &run, "Routing-table breadth");
}

/// The remaining scoped checks over the real kit. Each is a CI step somewhere,
/// and each reads a different part of the tree: the lifecycle spec and its
/// prose sources, the governance registry, the committed substrate view, the
/// pack manifest, every agent contract, the capability manifest, and every
/// SKILL.md frontmatter.
#[test]
fn every_scoped_authoring_check_matches_on_the_real_kit() {
    for (name, flag, needle) in [
        ("repo-validate-workflow", "--workflow", "No drift: "),
        (
            "repo-validate-ownership",
            "--ownership",
            "Ownership coverage",
        ),
        (
            "repo-validate-substrate",
            "--substrate",
            "Substrate coverage",
        ),
        ("repo-validate-packs", "--packs", "Pack coherence"),
        ("repo-validate-agents", "--agents", "Agent conformance"),
        // This kit has several intents owned by two capabilities each, so the
        // section WARNs rather than reporting the single clean-manifest row.
        (
            "repo-validate-capabilities",
            "--capabilities",
            "maps to multiple capabilities",
        ),
        (
            "repo-validate-frontmatter",
            "--frontmatter",
            "Skill frontmatter",
        ),
    ] {
        let run = compare_in_repo(name, &["validate", flag]);
        assert_substantial(name, &run, needle);
    }
}
