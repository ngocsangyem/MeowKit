use std::path::Path;

use super::*;
use crate::schema::task_record::{TaskRecord, TaskStatus};

fn seed(root: &Path, id: &str, now: &str) -> TaskRecord {
    update_task_record(root, id, |current| {
        assert!(current.is_none());
        Ok(TaskRecord {
            updated_at: now.to_string(),
            ..blank_record(id)
        })
    })
    .unwrap()
}

#[test]
fn a_written_record_round_trips_through_the_reader() {
    let dir = tempfile::tempdir().unwrap();
    seed(dir.path(), "alpha", "2026-11-12T00:00:00.000Z");
    let read = read_task_record(dir.path(), "alpha").unwrap().unwrap();
    assert_eq!(read.task_id, "alpha");
    assert_eq!(read.status, TaskStatus::Active);
    // Two-space JSON with a trailing newline, as the npm CLI writes it, and no
    // scratch file left beside it.
    let text = std::fs::read_to_string(active_dir(dir.path()).join("alpha.json")).unwrap();
    assert!(
        text.starts_with("{\n  \"schemaVersion\": \"1.0\","),
        "{text}"
    );
    assert!(text.ends_with("}\n"), "{text}");
    let left: Vec<String> = std::fs::read_dir(active_dir(dir.path()))
        .unwrap()
        .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
        .collect();
    assert_eq!(left, ["alpha.json"]);
}

#[test]
fn an_unknown_additive_field_survives_an_update() {
    let dir = tempfile::tempdir().unwrap();
    seed(dir.path(), "alpha", "2026-11-12T00:00:00.000Z");
    let path = active_dir(dir.path()).join("alpha.json");
    let mut value: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
    value["futureField"] = serde_json::json!("keep me");
    std::fs::write(&path, serde_json::to_string_pretty(&value).unwrap()).unwrap();

    update_task_record(dir.path(), "alpha", |current| {
        Ok(TaskRecord {
            current_step: "phase 3".to_string(),
            ..current.cloned().unwrap()
        })
    })
    .unwrap();
    let after = std::fs::read_to_string(&path).unwrap();
    assert!(after.contains("\"futureField\": \"keep me\""), "{after}");
}

#[test]
fn a_record_this_binary_cannot_read_is_never_clobbered() {
    let dir = tempfile::tempdir().unwrap();
    let dest = active_dir(dir.path());
    std::fs::create_dir_all(&dest).unwrap();
    let future = "{\n  \"schemaVersion\": \"9.9\",\n  \"taskId\": \"alpha\"\n}\n";
    std::fs::write(dest.join("alpha.json"), future).unwrap();
    let err = update_task_record(dir.path(), "alpha", |_| Ok(blank_record("alpha"))).unwrap_err();
    assert!(
        matches!(err, RecordWriteError::Incompatible(ref m) if m.contains("not in supported")),
        "{err}"
    );
    assert_eq!(
        std::fs::read_to_string(dest.join("alpha.json")).unwrap(),
        future
    );
}

#[test]
fn an_unsafe_id_never_reaches_the_filesystem() {
    let dir = tempfile::tempdir().unwrap();
    let err =
        update_task_record(dir.path(), "../escape", |_| Ok(blank_record("alpha"))).unwrap_err();
    assert!(matches!(err, RecordWriteError::Invalid(_)), "{err}");
    assert!(!dir.path().join("escape.json").exists());
}

#[test]
fn activation_writes_the_record_and_the_canonical_pointer() {
    let dir = tempfile::tempdir().unwrap();
    let outcome = activate_task(
        dir.path(),
        &ActivateTask {
            task_id: "alpha",
            now: "2026-11-12T00:00:00.000Z",
            cli_version: Some("2.3.1"),
            next_action: Some("begin work"),
            ..ActivateTask::default()
        },
    )
    .unwrap();
    assert!(outcome.created_record);
    assert_eq!(outcome.record.next_action, "begin work");
    let pointer = std::fs::read_to_string(
        dir.path()
            .join(".meowkit")
            .join("state")
            .join("active-plan.json"),
    )
    .unwrap();
    assert!(pointer.starts_with("{\n  \"schemaVersion\": \"1.0\",\n  \"taskId\": \"alpha\""));
    // No plan association means no legacy mirror pointing at nothing.
    assert!(!pointer.contains("\"path\""), "{pointer}");

    // Re-activating keeps exactly one record and reports it was not created.
    let again = activate_task(
        dir.path(),
        &ActivateTask {
            task_id: "alpha",
            now: "2026-11-12T01:00:00.000Z",
            plan_path: Some("tasks/plans/261112-demo/plan.md"),
            plan_slug: Some("261112-demo"),
            ..ActivateTask::default()
        },
    )
    .unwrap();
    assert!(!again.created_record);
    let pointer = std::fs::read_to_string(
        dir.path()
            .join(".meowkit")
            .join("state")
            .join("active-plan.json"),
    )
    .unwrap();
    // The mirror the installed checkpoint reader reads.
    assert!(pointer.contains("\"path\": \"tasks/plans/261112-demo/plan.md\""));
    assert!(pointer.contains("\"slug\": \"261112-demo\""));
}

