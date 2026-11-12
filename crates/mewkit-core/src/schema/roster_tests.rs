//! Accept/reject cases for the roster contract. `review/__tests__/roster.test.ts`
//! exercises the builder (deferred with the `review` verb); the case that
//! belongs to the SCHEMA is the duplicate-id refusal the "colliding-slug heavy
//! files get DISTINCT invariant ids" test exists to protect.

use serde_json::json;

use super::*;

fn entry(id: &str) -> serde_json::Value {
    json!({
        "id": id,
        "dimension": id,
        "briefFile": format!("briefs/{id}.md"),
        "expectedReads": ["diff.patch", format!("briefs/{id}.md")]
    })
}

#[test]
fn accepts_a_roster_with_unique_reviewer_ids() {
    let roster = Roster::parse(&json!({
        "tier": "small",
        "entries": [entry("correctness"), entry("security")]
    }))
    .expect("valid roster");
    assert_eq!(roster.tier, ReviewTier::Small);
    assert_eq!(roster.entries.len(), 2);
    assert_eq!(roster.entries[0].whole_diff, None);
}

#[test]
fn refuses_a_duplicate_reviewer_id() {
    let errors = Roster::parse(&json!({
        "tier": "large",
        "entries": [entry("issue-fidelity"), entry("issue-fidelity")]
    }))
    .expect_err("one reviewer must not satisfy two roster entries");
    assert!(
        errors.contains(&"duplicate reviewer id in roster".to_string()),
        "{errors:?}"
    );
}

#[test]
fn reports_which_id_repeated() {
    let roster =
        Roster::parse(&json!({ "tier": "small", "entries": [entry("a")] })).expect("valid roster");
    assert_eq!(roster.duplicate_id(), None);

    let mut doubled: Roster = serde_json::from_value(json!({
        "tier": "small",
        "entries": [entry("territory-1"), entry("territory-1")]
    }))
    .expect("deserializable");
    assert_eq!(doubled.duplicate_id(), Some("\"territory-1\"".to_string()));
    doubled.entries[1].id = "territory-2".to_string();
    assert_eq!(doubled.duplicate_id(), None);
}

#[test]
fn refuses_an_empty_id_dimension_or_brief_file() {
    for field in ["id", "dimension", "briefFile"] {
        let mut bad = entry("correctness");
        bad[field] = json!("");
        assert!(
            Roster::parse(&json!({ "tier": "small", "entries": [bad] })).is_err(),
            "{field} must not be empty"
        );
    }
}

#[test]
fn refuses_an_unknown_tier() {
    assert!(Roster::parse(&json!({ "tier": "enormous", "entries": [] })).is_err());
}

#[test]
fn keeps_a_whole_diff_role_and_its_focus() {
    let mut whole = entry("cross-file-tracer");
    whole["wholeDiff"] = json!(true);
    whole["focus"] = json!("Whole-diff role — reason over the ENTIRE diff.");
    let roster =
        Roster::parse(&json!({ "tier": "large", "entries": [whole] })).expect("valid roster");
    assert_eq!(roster.entries[0].whole_diff, Some(true));
    let back = serde_json::to_value(&roster).expect("serializable");
    assert_eq!(back["entries"][0]["wholeDiff"], json!(true));
}
