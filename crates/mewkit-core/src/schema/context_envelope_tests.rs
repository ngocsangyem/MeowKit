//! Ports of the envelope cases in `core/__tests__/orient-envelope.test.ts` and
//! the boundary cases `isWithinBoundary` is asserted on in
//! `core/__tests__/hook-runtime.test.ts`.

use std::path::Path;

use serde_json::json;

use super::*;

fn envelope() -> serde_json::Value {
    json!({
        "schemaVersion": "1.0",
        "boundaryRoot": "/work",
        "evidence": [
            {
                "path": "/work/a/src/lib.rs",
                "contentHash": "deadbeef",
                "owningRepoIdentity": "/work/a",
                "revision": "abc"
            }
        ],
        "timestamp": "2026-07-12T00:00:00.000Z"
    })
}

#[test]
fn accepts_an_envelope_and_defaults_the_optional_fields() {
    let parsed = ContextEnvelope::parse(&envelope()).expect("valid envelope");
    assert_eq!(parsed.query_descriptor, "");
    assert!(parsed.omissions.is_empty());
    assert_eq!(parsed.evidence[0].provenance, EvidenceProvenance::HostRead);
    assert!(!parsed.evidence[0].redacted);
}

#[test]
fn rejects_an_unsupported_schema_version() {
    let mut bad = envelope();
    bad["schemaVersion"] = json!("2.0");
    assert!(ContextEnvelope::parse(&bad).is_err());
}

#[test]
fn rejects_an_evidence_ref_with_no_owning_repo_key() {
    let mut bad = envelope();
    bad["evidence"] = json!([{ "path": "x", "contentHash": null, "revision": null }]);
    assert!(ContextEnvelope::parse(&bad).is_err());
}

#[test]
fn keeps_a_missing_content_hash_as_null() {
    let mut rec = envelope();
    rec["evidence"][0]["contentHash"] = json!(null);
    let parsed = ContextEnvelope::parse(&rec).expect("a missing file records a null hash");
    assert_eq!(parsed.evidence[0].content_hash, None);
}

#[test]
fn distinct_repos_dedupes_by_identity_keeping_the_first_revision_seen() {
    // `repo-context.ts` sets a revision only for an identity it has not seen,
    // so the FIRST ref wins. This test asserted the opposite and locked the
    // divergence in: the same envelope read by the two CLIs reported two
    // different revisions for `/work/b`.
    let mut rec = envelope();
    rec["evidence"] = json!([
        { "path": "/work/b/x", "contentHash": null, "owningRepoIdentity": "/work/b", "revision": "first" },
        { "path": "/work/a/y", "contentHash": null, "owningRepoIdentity": "/work/a", "revision": null },
        { "path": "/work/b/z", "contentHash": null, "owningRepoIdentity": "/work/b", "revision": "later" }
    ]);
    let parsed = ContextEnvelope::parse(&rec).expect("valid envelope");
    assert_eq!(
        parsed.distinct_repos(),
        vec![
            ("/work/a".to_string(), None),
            ("/work/b".to_string(), Some("first".to_string())),
        ]
    );
}

#[test]
fn a_first_ref_with_no_revision_is_not_backfilled_from_a_later_one() {
    // The missing-revision case the TS comment calls out: a revision stays
    // missing rather than being borrowed from a sibling ref.
    let mut rec = envelope();
    rec["evidence"] = json!([
        { "path": "/work/a/x", "contentHash": null, "owningRepoIdentity": "/work/a", "revision": null },
        { "path": "/work/a/y", "contentHash": null, "owningRepoIdentity": "/work/a", "revision": "abc" }
    ]);
    let parsed = ContextEnvelope::parse(&rec).expect("valid envelope");
    assert_eq!(parsed.distinct_repos(), vec![("/work/a".to_string(), None)]);
}

#[test]
fn provenance_round_trips_through_its_kebab_case_wire_form() {
    let mut rec = envelope();
    rec["evidence"][0]["provenance"] = json!("host-search");
    let parsed = ContextEnvelope::parse(&rec).expect("valid provenance");
    assert_eq!(
        parsed.evidence[0].provenance,
        EvidenceProvenance::HostSearch
    );
    let back = serde_json::to_value(&parsed).expect("serializable");
    assert_eq!(back["evidence"][0]["provenance"], json!("host-search"));
}

#[test]
fn boundary_accepts_a_path_inside_and_the_root_itself() {
    assert!(is_within_boundary(
        Path::new("/work/proj"),
        Path::new("/work/proj/node_modules/.bin/mewkit")
    ));
    assert!(is_within_boundary(
        Path::new("/work/proj"),
        Path::new("/work/proj")
    ));
}

#[test]
fn boundary_rejects_an_escape_and_a_sibling_with_a_shared_prefix() {
    assert!(!is_within_boundary(
        Path::new("/work/proj"),
        Path::new("/work/other/evil")
    ));
    assert!(!is_within_boundary(
        Path::new("/work/proj"),
        Path::new("/work/proj/../evil")
    ));
    // A shared NAME prefix is not containment: `/work/project2` must not read
    // as inside `/work/proj`.
    assert!(!is_within_boundary(
        Path::new("/work/proj"),
        Path::new("/work/project2/x")
    ));
}
