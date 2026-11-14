//! `validate-workflow-evidence.cjs` against an index the Rust binary rewrote.

use super::*;

const EVIDENCE: &str = "tasks/plans/demo/reports/evidence/workflow-evidence.json";

/// A complete, valid `mk:fix` index at revision 2 with both gates approved
/// against it. The correction fixture's own index is too sparse to validate.
fn approved_fix_index() -> Value {
    json!({
        "schemaVersion": 1,
        "skill": "mk:fix",
        "mode": "auto",
        "task": "rotate refresh token",
        "risk": { "matchedFlags": ["AUTH"], "requiresHumanApproval": true, "reason": "auth path" },
        "fixDiagnosis": {
            "exactSymptom": "401 after 24h",
            "reproduction": "wait 24h then call /me",
            "expectedActual": "expected 200, got 401",
            "rootCause": "auth.ts:42 no rotation",
            "whyNow": "introduced in abc123",
            "blastRadius": ["session refresh"]
        },
        "evidenceRevision": 2,
        "verification": { "commands": ["npm test"], "overall": "pass", "evidenceRevision": 2, "status": "valid" },
        "review": { "verdictPath": "tasks/reviews/x-verdict.md", "status": "valid", "evidenceRevision": 2, "sideEffectsDetected": false },
        "approvals": { "gate1": "approved", "gate2": "approved", "gate1Revision": 1 }
    })
}

fn validate_evidence(s: &Scratch) -> (i32, String) {
    let validator = hook("lib/validate-workflow-evidence.cjs");
    let index = s.project.join(EVIDENCE);
    node(
        s,
        &[
            validator.as_ref(),
            index.as_ref(),
            "--phase".as_ref(),
            "fix".as_ref(),
        ],
    )
}

/// Seeds the index, asserts the validator accepts it, then has the Rust binary
/// apply a returned correction of `kind` and hands back the rewritten index.
fn corrected(s: &Scratch, kind: &str) -> Value {
    write_json(&s.project.join(EVIDENCE), &approved_fix_index());
    let (code, text) = validate_evidence(s);
    assert_eq!(
        code, 0,
        "the seed index must be valid before the correction: {text}"
    );

    let run = rust(
        s,
        &[
            "advice",
            "commit",
            "--run",
            "demo-run",
            "--checkpoint",
            "cp-1",
            "--disposition",
            "RETURN_TO_EXECUTOR",
            "--outcome",
            "adopted",
            "--reason",
            "the proof is stale",
            "--correction",
            "add the regression test",
            "--correction-kind",
            kind,
            "--evidence",
            EVIDENCE,
        ],
        None,
    );
    assert_eq!(
        run.code,
        0,
        "the Rust correction failed: {}",
        run.describe()
    );
    read_json(&s.project.join(EVIDENCE))
}

#[test]
#[ignore = "needs node and the TS build"]
fn the_evidence_validator_accepts_an_index_the_rust_correction_rewrote() {
    let Some(_) = parity::check("hook-mirror-evidence-accept") else {
        return;
    };
    for (kind, gate1) in [("source", "approved"), ("scope", "required")] {
        let s = scratch("mewkit-mirror-evidence-", "advice-review-open");
        let after = corrected(&s, kind);
        assert_eq!(after["evidenceRevision"], 3, "{kind}: {after}");
        assert_eq!(after["approvals"]["gate2"], "required", "{kind}: {after}");
        assert_eq!(after["approvals"]["gate1"], gate1, "{kind}: {after}");
        let (code, text) = validate_evidence(&s);
        assert_eq!(
            (code, text.lines().next().unwrap_or_default()),
            (0, "EVIDENCE_OK"),
            "{kind}: the shipped validator rejected the index Rust wrote: {text}"
        );
    }
}

#[test]
#[ignore = "needs node and the TS build"]
fn the_evidence_validator_notices_a_correction_that_stopped_demoting() {
    let Some(_) = parity::check("hook-mirror-evidence-reject") else {
        return;
    };
    let s = scratch("mewkit-mirror-evidence-neg-", "advice-review-open");
    let after = corrected(&s, "scope");
    let index = s.project.join(EVIDENCE);
    let blocked = |value: &Value, reason: &str| {
        write_json(&index, value);
        let (code, text) = validate_evidence(&s);
        assert_eq!(code, 1, "expected a block for {reason}: {text}");
        assert!(text.contains(reason), "expected {reason}, got: {text}");
    };

    // Gate 2 left approved over superseded proof: the case the Rust demotion
    // exists to prevent, and the validator is its second line.
    let mut stale_gate2 = after.clone();
    stale_gate2["approvals"]["gate2"] = json!("approved");
    blocked(&stale_gate2, "gate2-approved-on-superseded-review");
    blocked(&stale_gate2, "gate2-approved-on-superseded-verification");

    // A scope correction that left Gate 1 approved.
    let mut stale_gate1 = after.clone();
    stale_gate1["approvals"]["gate1"] = json!("approved");
    blocked(&stale_gate1, "gate1-approved-before-scope-change");

    // The revision counter renamed: the validator then reads revision 1 and the
    // records stamped at 2 are ahead of it.
    let mut renamed = after.clone();
    let object = renamed.as_object_mut().expect("an object");
    let revision = object
        .remove("evidenceRevision")
        .expect("the revision field");
    object.insert("revision".into(), revision);
    blocked(&renamed, "verification-revision-out-of-range");
}
