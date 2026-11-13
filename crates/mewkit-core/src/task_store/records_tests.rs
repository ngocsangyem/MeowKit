use std::path::Path;

use super::*;

const VALID: &str = r#"{
  "schemaVersion": "1.0",
  "taskId": "alpha",
  "planPath": "tasks/plans/261112-demo/plan.md",
  "status": "active",
  "currentStep": "phase 3",
  "repos": [],
  "blockers": [],
  "nextAction": "port orient",
  "verificationSummaries": [],
  "evidenceRefs": [],
  "capabilityDecisions": [],
  "writtenByCli": "2.3.1",
  "writtenByKit": "",
  "updatedAt": "2026-11-12T00:00:00Z"
}
"#;

fn record(root: &Path, id: &str, text: &str) {
    let dir = active_dir(root);
    std::fs::create_dir_all(&dir).unwrap();
    std::fs::write(dir.join(format!("{id}.json")), text).unwrap();
}

#[test]
fn an_absent_task_directory_is_no_records_rather_than_a_failure() {
    let dir = tempfile::tempdir().unwrap();
    assert_eq!(
        list_task_record_ids(dir.path()).unwrap(),
        Vec::<String>::new()
    );
    let state = reconstruct_resume_state(dir.path()).unwrap();
    assert!(state.records.is_empty() && state.issues.is_empty());
    assert_eq!(state.active_plan_pointer, None);
}

#[test]
fn ids_are_sorted_and_non_json_or_unsafe_names_are_skipped() {
    let dir = tempfile::tempdir().unwrap();
    record(dir.path(), "zeta", VALID);
    record(dir.path(), "alpha", VALID);
    // Not a record file, and a name the id regex refuses.
    std::fs::write(active_dir(dir.path()).join("notes.md"), "x").unwrap();
    std::fs::write(active_dir(dir.path()).join("Upper.json"), VALID).unwrap();
    assert_eq!(list_task_record_ids(dir.path()).unwrap(), ["alpha", "zeta"]);
}

#[test]
fn one_unreadable_record_becomes_an_issue_and_never_hides_the_others() {
    let dir = tempfile::tempdir().unwrap();
    record(dir.path(), "alpha", VALID);
    record(dir.path(), "broken", "{ not json");
    let state = reconstruct_resume_state(dir.path()).unwrap();
    assert_eq!(state.records.len(), 1);
    assert_eq!(state.records[0].task_id, "alpha");
    assert_eq!(state.issues.len(), 1);
    assert_eq!(state.issues[0].task_id, "broken");
    assert!(!state.issues[0].problem.is_empty());
}

/// The compatibility gate runs before the schema, so the operator sees WHICH
/// side is out of date — and the wording is the npm CLI's, because a hook greps
/// for it.
#[test]
fn an_unsupported_schema_version_is_refused_with_the_version_named() {
    let dir = tempfile::tempdir().unwrap();
    record(dir.path(), "future", &VALID.replace("\"1.0\"", "\"9.9\""));
    let problem = read_task_record(dir.path(), "future").unwrap_err();
    assert_eq!(
        problem,
        "Incompatible task record: record schemaVersion \"9.9\" not in supported [\"1.0\"]"
    );
}

#[test]
fn a_record_that_is_not_there_reads_as_absent_not_as_a_problem() {
    let dir = tempfile::tempdir().unwrap();
    assert_eq!(read_task_record(dir.path(), "alpha"), Ok(None));
}

/// The id regex is the containment gate: a traversal never becomes a path.
#[test]
fn an_id_that_is_not_filename_safe_is_refused() {
    let dir = tempfile::tempdir().unwrap();
    for id in ["../escape", "a/b", "", "Upper"] {
        assert!(read_task_record(dir.path(), id).is_err(), "id {id:?}");
    }
}

#[test]
fn unknown_record_keys_survive_the_read() {
    let dir = tempfile::tempdir().unwrap();
    record(
        dir.path(),
        "alpha",
        &VALID.replace("\"repos\": []", "\"repos\": [], \"futureField\": 7"),
    );
    let read = read_task_record(dir.path(), "alpha").unwrap().unwrap();
    assert_eq!(
        read.extra.get("futureField").and_then(|v| v.as_i64()),
        Some(7)
    );
}
