//! The two stages that CHANGE something outside the session directory —
//! `submit` (posts to GitHub) and `cleanup` (removes a worktree) — plus the
//! `prepare` success path.
//!
//! `prepare` cannot use the ordinary case builder: the session directory it
//! creates is named with a timestamp and four random bytes, and the harness
//! compares file PATHS literally. So it runs both CLIs through the same
//! primitives and compares each side's tree with its OWN session id folded
//! out — the one value the two runs cannot share.
use std::path::Path;

use crate::npm;

use super::stubbed_path;

#[test]
fn submit_refuses_without_the_write_authority_or_a_bound_confirmation() {
    for (name, args, expected) in [
        (
            "review-submit-no-reply",
            vec!["review", "submit", "--session", "s1"],
            "submit requires --reply (the only GitHub write authority)",
        ),
        (
            "review-submit-no-confirm",
            vec!["review", "submit", "--session", "s1", "--reply"],
            "submit requires --confirm <payload-hash>",
        ),
        (
            "review-submit-stale-confirm",
            vec![
                "review",
                "submit",
                "--session",
                "s1",
                "--reply",
                "--confirm",
                "0000000000000000000000000000000000000000000000000000000000000000",
            ],
            "confirmation does not match the current payload",
        ),
    ] {
        // No stub on PATH: these paths must refuse BEFORE any `gh` call, so a
        // case that regressed into calling one would fail to find it rather
        // than quietly reaching a real GitHub.
        let (ts, _) = npm::case(name)
            .fixture("review-submit-ready")
            .args(&args)
            .run();
        assert_eq!(ts.code, 1, "{}", ts.describe());
        assert!(ts.stderr.contains(expected), "{}", ts.describe());
    }
}

/// The hash of the fixture's `submit-payload.json`, which is what `--confirm`
/// has to carry. Hard-coded on purpose: a payload edit must break this case,
/// because it would also invalidate a confirmation a human already gave.
const PAYLOAD_HASH: &str = "ca04e6bb4514b1ccfba03e4018513aad1ceaecf71fa6c5add0781da557fba2ce";

#[test]
fn a_head_that_moved_since_prepare_aborts_without_posting() {
    let (ts, _) = npm::case("review-submit-head-moved")
        .fixture("review-submit-stubbed")
        .env("PATH", &stubbed_path())
        .env("STUB_HEAD", "feedfacefeedfacefeedfacefeedfacefeedface")
        .args(&[
            "review",
            "submit",
            "--session",
            "s1",
            "--reply",
            "--confirm",
            PAYLOAD_HASH,
        ])
        .writes(&["gh-calls.txt"])
        .run();
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stderr.contains("restart the review; NOT posting"),
        "{}",
        ts.describe()
    );
}

#[test]
fn a_confirmed_submit_posts_exactly_one_review() {
    // `gh-calls.txt` is written by the stub and compared like any other file,
    // so this asserts both CLIs would have posted the SAME review.
    let (ts, _) = npm::case("review-submit-posts")
        .fixture("review-submit-stubbed")
        .env("PATH", &stubbed_path())
        .args(&[
            "review",
            "submit",
            "--session",
            "s1",
            "--reply",
            "--confirm",
            PAYLOAD_HASH,
        ])
        .writes(&["gh-calls.txt", "tasks/reviews/s1/submitted.json"])
        .run();
    assert_eq!((ts.code, ts.stdout.trim()), (0, "✓ review posted"));
}

#[test]
fn a_retry_after_a_successful_post_is_an_idempotent_no_op() {
    let (ts, _) = npm::case("review-submit-already-posted")
        .fixture("review-submit-posted")
        .env("PATH", &stubbed_path())
        .args(&[
            "review",
            "submit",
            "--session",
            "s1",
            "--reply",
            "--confirm",
            PAYLOAD_HASH,
        ])
        .run();
    assert_eq!(
        (ts.code, ts.stdout.trim()),
        (0, "✓ already submitted (idempotent no-op)")
    );
    // The stub would have recorded any call; neither CLI made one.
    assert!(!ts.stderr.contains("gh"), "{}", ts.describe());
}

/// SAFETY-CRITICAL. The manifest's nonce and the back-reference inside the
/// worktree disagree, so the worktree belongs to somebody else. Both CLIs must
/// report the refusal identically and leave every file where it was — which
/// the harness's file-tree comparison asserts, because the owned-nonce case
/// below shows what a SUCCESSFUL cleanup does to that same tree.
#[test]
fn cleanup_refuses_a_worktree_whose_manifest_nonce_does_not_match() {
    let (ts, _) = npm::case("review-cleanup-foreign-nonce")
        .fixture("review-cleanup-foreign")
        .args(&["review", "cleanup", "--session", "s1"])
        .writes(&[".worktrees/review-pr-7-s1/pr-code.ts"])
        .run();
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stderr
            .contains("nonce mismatch (worktree is not owned by this manifest)"),
        "{}",
        ts.describe()
    );
}

