use serde_json::{Value, json};

use super::*;

fn ev(event: &str, run: &str) -> Value {
    json!({ "event": event, "run_id": run })
}

#[test]
fn parse_skips_blank_and_malformed_lines_and_keeps_arrays() {
    let log = "{\"event\":\"a\"}\n\n{bad\n  [1]  \n\"str\"\n42\n";
    let records = parse_trace_log(log);
    assert_eq!(records, vec![json!({"event": "a"}), json!([1])]);
}

#[test]
fn tiers_follow_volume_and_diversity() {
    let few = [ev("edit", "r"), ev("edit", "r")];
    let refs: Vec<&Value> = few.iter().collect();
    assert_eq!(score_tier(&refs).tier, "minimal");

    let some = [ev("edit", "r"), ev("test", "r"), ev("edit", "r")];
    let refs: Vec<&Value> = some.iter().collect();
    let s = score_tier(&refs);
    assert_eq!((s.tier, s.types, s.has_verification), ("standard", 2, true));
}

#[test]
fn a_numeric_event_is_its_own_type_and_matches_as_text() {
    let records = [json!({"event": 5}), json!({"event": "5"}), json!({})];
    let refs: Vec<&Value> = records.iter().collect();
    assert_eq!(score_tier(&refs).types, 3);
}

#[test]
fn lanes_keep_first_seen_order_and_serialise_in_js_key_order() {
    let records = [
        ev("a", "zeta"),
        ev("b", "10"),
        json!({"event": "c"}),
        ev("d", "2"),
    ];
    let lanes = score_by_run(&records);
    let ids: Vec<&str> = lanes.iter().map(|(id, _)| id.as_str()).collect();
    assert_eq!(ids, ["zeta", "10", "(unattributed)", "2"]);
    let keys: Vec<String> = score_by_run_json(&lanes)
        .as_object()
        .unwrap()
        .keys()
        .cloned()
        .collect();
    assert_eq!(keys, ["2", "10", "zeta", "(unattributed)"]);
}

#[test]
fn entropy_rounds_to_three_places() {
    let records = [ev("a", "r"), ev("b", "r"), ev("c", "r")];
    assert_eq!(shannon_entropy(&records), 1.585);
    assert_eq!(shannon_entropy(&[]), 0.0);
}

#[test]
fn friction_normalises_groups_and_sorts() {
    // Node's own results: quotes are stripped only at the very ends, BEFORE
    // the outer whitespace is trimmed.
    assert_eq!(normalize_friction("\"Flaky   TEST!!\""), "flaky test");
    assert_eq!(
        normalize_friction("  \"Flaky TEST!!\"  "),
        "\"flaky test!!\""
    );
    assert_eq!(normalize_friction("`x`?"), "x`");
    let f = |m: &str, r: Option<&str>| {
        let mut data = json!({ "message": m });
        if let Some(r) = r {
            data["responsibility"] = json!(r);
        }
        json!({ "event": "friction", "data": data })
    };
    let records = [
        f("Slow build.", Some("ci")),
        f("b thing", None),
        f("slow   build", None),
        f("a thing", None),
    ];
    let groups = group_friction(&records);
    assert_eq!(groups[0].message, "Slow build.");
    assert_eq!(groups[0].count, 2);
    assert_eq!(groups[0].responsibility.as_deref(), Some("ci"));
    assert_eq!(groups[1].message, "a thing");
}

#[test]
fn audit_and_proposals() {
    let now = js_value_now();
    let records = [
        json!({"event": "edit", "run_id": "r1", "ts": "2020-01-01T00:00:00Z"}),
        json!({"event": "build", "run_id": "r2"}),
        json!({"event": "test", "run_id": "r2"}),
        json!({"event": "friction", "data": {"message": "x", "responsibility": "ci"}}),
        json!({"event": "friction", "data": {"message": "X."}}),
    ];
    let audit = audit_traces(&records, now, 30);
    assert_eq!(
        (
            audit.total,
            audit.orphaned,
            audit.stale,
            audit.unverified_runs
        ),
        (5, 2, 1, 1)
    );
    assert_eq!(
        audit.friction_by_responsibility,
        vec![("ci".to_string(), 1)]
    );
    let kinds: Vec<(&str, usize)> = propose_improvements(&audit)
        .iter()
        .map(|p| (p.kind, p.evidence_count))
        .collect();
    assert_eq!(
        kinds,
        [("friction", 2), ("drift", 1), ("drift", 2), ("drift", 1)]
    );
}

fn js_value_now() -> i64 {
    crate::js_value::js_date_parse_millis("2026-11-13T00:00:00Z").unwrap()
}
