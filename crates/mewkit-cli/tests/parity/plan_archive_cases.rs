//! `plan archive` against both CLIs: the statuses it stamps, the pointer it
//! clears, the directory it moves and the two refusals.
use crate::parity;

#[test]
#[ignore = "needs node and the TS build"]
fn a_dry_run_moves_nothing() {
    let Some((ts, _)) = parity::case("plan-archive-dry-run")
        .fixture("plan-archivable")
        .args(&[
            "plan",
            "archive",
            "tasks/plans/261112-demo-plan",
            "--dry-run",
        ])
        .run()
    else {
        return;
    };
    // The tree comparison proves the two agree; this proves they agree on
    // "unchanged" rather than on "archived".
    assert!(
        ts.stdout.starts_with("Plan archive (dry-run)")
            && ts.stdout.contains("(dry-run — no files written or moved)"),
        "{}",
        ts.describe()
    );
}

/// The full archive: `status: completed` across `plan.md` and every phase file,
/// `phases[*].status` in the checkpoint with every other key preserved, the
/// active pointer cleared, and the directory moved under `archive/`.
#[test]
#[ignore = "needs node and the TS build"]
fn archiving_completes_every_status_and_moves_the_directory() {
    let Some((ts, _)) = parity::case("plan-archive")
        .fixture("plan-archivable")
        .args(&["plan", "archive", "tasks/plans/261112-demo-plan"])
        .writes(&[
            "tasks/plans/archive/261112-demo-plan/plan.md",
            "tasks/plans/archive/261112-demo-plan/phase-01-setup.md",
            "tasks/plans/archive/261112-demo-plan/.plan-state.json",
        ])
        .run()
    else {
        return;
    };
    assert!(
        ts.stdout.contains("plan.md: status → completed")
            && ts.stdout.contains("phases:  1/1 set to completed")
            && ts
                .stdout
                .contains(".plan-state.json: phase statuses → completed")
            && ts.stdout.contains("active pointer: cleared"),
        "the fixture stopped exercising one of the four writes: {}",
        ts.describe()
    );
}

/// A `plan.md` path names its directory, so both spellings archive the same
/// plan.
#[test]
#[ignore = "needs node and the TS build"]
fn a_plan_md_path_archives_its_directory() {
    parity::case("plan-archive-by-file")
        .fixture("plan-archivable")
        .args(&["plan", "archive", "tasks/plans/261112-demo-plan/plan.md"])
        .writes(&["tasks/plans/archive/261112-demo-plan/plan.md"])
        .run();
}

/// Archiving twice is idempotent, not an error: the second run has nothing to
/// do and says so.
#[test]
#[ignore = "needs node and the TS build"]
fn an_already_archived_plan_is_left_alone() {
    let Some((ts, _)) = parity::case("plan-archive-idempotent")
        .fixture("plan-archived")
        .args(&["plan", "archive", "tasks/plans/archive/261112-demo-plan"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(
        ts.stdout.contains("is already archived — nothing to do."),
        "{}",
        ts.describe()
    );
}

/// A name already in the archive is NOT overwritten: the older archived plan is
/// someone's record of what happened.
#[test]
#[ignore = "needs node and the TS build"]
fn an_occupied_archive_destination_is_refused() {
    let Some((ts, _)) = parity::case("plan-archive-collision")
        .fixture("plan-archive-collision")
        .args(&["plan", "archive", "tasks/plans/261112-demo-plan"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stdout
            .contains("already exists — refusing to overwrite."),
        "{}",
        ts.describe()
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_missing_target_exits_one() {
    let Some((ts, _)) = parity::case("plan-archive-no-target")
        .fixture("plan-archivable")
        .args(&["plan", "archive"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
}

#[test]
#[ignore = "needs node and the TS build"]
fn an_absent_target_exits_one() {
    let Some((ts, _)) = parity::case("plan-archive-absent")
        .fixture("plan-archivable")
        .args(&["plan", "archive", "tasks/plans/261112-not-here"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
}

/// A directory with no `plan.md` is not a plan directory, however it is named.
#[test]
#[ignore = "needs node and the TS build"]
fn a_directory_without_a_plan_md_is_refused() {
    let Some((ts, _)) = parity::case("plan-archive-not-a-plan")
        .fixture("plan-archivable")
        .args(&["plan", "archive", "tasks/plans"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stdout.contains("not a plan directory"),
        "{}",
        ts.describe()
    );
}
