use std::path::Path;

use super::*;

fn state_file(root: &Path, name: &str, text: &str) {
    let dir = root.join(".meowkit").join("state");
    std::fs::create_dir_all(&dir).unwrap();
    std::fs::write(dir.join(name), text).unwrap();
}

#[test]
fn no_pointer_file_is_no_pointer() {
    let dir = tempfile::tempdir().unwrap();
    assert_eq!(read_active_task_pointer(dir.path()).unwrap(), None);
    assert_eq!(read_active_plan_pointer(dir.path()).unwrap(), None);
}

#[test]
fn a_task_identified_pointer_reads_as_canonical() {
    let dir = tempfile::tempdir().unwrap();
    state_file(
        dir.path(),
        "active-plan.json",
        r#"{"schemaVersion":"1.0","taskId":"alpha","planPath":"tasks/plans/x/plan.md","planSlug":"x","path":"tasks/plans/x/plan.md"}"#,
    );
    let read = read_active_task_pointer(dir.path()).unwrap().unwrap();
    assert_eq!(read.kind(), "canonical");
    let ActiveTaskPointerRead::Canonical(pointer) = read else {
        panic!("expected the canonical shape");
    };
    assert_eq!(pointer.task_id, "alpha");
    // The legacy mirror survives the read, so a round-trip cannot drop it.
    assert_eq!(
        pointer.extra.get("path").and_then(|v| v.as_str()),
        Some("tasks/plans/x/plan.md")
    );
    // The plain-string reader sees the same file through the mirror.
    assert_eq!(
        read_active_plan_pointer(dir.path()).unwrap().as_deref(),
        Some("tasks/plans/x/plan.md")
    );
}

#[test]
fn a_pre_canonical_payload_reads_as_a_legacy_plan_reference() {
    let dir = tempfile::tempdir().unwrap();
    state_file(
        dir.path(),
        "active-plan.json",
        r#"{"slug":" 261112-demo "}"#,
    );
    assert_eq!(
        read_active_task_pointer(dir.path()).unwrap(),
        Some(ActiveTaskPointerRead::Legacy {
            plan_ref: "261112-demo".to_string()
        })
    );
}

/// `path` shadows `slug` whenever it is a non-empty string — whitespace
/// included, because the JavaScript reader picks with `||` before it trims.
#[test]
fn an_all_whitespace_path_still_shadows_the_slug() {
    let dir = tempfile::tempdir().unwrap();
    state_file(
        dir.path(),
        "active-plan.json",
        r#"{"path":"   ","slug":"261112-demo"}"#,
    );
    assert_eq!(read_active_task_pointer(dir.path()).unwrap(), None);
}

/// Unparseable JSON, or a valid `taskId` with an otherwise wrong payload, falls
/// through to the next reader rather than failing the command.
#[test]
fn unreadable_content_falls_through_to_the_plain_text_pointer() {
    let dir = tempfile::tempdir().unwrap();
    state_file(dir.path(), "active-plan.json", "{ not json");
    state_file(dir.path(), "active-plan", "261112-demo\n");
    assert_eq!(
        read_active_task_pointer(dir.path()).unwrap(),
        Some(ActiveTaskPointerRead::Legacy {
            plan_ref: "261112-demo".to_string()
        })
    );

    state_file(
        dir.path(),
        "active-plan.json",
        r#"{"schemaVersion":"9.9","taskId":"alpha"}"#,
    );
    assert_eq!(
        read_active_task_pointer(dir.path()).unwrap(),
        Some(ActiveTaskPointerRead::Legacy {
            plan_ref: "261112-demo".to_string()
        })
    );
}

/// The last reader has no fallback left, so an unreadable file there is a
/// failure: "no current task" and "the pointer cannot be read" are different
/// facts, and guessing the first one is the dangerous direction.
#[test]
fn an_unreadable_plain_text_pointer_fails_loudly() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir
        .path()
        .join(".meowkit")
        .join("state")
        .join("active-plan");
    std::fs::create_dir_all(&path).unwrap(); // a directory where a file belongs
    let error = read_active_task_pointer(dir.path()).unwrap_err();
    assert!(
        error
            .to_string()
            .contains("cannot read the active-task pointer"),
        "{error}"
    );
}
