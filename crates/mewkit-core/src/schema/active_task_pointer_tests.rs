//! Pointer cases from `core/__tests__/task-record.test.ts` ("reads the pointer
//! from active-plan.json (path), slug fallback, then legacy text") that belong
//! to the SCHEMA: the canonical shape, and the legacy mirror surviving a
//! round-trip. Which FILE the pointer is read from is the state-path layer's
//! question, not this one.

use serde_json::json;

use super::*;

#[test]
fn pointer_accepts_a_canonical_payload_and_keeps_the_legacy_mirror() {
    let parsed = ActiveTaskPointer::parse(&json!({
        "schemaVersion": "1.0",
        "taskId": "feat-x",
        "planPath": "plans/p1/plan.md",
        "planSlug": "p1",
        "path": "plans/p1/plan.md",
        "slug": "p1"
    }))
    .expect("canonical pointer");
    assert_eq!(parsed.task_id, "feat-x");
    // The checkpoint reader still reads `path`; a round-trip must not drop it.
    assert_eq!(parsed.extra["path"], json!("plans/p1/plan.md"));
}

#[test]
fn pointer_rejects_an_invalid_task_id() {
    assert!(
        ActiveTaskPointer::parse(&json!({ "schemaVersion": "1.0", "taskId": "Not A Slug" }))
            .is_err()
    );
}
