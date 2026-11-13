//! The same runs against THIS repository's own kit, not a fixture.
//!
//! A fixture holds what its author thought to put in it. The kit in this
//! checkout holds ~hundreds of prose files, every real hook and agent, the
//! actual registry, the real lifecycle spec, the real docs-reference contract
//! and the committed capability overlay — so these are the cases that catch a
//! check that is right about a toy tree and wrong about the tree it ships
//! against.
//!
//! They run in the repository root with a temp HOME, and nothing they invoke
//! writes: `validate` reads.
use std::path::Path;

use crate::parity;

/// Run one argv against both CLIs in the repository root and compare the exit
/// code, both streams and that neither wrote anything.
fn compare_in_repo(name: &'static str, args: &[&str]) -> Option<parity::Run> {
    let prerequisites = parity::check(name)?;
    let scratch = tempfile::Builder::new()
        .prefix("mewkit-repo-parity-")
        .tempdir()
        .expect("create the scratch dir");
    let home = scratch.path().join("home");
    std::fs::create_dir_all(&home).expect("create the temp HOME");
    let repo = parity::repo_root();

    let ts = parity::run_node(&prerequisites, &repo, &home, args, &[], None);
    let rust = parity::run_rust(&repo, &home, args, &[], None);

    assert_eq!(
        ts.code,
        rust.code,
        "[{name}] exit code differs\n--- npm CLI ---\n{}\n--- mewkit-next ---\n{}",
        ts.describe(),
        rust.describe()
    );
    let mut normaliser = parity::Normaliser::new(&repo, &repo, scratch.path());
    assert_eq!(
        normaliser.text(&ts.stdout),
        normaliser.text(&rust.stdout),
        "[{name}] stdout differs"
    );
    assert_eq!(
        normaliser.text(&ts.stderr),
        normaliser.text(&rust.stderr),
        "[{name}] stderr differs"
    );
    assert!(
        !home.join(".meowkit").exists(),
        "[{name}] a read-only check wrote into HOME"
    );
    Some(ts)
}

/// Hold a repo case to actually having read the kit: two CLIs that both report
/// nothing agree, and that is not the property under test.
fn assert_substantial(name: &str, run: &parity::Run, needle: &str) {
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
#[ignore = "needs node and the TS build"]
fn the_default_run_matches_on_this_repositorys_own_kit() {
    let Some(ts) = compare_in_repo("repo-validate-default", &["validate"]) else {
        return;
    };
    assert_substantial("repo-validate-default", &ts, "authoring (auto-detected)");
    // Every section the authoring suite produces, on real data.
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
        assert_substantial("repo-validate-default", &ts, section);
    }
    // The real kit produces tens of rows across those sections; a handful
    // would mean a check silently stopped reading the tree.
    assert!(
        ts.stdout.matches("[PASS]").count() > 30 && ts.stdout.matches("[WARN]").count() > 10,
        "a handful of rows is not this kit: {}",
        ts.describe()
    );
}

/// The same kit in the consumer profile: the authoring-coherence sections are
/// suppressed, which is the behaviour a flat-copy install depends on.
#[test]
#[ignore = "needs node and the TS build"]
fn the_consumer_run_matches_on_this_repositorys_own_kit() {
    let Some(ts) = compare_in_repo(
        "repo-validate-flat-copy",
        &["validate", "--mode", "flat-copy"],
    ) else {
        return;
    };
    assert_substantial("repo-validate-flat-copy", &ts, "[PASS] Hook executable: ");
    assert_substantial("repo-validate-flat-copy", &ts, "Team memory store lint");
    assert!(
        !ts.stdout.contains("Ownership") && !ts.stdout.contains("Substrate"),
        "the authoring sections must be suppressed in flat-copy mode: {}",
        ts.describe()
    );
}

/// `--portable` over the real kit: the provider matrix plus every default row.
#[test]
#[ignore = "needs node and the TS build"]
fn the_portable_run_matches_on_this_repositorys_own_kit() {
    let Some(ts) = compare_in_repo("repo-validate-portable", &["validate", "--portable"]) else {
        return;
    };
    assert_eq!(
        ts.stdout.matches("Provider contract: ").count(),
        18,
        "{}",
        ts.describe()
    );
}