#[test]
fn clearing_a_pointer_only_touches_the_task_that_owns_it() {
    let dir = tempfile::tempdir().unwrap();
    activate_task(
        dir.path(),
        &ActivateTask {
            task_id: "alpha",
            now: "2026-11-12T00:00:00.000Z",
            ..ActivateTask::default()
        },
    )
    .unwrap();
    assert!(!clear_active_task_pointer(dir.path(), "zeta").unwrap());
    assert!(clear_active_task_pointer(dir.path(), "alpha").unwrap());
    // Absent is a no-op, not a failure.
    assert!(!clear_active_task_pointer(dir.path(), "alpha").unwrap());
}

#[test]
fn a_record_can_be_removed_for_rollback() {
    let dir = tempfile::tempdir().unwrap();
    seed(dir.path(), "alpha", "2026-11-12T00:00:00.000Z");
    assert!(remove_task_record(dir.path(), "alpha").unwrap());
    assert!(!remove_task_record(dir.path(), "alpha").unwrap());
}

#[test]
fn the_low_level_put_validates_before_it_writes() {
    let dir = tempfile::tempdir().unwrap();
    let bad = TaskRecord {
        schema_version: "0.9".to_string(),
        ..blank_record("alpha")
    };
    assert!(write_task_record(dir.path(), &bad).is_err());
    assert!(!active_dir(dir.path()).join("alpha.json").exists());
}

/// The all-or-fail guarantee: a record THIS call created is removed again when
/// the pointer cannot be committed. A record with no pointer is a task nothing
/// can resume, and it would make the next orientation ambiguous.
#[test]
fn a_failed_pointer_commit_rolls_back_a_record_this_call_created() {
    let dir = tempfile::tempdir().unwrap();
    // A FILE where the pointer DIRECTORY belongs: the commit cannot create it,
    // which is a pointer failure without needing a broken permission bit.
    std::fs::create_dir_all(dir.path().join(".meowkit")).unwrap();
    std::fs::write(dir.path().join(".meowkit/state"), "not a directory").unwrap();

    // Matched rather than unwrapped: the two failure modes are reported
    // differently to the operator, so a record failure here must not pass.
    let Err(ActivationFailure::Pointer(err)) = activate_task(
        dir.path(),
        &ActivateTask {
            task_id: "alpha",
            now: "2026-11-12T00:00:00.000Z",
            ..ActivateTask::default()
        },
    ) else {
        panic!("the pointer commit must fail, and not as a record failure");
    };
    assert_eq!(err.task_id, "alpha");
    assert!(err.rolled_back, "{err:?}");
    assert!(
        !active_dir(dir.path()).join("alpha.json").exists(),
        "the record this call created must be gone"
    );
}

/// Re-activation overwrites what the caller OWNS and preserves what it does
/// not, so a second approval does not erase the step a task was on.
#[test]
fn re_activating_preserves_the_fields_the_caller_did_not_supply() {
    let dir = tempfile::tempdir().unwrap();
    update_task_record(dir.path(), "alpha", |_| {
        Ok(TaskRecord {
            current_step: "halfway".to_string(),
            blockers: vec!["waiting on review".to_string()],
            updated_at: "2026-11-01T00:00:00.000Z".to_string(),
            ..blank_record("alpha")
        })
    })
    .unwrap();

    let outcome = activate_task(
        dir.path(),
        &ActivateTask {
            task_id: "alpha",
            now: "2026-11-12T00:00:00.000Z",
            next_action: Some("begin approved plan"),
            ..ActivateTask::default()
        },
    )
    .unwrap();
    assert!(!outcome.created_record);
    assert_eq!(outcome.record.current_step, "halfway");
    assert_eq!(outcome.record.blockers, vec!["waiting on review"]);
    assert_eq!(outcome.record.next_action, "begin approved plan");
    assert_eq!(outcome.record.updated_at, "2026-11-12T00:00:00.000Z");
}
