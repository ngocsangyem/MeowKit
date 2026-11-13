use super::*;
use crate::schema::dossier::FORBIDDEN_DOSSIER_FIELDS;

fn fresh(run_id: &str, skill: &str) -> Dossier {
    Dossier {
        run_id: run_id.into(),
        skill: skill.into(),
        stage: SupervisionStage::Guide,
        locked_decision_pointers: Vec::new(),
        latest_directive: String::new(),
        correction_count: 0,
        receipt_pointers: Vec::new(),
        next_safe_action: String::new(),
        checkpoint: None,
        history: Vec::new(),
        escalated_to_human: false,
    }
}

fn commit(dossier: Dossier, disposition: Disposition, receipt: Option<&str>) -> Dossier {
    commit_checkpoint(
        dossier,
        &CommitResult {
            latest_directive: "do the small thing".into(),
            next_safe_action: "run the tests".into(),
            disposition,
            receipt_pointer: receipt.map(str::to_string),
            corrections: 0,
        },
    )
}

#[test]
fn a_committed_call_lands_in_the_history_that_caps_count() {
    let opened = begin_checkpoint(
        fresh("run-1", "mk:cook"),
        "cp-1".into(),
        SupervisionStage::Guide,
        None,
    );
    assert_eq!(
        opened.checkpoint.as_ref().map(|c| c.state),
        Some(CheckpointState::Pending)
    );
    let committed = commit(opened, Disposition::ContinueWithDirective, Some("r.md"));
    assert_eq!(committed.history.len(), 1);
    assert_eq!(committed.history[0].checkpoint_id, "cp-1");
    assert_eq!(
        committed.checkpoint.as_ref().map(|c| c.state),
        Some(CheckpointState::Committed)
    );
    assert_eq!(committed.receipt_pointers, vec!["r.md".to_string()]);
}

#[test]
fn recommitting_one_id_replaces_its_entry_rather_than_inflating_the_count() {
    let mut dossier = begin_checkpoint(
        fresh("run-1", "mk:cook"),
        "cp-1".into(),
        SupervisionStage::Guide,
        None,
    );
    dossier = commit(dossier, Disposition::ContinueWithDirective, Some("r.md"));
    dossier = commit(dossier, Disposition::EscalateToHuman, Some("r.md"));
    assert_eq!(dossier.history.len(), 1, "a retry is not a second call");
    assert_eq!(dossier.history[0].disposition, Disposition::EscalateToHuman);
    assert_eq!(dossier.receipt_pointers.len(), 1, "pointers stay a set");
}

#[test]
fn the_budget_a_call_spends_is_fixed_when_the_slot_is_claimed() {
    let opened = begin_checkpoint(
        fresh("run-1", "mk:ship"),
        "cp-1".into(),
        SupervisionStage::Review,
        Some("publish".into()),
    );
    let committed = commit(opened, Disposition::ReadyForExistingGate, None);
    assert_eq!(
        committed.history[0].partition.as_deref(),
        Some("publish"),
        "the partition comes from the marker, never from the commit call"
    );
}

#[test]
fn a_round_trip_through_disk_keeps_the_history_the_caps_read() {
    let project = tempfile::tempdir().expect("a temp project");
    let root = project.path();
    let written = update_dossier(root, "run-1", |existing| {
        assert!(existing.is_none(), "a fresh run has no record");
        Ok(begin_checkpoint(
            fresh("run-1", "mk:cook"),
            "cp-1".into(),
            SupervisionStage::Guide,
            None,
        ))
    })
    .expect("the first write lands");
    assert_eq!(written.checkpoint.expect("a marker").checkpoint_id, "cp-1");

    update_dossier(root, "run-1", |existing| {
        Ok(commit(
            existing.expect("the run is on disk"),
            Disposition::ContinueWithDirective,
            None,
        ))
    })
    .expect("the second write lands");

    let read = read_dossier(root, "run-1").expect("a readable path");
    let DossierRead::Found(dossier) = read else {
        panic!("expected the run back, got {read:?}");
    };
    assert_eq!(dossier.history.len(), 1);
    assert_eq!(dossier.latest_directive, "do the small thing");
    assert_eq!(
        list_supervision_runs(root)
            .iter()
            .map(|(id, _)| id.as_str())
            .collect::<Vec<_>>(),
        vec!["run-1"]
    );
}

