use super::*;

use serde_json::json;

/// Provenance is pinned per record rather than read from the environment: this
/// workspace forbids `unsafe`, so a test cannot set an env var, and a leaked
/// `MEOWKIT_*` from the invoking shell would otherwise decide the assertion.
fn fixed(event: &str, data: Map<String, Value>) -> TraceRecord {
    TraceRecord {
        event: event.to_string(),
        data,
        run_id: Some(String::new()),
        model: Some(String::new()),
        density: Some(String::new()),
        harness_version: Some("3.0.0".to_string()),
        now_millis: Some(1_762_900_000_000),
        ..TraceRecord::default()
    }
}

fn object(pairs: &[(&str, Value)]) -> Map<String, Value> {
    pairs
        .iter()
        .map(|(k, v)| ((*k).to_string(), v.clone()))
        .collect()
}

#[test]
fn the_line_matches_the_field_order_the_typescript_writer_emits() {
    let record = fixed(
        "orient_run",
        object(&[
            ("outcome", json!("none")),
            ("staleWarnings", json!(0)),
            ("durationMs", json!(0)),
        ]),
    );
    assert_eq!(
        build(&record, 1_762_900_000_000).to_string(),
        r#"{"schema_version":"1.0","ts":"2025-11-11T22:26:40Z","event":"orient_run","run_id":"","harness_version":"3.0.0","model":"","density":"","data":{"outcome":"none","staleWarnings":0,"durationMs":0}}"#
    );
}

#[test]
fn an_absent_task_or_plan_leaves_its_key_out() {
    let line = build(&fixed("orient_run", Map::new()), 0).to_string();
    assert!(!line.contains("task_id"), "{line}");
    assert!(!line.contains("plan_path"), "{line}");

    let mut record = fixed("orient_run", Map::new());
    record.task_id = Some("alpha".to_string());
    let line = build(&record, 0).to_string();
    assert!(line.contains(r#""task_id":"alpha","data""#), "{line}");
}

#[test]
fn every_string_position_is_scrubbed_including_keys() {
    let secret = "ghp_0123456789abcdefghijklmnopqrstuvwx";
    let mut record = fixed(
        "orient_run",
        object(&[(secret, json!([format!("tail {secret}")]))]),
    );
    record.task_id = Some(secret.to_string());
    let line = build(&record, 0).to_string();
    assert!(
        !line.contains(secret),
        "the token survived somewhere in {line}"
    );
}

#[test]
fn appending_creates_the_telemetry_tree_and_one_line_per_record() {
    let dir = tempfile::tempdir().unwrap();
    for event in ["orient_run", "orient_run"] {
        append_trace_record(dir.path(), &fixed(event, Map::new())).unwrap();
    }
    let log = dir.path().join(".meowkit/telemetry/trace-log.jsonl");
    let text = std::fs::read_to_string(&log).unwrap();
    assert_eq!(text.lines().count(), 2, "{text}");
    assert!(text.ends_with('\n'));
    assert!(
        !dir.path()
            .join(".meowkit/telemetry/.trace-log.lock")
            .exists(),
        "the lock is released, so it never shows up as written state"
    );
}

#[test]
fn an_oversized_log_rotates_to_a_gzip_and_restarts_empty() {
    let dir = tempfile::tempdir().unwrap();
    let mut record = fixed("orient_run", Map::new());
    record.max_bytes = Some(10); // one line already exceeds this
    append_trace_record(dir.path(), &record).unwrap();
    let telemetry = dir.path().join(".meowkit/telemetry");
    assert_eq!(
        std::fs::read_to_string(telemetry.join(TRACE_LOG_NAME)).unwrap(),
        ""
    );
    let rotated: Vec<String> = std::fs::read_dir(&telemetry)
        .unwrap()
        .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
        .filter(|n| n.ends_with(".gz"))
        .collect();
    assert_eq!(rotated, vec!["trace-log.251111-222640.jsonl.gz"]);
}
