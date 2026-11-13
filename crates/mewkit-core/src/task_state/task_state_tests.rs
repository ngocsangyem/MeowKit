use std::path::Path;

use super::*;
use crate::task_store::{active_dir, read_task_record};

const NOW: &str = "2026-11-12T00:00:00.000Z";

fn args<'a>(task_id: &'a str, status: Option<&'a str>) -> TaskStateUpdate<'a> {
    TaskStateUpdate {
        task_id: Some(task_id),
        status,
        now: NOW,
        ..TaskStateUpdate::default()
    }
}

fn record_text(root: &Path, id: &str) -> String {
    std::fs::read_to_string(active_dir(root).join(format!("{id}.json"))).unwrap()
}

#[test]
fn an_update_without_a_task_id_is_the_commands_own_refusal() {
    let dir = tempfile::tempdir().unwrap();
    assert_eq!(
        update(dir.path(), &args("", None)).err(),
        Some("`task-state update` requires a task id.\n".to_string())
    );
}

#[test]
fn an_unknown_status_is_refused_before_anything_is_written() {
    let dir = tempfile::tempdir().unwrap();
    assert_eq!(
        update(dir.path(), &args("alpha", Some("paused"))).err(),
        Some("Invalid --status \"paused\". Expected active|blocked|done.\n".to_string())
    );
    assert!(!active_dir(dir.path()).join("alpha.json").exists());
}

#[test]
fn an_update_creates_the_record_and_names_the_file_it_wrote() {
    let dir = tempfile::tempdir().unwrap();
    let done = update(
        dir.path(),
        &TaskStateUpdate {
            step: Some("ported note"),
            next: Some("port task"),
            plan: Some("tasks/plans/261112-demo/plan.md"),
            cli_version: Some("0.1.0"),
            ..args("alpha", Some("blocked"))
        },
    )
    .unwrap();
    assert_eq!(
        done.stdout,
        format!(
            "Updated task record: {}\n",
            Path::new("tasks")
                .join("active")
                .join("alpha.json")
                .display()
        )
    );
    let record = read_task_record(dir.path(), "alpha").unwrap().unwrap();
    assert_eq!(record.current_step, "ported note");
    assert_eq!(record.next_action, "port task");
    assert_eq!(record.written_by_cli, "0.1.0");
    assert_eq!(record.updated_at, NOW);
}

#[test]
fn an_omitted_status_keeps_the_recorded_one() {
    let dir = tempfile::tempdir().unwrap();
    update(dir.path(), &args("alpha", Some("blocked"))).unwrap();
    update(dir.path(), &args("alpha", None)).unwrap();
    let record = read_task_record(dir.path(), "alpha").unwrap().unwrap();
    assert_eq!(
        record.status,
        crate::schema::task_record::TaskStatus::Blocked,
        "a transition that names no status must not silently reactivate"
    );
}

#[test]
fn list_metadata_merges_across_transitions_and_never_duplicates() {
    let dir = tempfile::tempdir().unwrap();
    let first = ["ci is red".to_string()];
    let evidence = ["tasks/reports/one.md".to_string()];
    update(
        dir.path(),
        &TaskStateUpdate {
            blockers: &first,
            evidence_refs: &evidence,
            verifications: &["cargo-test=pass".to_string()],
            capability_decisions: &["cap.one|selected|it fits".to_string()],
            ..args("alpha", Some("blocked"))
        },
    )
    .unwrap();
    let second = ["ci is red".to_string(), "flaky suite".to_string()];
    update(
        dir.path(),
        &TaskStateUpdate {
            blockers: &second,
            evidence_refs: &["tasks/reports/two.md".to_string()],
            verifications: &["cargo-test=pass".to_string()],
            capability_decisions: &["cap.one|skipped|changed my mind".to_string()],
            ..args("alpha", Some("blocked"))
        },
    )
    .unwrap();
    let record = read_task_record(dir.path(), "alpha").unwrap().unwrap();
    assert_eq!(record.blockers, ["ci is red", "flaky suite"]);
    assert_eq!(
        record.evidence_refs,
        ["tasks/reports/one.md", "tasks/reports/two.md"]
    );
    assert_eq!(record.verification_summaries.len(), 1);
    // The union is keyed by capability id, so the FIRST decision for a
    // capability stands: a later call records a new capability, it does not
    // rewrite the audit trail of an earlier one.
    assert_eq!(record.capability_decisions.len(), 1);
    assert_eq!(record.capability_decisions[0].reason, "it fits");
}

#[test]
fn a_malformed_decision_token_is_refused_by_name() {
    let dir = tempfile::tempdir().unwrap();
    let err = update(
        dir.path(),
        &TaskStateUpdate {
            capability_decisions: &["cap.one|skiped|typo".to_string()],
            ..args("alpha", Some("active"))
        },
    )
    .unwrap_err();
    assert_eq!(
        err,
        "invalid capability decision \"skiped\" — \
         expected selected|skipped|unavailable|unsupported\n"
    );
    assert!(!active_dir(dir.path()).join("alpha.json").exists());

    let err = update(
        dir.path(),
        &TaskStateUpdate {
            capability_decisions: &["cap.one".to_string()],
            ..args("alpha", Some("active"))
        },
    )
    .unwrap_err();
    assert_eq!(
        err,
        "--capability-decision needs \"capId|decision|reason\": got \"cap.one\"\n"
    );
}