#[test]
fn a_damaged_record_stops_supervision_instead_of_resetting_the_budget() {
    let project = tempfile::tempdir().expect("a temp project");
    let root = project.path();
    let reports = root.join("tasks").join("reports");
    std::fs::create_dir_all(&reports).expect("the reports directory");
    std::fs::write(reports.join("run-1-athena-supervision.md"), "not a dossier")
        .expect("a damaged record");

    assert!(matches!(
        read_dossier(root, "run-1"),
        Ok(DossierRead::Corrupt(_))
    ));
    // Fail closed inside the lock too: a fresh record here would hand the run a
    // brand-new budget, so breaking the file would buy unlimited supervision.
    let refused = update_dossier(root, "run-1", |_| Ok(fresh("run-1", "mk:cook")))
        .expect_err("a damaged record is not overwritten");
    assert!(matches!(refused, StoreError::Corrupt { .. }));
    assert_eq!(
        std::fs::read_to_string(reports.join("run-1-athena-supervision.md")).expect("still there"),
        "not a dossier"
    );
}

#[test]
fn nothing_a_checkpoint_writes_can_carry_an_approval() {
    // The dossier is the durable half of supervision. Its schema refuses every
    // field that would turn continuity into authority, so "the dossier says
    // approved" is unwritable rather than merely discouraged.
    let project = tempfile::tempdir().expect("a temp project");
    let root = project.path();
    let dossier = update_dossier(root, "run-1", |_| {
        Ok(commit(
            begin_checkpoint(
                fresh("run-1", "mk:cook"),
                "cp-1".into(),
                SupervisionStage::Review,
                None,
            ),
            Disposition::ReadyForExistingGate,
            Some("tasks/reports/261113-run-1-advice-1.md"),
        ))
    })
    .expect("the write lands");

    let value = serde_json::to_value(&dossier).expect("a dossier serializes");
    let object = value.as_object().expect("an object");
    for forbidden in FORBIDDEN_DOSSIER_FIELDS {
        assert!(
            !object.contains_key(*forbidden),
            "the dossier must not carry {forbidden}"
        );
    }
    let rendered = std::fs::read_to_string(root.join("tasks/reports/run-1-athena-supervision.md"))
        .expect("the rendered record");
    assert!(
        rendered.contains("NEVER verification and never a gate approval"),
        "the artifact says what it is not"
    );
    for word in ["approval:", "approved:", "gate1:", "gate2:", "verdict:"] {
        assert!(!rendered.contains(word), "{word} reached the artifact");
    }
}

#[test]
fn history_kept_below_the_active_summary_survives_a_rewrite() {
    let project = tempfile::tempdir().expect("a temp project");
    let root = project.path();
    update_dossier(root, "run-1", |_| Ok(fresh("run-1", "mk:cook"))).expect("the first write");
    let target = root.join("tasks/reports/run-1-athena-supervision.md");
    let kept = format!(
        "{}{HISTORY_MARKER}older receipts live here\n",
        std::fs::read_to_string(&target).expect("the record")
    );
    std::fs::write(&target, kept).expect("append the history");

    update_dossier(root, "run-1", |existing| {
        Ok(Dossier {
            latest_directive: "a newer directive".into(),
            ..existing.expect("the run")
        })
    })
    .expect("the rewrite");
    let after = std::fs::read_to_string(&target).expect("the record");
    assert!(after.contains("older receipts live here"));
    assert!(after.contains("a newer directive"));
}
