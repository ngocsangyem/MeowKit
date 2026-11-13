//! `advice status` — what a resuming parent reads back.
use super::advice;
use super::fixtures::{COMMITTED, CORRUPT, SHIP};

#[test]
#[ignore = "needs node and the TS build"]
fn status_reports_the_budget_and_says_what_it_is_not() {
    let Some((ts, _)) = advice(
        "advice-status-run",
        Some(COMMITTED),
        &["status", "--run", "demo-run"],
    )
    .run() else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(
        ts.stdout
            .contains("  skill: mk:cook   calls: 1/5   corrections: 0")
    );
    assert!(
        ts.stdout
            .contains("supervision continuity — never verification, never a gate approval.")
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_partitioned_run_reports_the_budget_it_is_about_to_spend_from() {
    let Some((ts, _)) = advice(
        "advice-status-ship",
        Some(SHIP),
        &["status", "--run", "ship-run"],
    )
    .run() else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(
        ts.stdout
            .contains("calls per release stage: prepare 1/4   release 0/4   publish 0/4"),
        "{}",
        ts.stdout
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn status_json_is_the_dossier_verbatim_and_carries_no_authority() {
    let Some((ts, _)) = advice(
        "advice-status-json",
        Some(COMMITTED),
        &["status", "--run", "demo-run", "--json"],
    )
    .run() else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(ts.stdout.contains("\"escalatedToHuman\": false"));
    for authority in ["\"approval\"", "\"approved\"", "\"gate2\"", "\"verdict\""] {
        assert!(
            !ts.stdout.contains(authority),
            "{authority} reached the dossier: {}",
            ts.stdout
        );
    }
}

#[test]
#[ignore = "needs node and the TS build"]
fn an_absent_run_is_reported_rather_than_invented() {
    let Some((ts, _)) = advice("advice-status-absent", None, &["status", "--run", "nope"]).run()
    else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(ts.stdout.contains("No supervision run \"nope\"."));
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_damaged_record_stops_supervision_instead_of_reading_as_a_fresh_run() {
    let Some((ts, _)) = advice(
        "advice-status-corrupt",
        Some(CORRUPT),
        &["status", "--run", "demo-run"],
    )
    .run() else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stderr
            .contains("is unreadable (history is not valid JSON)")
    );
    assert!(
        ts.stderr
            .contains("The ordinary workflow continues unsupervised — it is not blocked by this.")
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_run_id_that_is_not_a_filename_never_reaches_the_filesystem() {
    // The dossier path is built FROM the run id, so an id that is not a slug is
    // refused where the path is built rather than where it is used.
    let Some((ts, _)) = advice(
        "advice-status-path-escape",
        None,
        &["status", "--run", "../escape"],
    )
    .run() else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert_eq!(
        ts.stderr.trim(),
        "Fatal: invalid supervision run id: \"../escape\""
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn status_needs_a_run() {
    let Some((ts, _)) = advice("advice-status-no-run", None, &["status"]).run() else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stderr
            .contains("`advice status` requires --run <supervisionRunId>.")
    );
}
