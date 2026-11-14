//! `plan archive` against both CLIs: the statuses it stamps, the pointer it
//! clears, the directory it moves and the two refusals.
use crate::npm;

#[test]
fn a_dry_run_moves_nothing() {
    let (ts, _) = npm::case("plan-archive-dry-run")
        .fixture("plan-archivable")
        .args(&[
            "plan",
            "archive",
            "tasks/plans/261112-demo-plan",
            "--dry-run",
        ])
        .run();
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
fn archiving_completes_every_status_and_moves_the_directory() {
    let (ts, _) = npm::case("plan-archive")
        .fixture("plan-archivable")
        .args(&["plan", "archive", "tasks/plans/261112-demo-plan"])
        .writes(&[
            "tasks/plans/archive/261112-demo-plan/plan.md",
            "tasks/plans/archive/261112-demo-plan/phase-01-setup.md",
            "tasks/plans/archive/261112-demo-plan/.plan-state.json",
        ])
        .run();
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
fn a_plan_md_path_archives_its_directory() {
    npm::case("plan-archive-by-file")
        .fixture("plan-archivable")
        .args(&["plan", "archive", "tasks/plans/261112-demo-plan/plan.md"])
        .writes(&["tasks/plans/archive/261112-demo-plan/plan.md"])
        .run();
}

/// Archiving twice is idempotent, not an error: the second run has nothing to
/// do and says so.
#[test]
fn an_already_archived_plan_is_left_alone() {
    let (ts, _) = npm::case("plan-archive-idempotent")
        .fixture("plan-archived")
        .args(&["plan", "archive", "tasks/plans/archive/261112-demo-plan"])
        .run();
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
fn an_occupied_archive_destination_is_refused() {
    let (ts, _) = npm::case("plan-archive-collision")
        .fixture("plan-archive-collision")
        .args(&["plan", "archive", "tasks/plans/261112-demo-plan"])
        .run();
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stdout
            .contains("already exists — refusing to overwrite."),
        "{}",
        ts.describe()
    );
}

#[test]
fn a_missing_target_exits_one() {
    let (ts, _) = npm::case("plan-archive-no-target")
        .fixture("plan-archivable")
        .args(&["plan", "archive"])
        .run();
    assert_eq!(ts.code, 1, "{}", ts.describe());
}

#[test]
fn an_absent_target_exits_one() {
    let (ts, _) = npm::case("plan-archive-absent")
        .fixture("plan-archivable")
        .args(&["plan", "archive", "tasks/plans/261112-not-here"])
        .run();
    assert_eq!(ts.code, 1, "{}", ts.describe());
}

/// A directory with no `plan.md` is not a plan directory, however it is named.
#[test]
fn a_directory_without_a_plan_md_is_refused() {
    let (ts, _) = npm::case("plan-archive-not-a-plan")
        .fixture("plan-archivable")
        .args(&["plan", "archive", "tasks/plans"])
        .run();
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stdout.contains("not a plan directory"),
        "{}",
        ts.describe()
    );
}
