use std::path::Path;

use super::*;

const RECORD: &str = r#"{
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
  "writtenByCli": "",
  "writtenByKit": "",
  "updatedAt": "2026-11-12T00:00:00Z"
}
"#;

fn write(root: &Path, rel: &str, text: &str) {
    let path = root.join(rel);
    std::fs::create_dir_all(path.parent().unwrap()).unwrap();
    std::fs::write(path, text).unwrap();
}

#[test]
fn an_empty_project_orients_to_none_in_both_output_modes() {
    let dir = tempfile::tempdir().unwrap();
    let text = orient(dir.path(), &OrientOptions::default()).unwrap();
    assert_eq!(text, format!("{UNTRUSTED_HEADER}\norientation: none"));

    let json = orient(
        dir.path(),
        &OrientOptions {
            json: true,
            record: false,
        },
    )
    .unwrap();
    assert!(
        json.starts_with("{\n  \"schemaVersion\": \"1.0\","),
        "{json}"
    );
    assert!(json.ends_with("\"outcome\": \"none\"\n}"), "{json}");
}

#[test]
fn the_sole_record_resolves_and_its_plan_is_rendered() {
    let dir = tempfile::tempdir().unwrap();
    write(dir.path(), "tasks/active/alpha.json", RECORD);
    let text = orient(dir.path(), &OrientOptions::default()).unwrap();
    assert!(text.contains("orientation: active"), "{text}");
    assert!(text.contains("task: alpha"), "{text}");
    assert!(
        text.contains("plan: tasks/plans/261112-demo/plan.md"),
        "{text}"
    );
}

#[test]
fn an_ambiguous_outcome_names_the_way_out() {
    let dir = tempfile::tempdir().unwrap();
    write(dir.path(), "tasks/active/alpha.json", RECORD);
    write(
        dir.path(),
        "tasks/active/zeta.json",
        &RECORD.replace("alpha", "zeta"),
    );
    let text = orient(dir.path(), &OrientOptions::default()).unwrap();
    assert!(text.contains("candidates: alpha, zeta"), "{text}");
    assert!(
        text.ends_with("resolve by setting the active-task pointer (activate one task)."),
        "{text}"
    );
}

/// Read-only is the contract the SessionStart hook depends on: nothing is
/// written, not even the advisory measurement, unless recording is asked for.
#[test]
fn nothing_is_written_without_recording_and_one_line_lands_with_it() {
    let dir = tempfile::tempdir().unwrap();
    write(dir.path(), "tasks/active/alpha.json", RECORD);
    orient(dir.path(), &OrientOptions::default()).unwrap();
    assert!(!dir.path().join(".meowkit").exists(), "orient wrote state");

    orient(
        dir.path(),
        &OrientOptions {
            json: false,
            record: true,
        },
    )
    .unwrap();
    let log =
        std::fs::read_to_string(dir.path().join(".meowkit/telemetry/trace-log.jsonl")).unwrap();
    assert_eq!(log.lines().count(), 1, "{log}");
    assert!(log.contains(r#""event":"orient_run""#), "{log}");
    assert!(log.contains(r#""task_id":"alpha""#), "{log}");
    assert!(log.contains(r#""outcome":"active""#), "{log}");
    // The record file itself is untouched by the measurement.
    assert_eq!(
        std::fs::read_to_string(dir.path().join("tasks/active/alpha.json")).unwrap(),
        RECORD
    );
}

/// A corrupt-only store still answers, naming the unreadable record.
#[test]
fn an_unreadable_record_does_not_stop_orientation() {
    let dir = tempfile::tempdir().unwrap();
    write(dir.path(), "tasks/active/broken.json", "{ not json");
    let text = orient(dir.path(), &OrientOptions::default()).unwrap();
    assert!(text.contains("orientation: corrupt-only"), "{text}");
    assert!(text.contains("unreadable: broken"), "{text}");
}

#[test]
fn an_unreadable_pointer_is_the_one_failure() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::create_dir_all(dir.path().join(".meowkit/state/active-plan")).unwrap();
    assert!(orient(dir.path(), &OrientOptions::default()).is_err());
}

/// The pointer is read from durable state, so a revision that moved under a
/// recorded repo is reported — and the probe reads git refs, never a binary.
#[test]
fn a_moved_repo_revision_is_reported_as_stale() {
    let dir = tempfile::tempdir().unwrap();
    let repo = dir.path().join("repo");
    write(&repo, ".git/HEAD", "ref: refs/heads/main\n");
    write(
        &repo,
        ".git/refs/heads/main",
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\n",
    );
    let record = RECORD.replace(
        "\"repos\": []",
        &format!(
            "\"repos\": [{{\"identity\": {:?}, \"revision\": \"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\"}}]",
            repo.to_string_lossy()
        ),
    );
    write(dir.path(), "tasks/active/alpha.json", &record);
    let text = orient(dir.path(), &OrientOptions::default()).unwrap();
    assert!(
        text.contains("stale: repo ") && text.contains("moved from aaaaaaa"),
        "{text}"
    );
}
