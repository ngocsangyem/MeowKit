//! Ports of the `ReviewManifestSchema` cases in `review/__tests__/schema.test.ts`,
//! including the injection-class regressions: `ref` and `worktreePath` reach git
//! and the filesystem, so a tampered manifest must be refused by the CONTRACT,
//! not merely neutralized downstream.

use serde_json::json;

use super::*;

fn manifest() -> serde_json::Value {
    json!({
        "schemaVersion": "1.0.0",
        "session": "ci-example",
        "nonce": "abc123def456",
        "worktreePath": ".worktrees/review-pr-7-ci-example",
        "pr": 7,
        "ref": "refs/mewkit/review-pr-7-ci-example",
        "headSha": "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
        "baseSha": "cafebabecafebabecafebabecafebabecafebabe",
        "baseBranch": "main",
        "baseRemote": "origin",
        "host": "github",
        "owner": "ngocsangyem",
        "repo": "MeowKit",
        "createdAt": "2026-07-19T00:00:00.000Z"
    })
}

#[test]
fn accepts_a_well_formed_manifest() {
    let parsed = ReviewManifest::parse(&manifest()).expect("valid manifest");
    assert_eq!(parsed.pr, 7);
    assert_eq!(parsed.host, ReviewHost::Github);
    assert_eq!(parsed.diff_sha256, None);
}

#[test]
fn rejects_a_missing_required_field() {
    let mut missing = manifest();
    missing.as_object_mut().expect("object").remove("headSha");
    assert!(ReviewManifest::parse(&missing).is_err());
}

#[test]
fn rejects_a_non_positive_pr_number() {
    for pr in [0, -3] {
        let mut bad = manifest();
        bad["pr"] = json!(pr);
        assert!(ReviewManifest::parse(&bad).is_err(), "pr {pr}");
    }
    // A non-integer PR is refused at deserialization — a fractional PR cannot
    // name a pull request.
    let mut bad = manifest();
    bad["pr"] = json!(7.5);
    assert!(ReviewManifest::parse(&bad).is_err());
}

#[test]
fn rejects_an_empty_sha() {
    let mut bad = manifest();
    bad["headSha"] = json!("");
    assert!(ReviewManifest::parse(&bad).is_err());
}

#[test]
fn rejects_an_unsupported_host() {
    let mut bad = manifest();
    bad["host"] = json!("gitlab");
    assert!(ReviewManifest::parse(&bad).is_err());
}

#[test]
fn keeps_unknown_forward_compatible_fields() {
    let mut future = manifest();
    future["futureField"] = json!(42);
    let parsed = ReviewManifest::parse(&future).expect("valid manifest");
    assert_eq!(parsed.extra["futureField"], json!(42));
    let back = serde_json::to_value(&parsed).expect("serializable");
    assert_eq!(back["futureField"], json!(42));
    // `ref` keeps its wire name: the git refspec is what the CommonJS action
    // writes, and a renamed key would silently lose the worktree.
    assert_eq!(back["ref"], json!("refs/mewkit/review-pr-7-ci-example"));
}

#[test]
fn rejects_a_ref_carrying_shell_metacharacters() {
    let mut bad = manifest();
    bad["ref"] = json!("refs/x ; rm -rf / #");
    assert!(ReviewManifest::parse(&bad).is_err());
}

#[test]
fn rejects_a_worktree_path_outside_the_review_namespace() {
    for path in ["../../etc/passwd", ".worktrees/feat-x"] {
        let mut bad = manifest();
        bad["worktreePath"] = json!(path);
        assert!(ReviewManifest::parse(&bad).is_err(), "{path}");
    }
}

#[test]
fn rejects_a_namespace_prefix_that_only_looks_right() {
    // A trailing-newline or embedded-newline smuggle must fail the anchors.
    for path in [
        ".worktrees/review-pr-7-ok\n.worktrees/evil",
        " .worktrees/review-pr-7-ok",
        ".worktrees/review-pr--ok",
    ] {
        let mut bad = manifest();
        bad["worktreePath"] = json!(path);
        assert!(ReviewManifest::parse(&bad).is_err(), "{path:?}");
    }
}

#[test]
fn cleanup_ownership_refuses_a_foreign_or_empty_nonce() {
    let parsed = ReviewManifest::parse(&manifest()).expect("valid manifest");
    assert!(parsed.owned_by("abc123def456"));
    assert!(!parsed.owned_by("someone-elses-nonce"));
    assert!(!parsed.owned_by(""));
}
