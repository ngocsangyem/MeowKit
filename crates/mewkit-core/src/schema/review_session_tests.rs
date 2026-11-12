//! Ports of the `SubmitPayloadSchema` and `EvidenceEventSchema` cases in
//! `review/__tests__/schema.test.ts`, plus the session record that joins the
//! manifest, the evidence and the verdict state.

use serde_json::json;

use super::*;

#[test]
fn binds_a_submit_to_a_head_sha_and_a_review_event() {
    let payload = SubmitPayload::parse(&json!({
        "host": "github",
        "owner": "o",
        "repo": "r",
        "pr": 1,
        "headSha": "deadbeef",
        "event": "APPROVE",
        "body": "lgtm"
    }))
    .expect("valid payload");
    assert_eq!(payload.event, SubmitEvent::Approve);
    assert_eq!(payload.head_sha, "deadbeef");
}

#[test]
fn rejects_a_submit_with_no_head_sha_or_an_unknown_event() {
    let mut bad = json!({
        "host": "github", "owner": "o", "repo": "r", "pr": 1,
        "headSha": "", "event": "APPROVE", "body": ""
    });
    assert!(SubmitPayload::parse(&bad).is_err());
    bad["headSha"] = json!("deadbeef");
    bad["event"] = json!("MERGE");
    assert!(SubmitPayload::parse(&bad).is_err());
}

#[test]
fn an_evidence_event_needs_a_session_a_kind_and_a_timestamp() {
    let event = EvidenceEvent::parse(&json!({
        "session": "s1",
        "kind": "read",
        "target": "diff.patch",
        "at": "2026-07-19T00:00:00.000Z",
        "source": "hook"
    }))
    .expect("valid event");
    assert_eq!(event.source, Some(EvidenceSource::Hook));
    assert!(EvidenceEvent::parse(&json!({ "session": "s1", "kind": "", "at": "t" })).is_err());
    assert!(EvidenceEvent::parse(&json!({ "kind": "read", "at": "t" })).is_err());
}

#[test]
fn a_session_joins_the_manifest_evidence_and_verdict() {
    let session = ReviewSession::parse(&json!({
        "schemaVersion": "1.0.0",
        "session": "ci-example",
        "manifest": {
            "schemaVersion": "1.0.0",
            "session": "ci-example",
            "nonce": "abc123def456",
            "worktreePath": ".worktrees/review-pr-7-ci-example",
            "pr": 7,
            "ref": "refs/mewkit/review-pr-7-ci-example",
            "headSha": "deadbeef",
            "baseSha": "cafebabe",
            "baseBranch": "main",
            "baseRemote": "origin",
            "host": "github",
            "owner": "ngocsangyem",
            "repo": "MeowKit",
            "createdAt": "2026-07-19T00:00:00.000Z"
        },
        "evidence": [{ "session": "ci-example", "kind": "read", "at": "t", "source": "cli" }],
        "verdict": { "decision": "PASS", "dimensions": [{ "name": "Tests", "verdict": "PASS" }] }
    }))
    .expect("valid session");
    assert_eq!(session.manifest.pr, 7);
    assert_eq!(session.evidence.len(), 1);
    assert!(session.verdict.is_some());
}

#[test]
fn a_session_reports_a_nested_manifest_problem_with_its_path() {
    let errors = ReviewSession::parse(&json!({
        "schemaVersion": "1.0.0",
        "session": "s",
        "manifest": {
            "schemaVersion": "1.0.0",
            "session": "s",
            "nonce": "n",
            "worktreePath": "../escape",
            "pr": 7,
            "ref": "refs/mewkit/review-pr-7-s",
            "headSha": "a",
            "baseSha": "b",
            "baseBranch": "main",
            "baseRemote": "origin",
            "host": "github",
            "owner": "o",
            "repo": "r",
            "createdAt": "t"
        }
    }))
    .expect_err("an out-of-namespace worktree path is refused through the session too");
    assert!(
        errors
            .iter()
            .any(|e| e.starts_with("manifest.worktreePath")),
        "{errors:?}"
    );
}

#[test]
fn evidence_levels_use_their_kebab_case_wire_form() {
    assert_eq!(
        serde_json::to_value(EvidenceLevel::SessionObserved).expect("serializable"),
        json!("session-observed")
    );
    assert_eq!(
        serde_json::from_value::<EvidenceLevel>(json!("attested")).expect("known level"),
        EvidenceLevel::Attested
    );
    assert!(serde_json::from_value::<EvidenceLevel>(json!("assumed")).is_err());
}
