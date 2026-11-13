use super::*;
use crate::schema::dossier::CheckpointHistory;

fn entry(id: &str, stage: SupervisionStage, disposition: Disposition) -> CheckpointHistory {
    CheckpointHistory {
        checkpoint_id: id.into(),
        stage,
        disposition,
        partition: None,
    }
}

fn in_partition(mut entry: CheckpointHistory, partition: &str) -> CheckpointHistory {
    entry.partition = Some(partition.into());
    entry
}

fn request<'a>(
    skill: &'a str,
    stage: SupervisionStage,
    history: &'a [CheckpointHistory],
    partition: Option<&'a str>,
) -> StageRequest<'a> {
    StageRequest {
        skill,
        stage,
        checkpoint_id: "new",
        history,
        partition,
    }
}

fn refusal(decision: &StageDecision) -> (&str, bool) {
    match decision {
        StageDecision::Refused { reason, escalate } => (reason.as_str(), *escalate),
        StageDecision::Allowed { .. } => panic!("expected a refusal, got {decision:?}"),
    }
}

#[test]
fn a_retried_checkpoint_id_spends_no_slot() {
    let history = vec![entry(
        "c1",
        SupervisionStage::Guide,
        Disposition::ContinueWithDirective,
    )];
    let decision = evaluate_stage_request(&StageRequest {
        checkpoint_id: "c1",
        ..request("mk:cook", SupervisionStage::Guide, &history, None)
    });
    assert_eq!(
        decision,
        StageDecision::Allowed {
            duplicate_of: Some("c1".into())
        }
    );
}

#[test]
fn a_stage_cannot_run_more_than_its_ceiling() {
    let history = vec![entry(
        "c1",
        SupervisionStage::Guide,
        Disposition::ContinueWithDirective,
    )];
    let decision =
        evaluate_stage_request(&request("mk:cook", SupervisionStage::Guide, &history, None));
    assert_eq!(
        refusal(&decision),
        ("GUIDE already ran 1× in this run", false)
    );
}

#[test]
fn a_second_unresolved_return_escalates() {
    let history = vec![
        entry("a", SupervisionStage::Review, Disposition::ReturnToExecutor),
        entry(
            "b",
            SupervisionStage::Recheck,
            Disposition::ReturnToExecutor,
        ),
    ];
    let decision = evaluate_stage_request(&request(
        "mk:cook",
        SupervisionStage::Rescue,
        &history,
        None,
    ));
    let (reason, escalate) = refusal(&decision);
    assert!(reason.contains("returned twice without resolution in this run"));
    assert!(escalate, "a human decides the second return");
}

#[test]
fn recheck_needs_something_to_recheck() {
    let decision =
        evaluate_stage_request(&request("mk:cook", SupervisionStage::Recheck, &[], None));
    assert_eq!(
        refusal(&decision),
        (
            "RECHECK requires a prior RETURN_TO_EXECUTOR in this run",
            false
        )
    );
}

#[test]
fn the_cap_is_reached_before_a_sixth_call() {
    let history: Vec<CheckpointHistory> = (0..5)
        .map(|i| {
            entry(
                &format!("c{i}"),
                SupervisionStage::Rescue,
                Disposition::ContinueWithDirective,
            )
        })
        .collect();
    let decision = evaluate_stage_request(&request(
        "mk:cook",
        SupervisionStage::Review,
        &history,
        None,
    ));
    let (reason, escalate) = refusal(&decision);
    assert_eq!(
        reason,
        "mk:cook reached its 5-call supervision cap in this run"
    );
    assert!(escalate);
}

#[test]
fn a_partitioned_skill_demands_a_release_stage_and_rejects_a_bogus_one() {
    let missing = evaluate_stage_request(&request("mk:ship", SupervisionStage::Guide, &[], None));
    assert_eq!(
        refusal(&missing).0,
        "mk:ship budgets supervision per release stage — name one of prepare, release, publish"
    );
    let wrong = evaluate_stage_request(&request(
        "mk:ship",
        SupervisionStage::Guide,
        &[],
        Some("staging"),
    ));
    assert_eq!(
        refusal(&wrong).0,
        "\"staging\" is not a release stage for mk:ship — expected prepare, release, publish"
    );
}

#[test]
fn an_unpartitioned_skill_refuses_a_release_stage() {
    let decision = evaluate_stage_request(&request(
        "mk:cook",
        SupervisionStage::Guide,
        &[],
        Some("prepare"),
    ));
    assert_eq!(
        refusal(&decision).0,
        "mk:cook has a per-run cap and takes no release stage"
    );
}

#[test]
fn each_release_stage_carries_its_own_per_stage_ceiling() {
    let history = vec![in_partition(
        entry(
            "p1",
            SupervisionStage::Guide,
            Disposition::ContinueWithDirective,
        ),
        "prepare",
    )];
    // Spent in `prepare`, untouched in `publish`.
    assert_eq!(
        refusal(&evaluate_stage_request(&request(
            "mk:ship",
            SupervisionStage::Guide,
            &history,
            Some("prepare")
        )))
        .0,
        "GUIDE already ran 1× in prepare"
    );
    assert_eq!(
        evaluate_stage_request(&request(
            "mk:ship",
            SupervisionStage::Guide,
            &history,
            Some("publish")
        )),
        StageDecision::Allowed { duplicate_of: None }
    );
}

#[test]
fn an_unattributable_record_is_charged_to_every_budget() {
    // Written before partitioning, or hand-edited to a stage the skill does not
    // declare. Either way it counts everywhere, which can only under-permit.
    for partition in [None, Some("staging")] {
        let mut record = entry(
            "old",
            SupervisionStage::Guide,
            Disposition::ContinueWithDirective,
        );
        record.partition = partition.map(str::to_string);
        for stage in RELEASE_STAGES {
            assert!(
                charges_to_partition("mk:ship", &record, Some(stage)),
                "{partition:?} should charge to {stage}"
            );
        }
    }
}

#[test]
fn an_unsupervised_skill_has_no_budget_at_all() {
    assert!(!is_supervised_skill("mk:review"));
    assert_eq!(skill_cap("mk:review"), None);
    assert_eq!(
        refusal(&evaluate_stage_request(&request(
            "mk:review",
            SupervisionStage::Guide,
            &[],
            None
        )))
        .0,
        "mk:review does not expose --advice"
    );
}
