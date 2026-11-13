//! `review` against both CLIs: the invocation surface and `prepare`.
//!
//! The pipeline's other stages are in the sibling files declared below; they
//! share the helpers here.
//!
//! ## How these cases avoid the network
//!
//! `review` shells out to `git`, to `gh` and to the kit's worktree action. Each
//! case that reaches one of those puts a fixture's `stub-bin/` FIRST on PATH —
//! as a relative entry, which every process resolves against its own working
//! directory, so each CLI finds its own copy inside its own project. Nothing
//! contacts GitHub, and the stubs record the argv they were handed into the
//! project, which makes "what would have been run" part of the compared file
//! tree.
use crate::parity;

#[path = "review_session_cases.rs"]
mod session_cases;
#[path = "review_write_cases.rs"]
mod write_cases;

/// The refusal text for a wrong sub-verb is each CLI's own; the exit code is
/// the contract. Unlike `plan`, both renderers agree here, because this one
/// reproduces the catalogue's wording verbatim — so only `--help` is declared.
pub(super) const OWN_HELP: &str = "help text is rendered by each CLI's own parser";

/// PATH with a fixture's `stub-bin/` in front, for a case that must not reach
/// a real `git` or `gh`.
pub(super) fn stubbed_path() -> String {
    format!(
        "stub-bin:{}",
        std::env::var("PATH").unwrap_or_else(|_| "/usr/bin:/bin".to_string())
    )
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_missing_or_unknown_sub_verb_is_an_invocation_error() {
    let Some((ts, _)) = parity::case("review-no-subcommand").args(&["review"]).run() else {
        return;
    };
    assert_eq!(ts.code, 2, "{}", ts.describe());
    assert!(
        ts.stderr.contains("needs a subcommand"),
        "{}",
        ts.describe()
    );

    let Some((ts, _)) = parity::case("review-unknown-subcommand")
        .args(&["review", "bogus"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 2, "{}", ts.describe());
}

#[test]
#[ignore = "needs node and the TS build"]
fn help_is_answered_without_running_a_stage() {
    for (name, args) in [
        ("review-help", vec!["review", "--help"]),
        ("review-prepare-help", vec!["review", "prepare", "--help"]),
    ] {
        let Some((ts, _)) = parity::case(name).args(&args).ignore_stdout(OWN_HELP).run() else {
            return;
        };
        assert_eq!(ts.code, 0, "{}", ts.describe());
    }
}

#[test]
#[ignore = "needs node and the TS build"]
fn an_unparsable_pr_target_is_refused_before_git_runs() {
    let Some((ts, _)) = parity::case("review-prepare-no-target")
        .args(&["review", "prepare"])
        .run()
    else {
        return;
    };
    assert_eq!((ts.code, ts.stderr.trim()), (1, "✗ empty PR target"));

    let Some((ts, _)) = parity::case("review-prepare-bad-target")
        .args(&["review", "prepare", "not a pr", "--json"])
        .run()
    else {
        return;
    };
    assert!(
        ts.stdout.contains("unrecognized PR target"),
        "{}",
        ts.describe()
    );
}

/// A BARE PR number — the form `review prepare <pr-url|number>` documents —
/// arrives from minimist as a JavaScript `number`, and the npm CLI's parser
/// calls `.trim()` on it. This pins that bug rather than fixing it in one CLI:
/// a caller passing a bare number sees the same failure from both until the
/// fix lands for both.
#[test]
#[ignore = "needs node and the TS build"]
fn a_bare_numeric_target_fails_the_same_way_in_both_clis() {
    let Some((ts, _)) = parity::case("review-prepare-bare-number")
        .args(&["review", "prepare", "7"])
        .run()
    else {
        return;
    };
    assert_eq!(
        (ts.code, ts.stderr.trim()),
        (1, "Fatal: (input ?? \"\").trim is not a function")
    );
    // `#7` is NOT numeric to minimist, so the same pull request reaches the
    // parser as a string and the command proceeds.
    let Some((ts, _)) = parity::case("review-prepare-hash-number")
        .fixture("review-prepare")
        .env("PATH", &stubbed_path())
        .args(&["review", "prepare", "#9"])
        .run()
    else {
        return;
    };
    assert!(
        ts.stderr
            .contains("bare PR number is ambiguous across 2 remotes"),
        "{}",
        ts.describe()
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_remote_that_does_not_host_the_pr_base_is_refused() {
    for (name, args, expected) in [
        (
            "review-prepare-no-matching-remote",
            vec!["review", "prepare", "ghost/nope#1"],
            "no remote points at the PR base ghost/nope; pass --remote <name>",
        ),
        (
            "review-prepare-override-is-a-fork",
            vec!["review", "prepare", "acme/widget#9", "--remote", "origin"],
            "remote \"origin\" points at me/fork, not the PR base acme/widget",
        ),
        (
            "review-prepare-unknown-remote",
            vec!["review", "prepare", "#9", "--remote", "nope"],
            "remote \"nope\" not found",
        ),
    ] {
        let Some((ts, _)) = parity::case(name)
            .fixture("review-prepare")
            .env("PATH", &stubbed_path())
            .args(&args)
            .run()
        else {
            return;
        };
        assert_eq!(
            (ts.code, ts.stderr.trim()),
            (1, format!("✗ {expected}").as_str())
        );
    }
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_worktree_that_fails_or_answers_with_nonsense_leaves_no_session() {
    for (name, mode, expected) in [
        (
            "review-prepare-worktree-failed",
            "fail",
            "worktree provisioning failed: REVIEW_PR_SETUP_FAILED: could not fetch pull/9/head from upstream",
        ),
        (
            "review-prepare-worktree-garbage",
            "garbage",
            "worktree did not return a manifest",
        ),
    ] {
        let Some((ts, _)) = parity::case(name)
            .fixture("review-prepare")
            .env("PATH", &stubbed_path())
            .env("STUB_WORKTREE", mode)
            .args(&["review", "prepare", "acme/widget#9"])
            .run()
        else {
            return;
        };
        assert_eq!(
            (ts.code, ts.stderr.trim()),
            (1, format!("✗ {expected}").as_str())
        );
    }
}

/// A manifest that fails the schema is refused by both — but each names the
/// problem in its own validator's words (zod there, this crate's schema here),
/// so only the refusal and the exit code are compared.
#[test]
#[ignore = "needs node and the TS build"]
fn a_manifest_that_fails_the_schema_is_refused_by_both() {
    let Some((ts, rust)) = parity::case("review-prepare-manifest-off-schema")
        .fixture("review-prepare")
        .env("PATH", &stubbed_path())
        .env("STUB_WORKTREE", "unschemad")
        .args(&["review", "prepare", "acme/widget#9"])
        .ignore_stderr("each CLI's own schema validator names the bad field")
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    for run in [&ts, &rust] {
        assert!(
            run.stderr.contains("worktree manifest failed schema"),
            "{}",
            run.describe()
        );
    }
}