/// `--strict`, where the kit's own WARN rows decide the exit code.
#[test]
#[ignore = "needs node and the TS build"]
fn the_strict_run_matches_on_this_repositorys_own_kit() {
    let Some(ts) = compare_in_repo("repo-validate-strict", &["validate", "--strict"]) else {
        return;
    };
    assert!(
        ts.stdout.contains("warnings"),
        "a strict run with no warnings proves nothing about --strict: {}",
        ts.describe()
    );
}

/// This repository's own memory store, linted by both CLIs — the invocation the
/// pre-ship guard makes here.
///
/// The `Project root:` line is the substance: it comes from the resolver port,
/// and this is the only case that exercises it against a real `.git` (a
/// worktree's `.git` is a FILE, which a directory-only check gets wrong).
#[test]
#[ignore = "needs node and the TS build"]
fn the_memory_lint_matches_on_this_repositorys_own_store() {
    let Some(ts) = compare_in_repo("repo-validate-memory", &["validate", "--memory"]) else {
        return;
    };
    assert_substantial("repo-validate-memory", &ts, "Team memory store lint");
    assert_substantial(
        "repo-validate-memory",
        &ts,
        &format!("Project root: {}", parity::repo_root().display()),
    );
}

/// The gate-authority scan over every `.md` under `.claude/` — the check whose
/// whole value is in the breadth of prose it reads.
///
/// The file COUNT is in the PASS row's detail, which the renderer suppresses by
/// design, so the breadth is asserted against the filesystem instead; the
/// comparison above is what proves both CLIs read it the same way.
#[test]
#[ignore = "needs node and the TS build"]
fn the_gate_authority_scan_matches_across_the_whole_claude_tree() {
    let Some(ts) = compare_in_repo("repo-validate-gates", &["validate", "--gates"]) else {
        return;
    };
    assert_substantial("repo-validate-gates", &ts, "automated gate-approval claims");
    let prose = count_markdown(&parity::repo_root().join(".claude"));
    assert!(
        prose > 50,
        "only {prose} prose files live under .claude/, which is not this kit"
    );
}

/// Every `.md` under one tree, to prove a scan had something to scan.
fn count_markdown(dir: &Path) -> usize {
    let Ok(read) = std::fs::read_dir(dir) else {
        return 0;
    };
    read.filter_map(Result::ok)
        .map(|entry| {
            let path = entry.path();
            if path.is_dir() {
                count_markdown(&path)
            } else {
                usize::from(path.extension().is_some_and(|ext| ext == "md"))
            }
        })
        .sum()
}

#[test]
#[ignore = "needs node and the TS build"]
fn the_docs_reference_check_matches_against_the_real_contract() {
    let Some(ts) = compare_in_repo("repo-validate-docs-refs", &["validate", "--docs-refs"]) else {
        return;
    };
    // With no contract the check is N/A, and an N/A row renders as a PASS —
    // which would make this case agree about having checked nothing.
    assert!(
        !ts.stdout.contains("N/A — maintainer contract absent"),
        "{}",
        ts.describe()
    );
    assert!(
        parity::repo_root()
            .join("docs")
            .join("maintainer")
            .join("docs-reference-contract.md")
            .exists(),
        "this case stops meaning anything once the contract moves"
    );
    assert_substantial(
        "repo-validate-docs-refs",
        &ts,
        "Docs references on Type-1 allowlist",
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn the_routing_breadth_check_matches_on_the_real_rule_set() {
    let Some(ts) = compare_in_repo("repo-validate-rules", &["validate", "--rules"]) else {
        return;
    };
    assert_substantial("repo-validate-rules", &ts, "Routing-table breadth");
}

/// The remaining scoped checks over the real kit. Each is a CI step somewhere,
/// and each reads a different part of the tree: the lifecycle spec and its
/// prose sources, the governance registry, the committed substrate view, the
/// pack manifest, every agent contract, the capability manifest, and every
/// SKILL.md frontmatter.
#[test]
#[ignore = "needs node and the TS build"]
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
        let Some(ts) = compare_in_repo(name, &["validate", flag]) else {
            return;
        };
        assert_substantial(name, &ts, needle);
    }
}