#[test]
fn completing_a_task_clears_only_its_own_pointer() {
    let dir = tempfile::tempdir().unwrap();
    crate::task_store::write_active_task_pointer(dir.path(), "zeta", None, None).unwrap();
    update(dir.path(), &args("alpha", Some("done"))).unwrap();
    let pointer = dir
        .path()
        .join(".meowkit")
        .join("state")
        .join("active-plan.json");
    assert!(pointer.exists(), "another live task's pointer must survive");

    crate::task_store::write_active_task_pointer(dir.path(), "alpha", None, None).unwrap();
    update(dir.path(), &args("alpha", Some("done"))).unwrap();
    assert!(!pointer.exists());
}

#[test]
fn an_incompatible_record_is_refused_loudly_and_left_alone() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::create_dir_all(active_dir(dir.path())).unwrap();
    let future = "{ \"schemaVersion\": \"9.9\", \"taskId\": \"alpha\" }";
    std::fs::write(active_dir(dir.path()).join("alpha.json"), future).unwrap();
    let err = update(dir.path(), &args("alpha", Some("done"))).unwrap_err();
    assert!(
        err.starts_with("Refusing to update: Incompatible task record: "),
        "{err}"
    );
    assert_eq!(record_text(dir.path(), "alpha"), future);
}

#[test]
fn show_reports_every_record_the_pointer_and_the_unreadable_ones() {
    let dir = tempfile::tempdir().unwrap();
    update(
        dir.path(),
        &TaskStateUpdate {
            step: Some("phase 3"),
            blockers: &["ci is red".to_string()],
            evidence_refs: &["tasks/reports/one.md".to_string()],
            capability_decisions: &["cap.one|selected|it fits".to_string()],
            ..args("alpha", Some("blocked"))
        },
    )
    .unwrap();
    crate::task_store::write_active_task_pointer(dir.path(), "alpha", None, None).unwrap();
    std::fs::write(active_dir(dir.path()).join("broken.json"), "{ not json").unwrap();

    let text = show(dir.path(), false).unwrap();
    assert!(text.starts_with("Durable task state\n"), "{text}");
    assert!(text.contains("  alpha [blocked] ◀ current\n"), "{text}");
    assert!(text.contains("    step: phase 3  next: (none)\n"), "{text}");
    assert!(text.contains("    blockers: ci is red\n"), "{text}");
    assert!(
        text.contains("    evidence: tasks/reports/one.md\n"),
        "{text}"
    );
    assert!(text.contains("    decisions: cap.one=selected\n"), "{text}");
    assert!(text.contains("  [ISSUE] broken: "), "{text}");

    let json = show(dir.path(), true).unwrap();
    let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed["records"][0]["taskId"], "alpha");
    assert_eq!(parsed["issues"][0]["taskId"], "broken");
    assert!(parsed["activePlanPointer"].is_null());
}

#[test]
fn an_empty_store_says_so_rather_than_printing_nothing() {
    let dir = tempfile::tempdir().unwrap();
    assert_eq!(
        show(dir.path(), false).unwrap(),
        "Durable task state\n  No active task records.\n"
    );
}

#[test]
fn a_verification_token_splits_on_the_first_delimiter_only() {
    let one = parse_verification("cargo-test=pass: 42 checks");
    assert_eq!(one.reference, "cargo-test");
    assert_eq!(one.result, "pass: 42 checks");
    let bare = parse_verification("cargo-test");
    assert_eq!(bare.reference, "cargo-test");
    assert_eq!(bare.result, "");
    // A leading delimiter leaves no reference, so the whole token is one.
    assert_eq!(parse_verification("=pass").reference, "=pass");
}

#[test]
fn a_decision_token_keeps_an_optional_snapshot_reference() {
    let full = parse_capability_decision("cap.one|selected|it fits|snap-7").unwrap();
    assert_eq!(full.adapter_snapshot_id.as_deref(), Some("snap-7"));
    let short = parse_capability_decision("cap.one|selected").unwrap();
    assert_eq!(short.reason, "");
    assert_eq!(short.adapter_snapshot_id, None);
}

#[test]
fn the_kit_version_is_provenance_and_never_a_failure() {
    let dir = tempfile::tempdir().unwrap();
    assert_eq!(kit_version(dir.path()), "");
    std::fs::create_dir_all(dir.path().join(".meowkit")).unwrap();
    std::fs::write(
        dir.path().join(".meowkit").join("metadata.json"),
        "{ not json",
    )
    .unwrap();
    assert_eq!(kit_version(dir.path()), "");
    std::fs::write(
        dir.path().join(".meowkit").join("metadata.json"),
        "{ \"version\": \"2.3.1\" }",
    )
    .unwrap();
    assert_eq!(kit_version(dir.path()), "2.3.1");
}