#[test]
fn cleanup_removes_a_worktree_this_session_owns_and_keeps_the_audit_trail() {
    let (ts, _) = npm::case("review-cleanup-owned")
        .fixture("review-cleanup-owned")
        .args(&["review", "cleanup", "--session", "s1"])
        // The session's own artifacts outlive the worktree: they are what a
        // human reads at the gate.
        .writes(&[
            "tasks/reviews/s1/manifest.json",
            "tasks/reviews/s1/verdict.md",
        ])
        .run();
    assert_eq!(
        (ts.code, ts.stdout.trim()),
        (
            0,
            "✓ review worktree cleaned (session artifacts kept for the audit trail)"
        )
    );
}

#[test]
fn cleanup_without_a_session_on_disk_is_refused() {
    let (ts, _) = npm::case("review-cleanup-no-session")
        .args(&["review", "cleanup", "--session", "ghost"])
        .run();
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stderr.contains("no review session at"),
        "{}",
        ts.describe()
    );
}

/// The one Rust-side assertion the cross-CLI comparison cannot make: that a
/// REFUSED cleanup removed nothing. Two CLIs that both deleted the worktree
/// would agree with each other and still be wrong.
#[test]
fn a_refused_cleanup_removes_nothing_from_this_cli() {
    let scratch = tempfile::Builder::new()
        .prefix("mewkit-review-refusal-")
        .tempdir()
        .expect("a temp dir");
    let project = scratch.path().join("project");
    let home = scratch.path().join("home");
    std::fs::create_dir_all(&home).expect("create HOME");
    npm::copy_fixture("review-cleanup-foreign", &project);
    let worktree = project.join(".worktrees/review-pr-7-s1/pr-code.ts");
    assert!(worktree.exists(), "the fixture did not provide a worktree");

    let run = npm::run_rust(
        &project,
        &home,
        &["review", "cleanup", "--session", "s1"],
        &[],
        None,
    );
    assert_eq!(run.code, 1, "{}", run.describe());
    assert!(
        worktree.exists(),
        "a refused cleanup removed the worktree: {}",
        run.describe()
    );
    assert!(
        project.join("tasks/reviews/s1/manifest.json").exists(),
        "a refused cleanup removed the session's audit trail"
    );
}

/// `review prepare`, compared with the recorded npm run once the session id —
/// the one value two runs cannot share — is folded out of both.
#[test]
fn a_prepared_session_is_identical_apart_from_its_generated_id() {
    let scratch = tempfile::Builder::new()
        .prefix("mewkit-review-prepare-")
        .tempdir()
        .expect("a temp dir");
    let (home, rust_project) = (scratch.path().join("home"), scratch.path().join("rust"));
    std::fs::create_dir_all(&home).expect("create HOME");
    npm::copy_fixture("review-prepare", &rust_project);
    let args = ["review", "prepare", "acme/widget#9", "--json"];
    let env = [("PATH".to_string(), stubbed_path())];
    let rust = npm::run_rust(&rust_project, &home, &args, &env, None);
    let npm = npm::Golden::load("review-prepare-success");
    assert_eq!(npm.run.code, 0, "{}", npm.run.describe());
    assert_eq!(rust.code, 0, "{}", rust.describe());

    let rust_id = session_id(&rust.stdout);
    let mut normaliser = npm::Normaliser::new(&[&rust_project, scratch.path()]);
    let mut live = folded(&rust_project, &rust_id, &mut normaliser);
    live.sort();
    let mut frozen: Vec<(String, String)> = npm
        .tree
        .iter()
        .map(|(path, body)| (path.clone(), normaliser.text(body)))
        .collect();
    frozen.sort();
    assert_eq!(
        frozen,
        live,
        "the prepared sessions differ\n--- npm CLI (recorded) ---\n{}\n--- mewkit ---\n{}",
        npm.run.describe(),
        rust.describe()
    );
    assert_eq!(
        npm.run.stdout,
        rust.stdout.replace(&rust_id, "<session>"),
        "the prepare result differs"
    );
}

/// The `"session": "…"` value from a `--json` prepare result.
fn session_id(stdout: &str) -> String {
    let key = "\"session\": \"";
    let at = stdout.find(key).expect("prepare printed a session id") + key.len();
    stdout[at..]
        .split('"')
        .next()
        .expect("a terminated session id")
        .to_string()
}

/// Every file under `root`, with the session id folded out of both the path
/// and the contents.
fn folded(root: &Path, session: &str, normaliser: &mut npm::Normaliser) -> Vec<(String, String)> {
    npm::snapshot(root, normaliser)
        .entries()
        .map(|(path, body)| {
            (
                path.replace(session, "<session>"),
                body.replace(session, "<session>"),
            )
        })
        .collect()
}
