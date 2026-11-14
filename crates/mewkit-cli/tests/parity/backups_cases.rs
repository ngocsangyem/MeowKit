//! `backups` against both CLIs.
//!
//! The fixture holds two snapshots in the npm CLI's format. Restoring the
//! `init` one writes a file that is absent from the project, which takes no
//! pre-restore snapshot — a pre-restore snapshot is named by the second it was
//! taken in, so a case that created one would compare two directories whose
//! names cannot agree. That behaviour is covered by `snapshot_tests.rs`.
//!
//! Shared with the npm CLI, on purpose: with a terminal and no `--yes` the
//! restore proceeds without asking (the handler never prompts), so a
//! terminal-only path has no case here — the harness has no terminal.
use crate::parity;

const FIXTURE: &str = "backups-snapshots";
const UPGRADE: &str = "20261101T100000Z-upgrade";
const INIT: &str = "20261102T090000Z-init";

fn backups(name: &'static str, args: &[&str]) -> Option<(parity::Run, parity::Run)> {
    let mut argv = vec!["backups"];
    argv.extend_from_slice(args);
    parity::case(name).fixture(FIXTURE).args(&argv).run()
}

#[test]
#[ignore = "needs node and the TS build"]
fn list_shows_snapshots_newest_first() {
    let Some((ts, _)) = backups("backups-list", &[]) else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    let (init, upgrade) = (ts.stdout.find(INIT), ts.stdout.find(UPGRADE));
    assert!(init < upgrade && upgrade.is_some(), "{}", ts.describe());
    backups("backups-list-explicit", &["list"]);
    let Some((ts, _)) = backups("backups-list-json", &["list", "--json"]) else {
        return;
    };
    assert!(ts.stdout.contains("\"fileCount\": 2"), "{}", ts.describe());
}

#[test]
#[ignore = "needs node and the TS build"]
fn list_says_so_when_there_are_no_snapshots() {
    let Some((ts, _)) = parity::case("backups-list-none")
        .fixture("empty-project")
        .args(&["backups"])
        .run()
    else {
        return;
    };
    assert!(ts.stdout.contains("No snapshots."), "{}", ts.describe());
    parity::case("backups-list-none-json")
        .fixture("empty-project")
        .args(&["backups", "list", "--json"])
        .run();
}

#[test]
#[ignore = "needs node and the TS build"]
fn restore_refuses_without_an_id_and_for_an_unknown_one() {
    let Some((ts, _)) = backups("backups-restore-no-id", &["restore"]) else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stderr.contains("needs a snapshot id"),
        "{}",
        ts.describe()
    );
    let Some((ts, _)) = backups("backups-restore-unknown", &["restore", "nope", "--yes"]) else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stderr.contains("No snapshot named nope. Available:"),
        "{}",
        ts.describe()
    );
    backups(
        "backups-restore-unknown-json",
        &["restore", "nope", "--json"],
    );
    parity::case("backups-restore-unknown-none")
        .fixture("empty-project")
        .args(&["backups", "restore", "nope"])
        .run();
}

#[test]
#[ignore = "needs node and the TS build"]
fn restore_without_a_terminal_or_yes_prints_the_plan_and_exits_3() {
    let Some((ts, _)) = parity::case("backups-restore-blind")
        .fixture(FIXTURE)
        .args(&["backups", "restore", UPGRADE])
        .writes(&[])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 3, "{}", ts.describe());
    assert!(
        ts.stdout.contains("restore .claude/a.md"),
        "{}",
        ts.describe()
    );
    assert!(
        ts.stdout.contains("1 already identical"),
        "{}",
        ts.describe()
    );
    assert!(ts.stderr.contains("Re-run with --yes"), "{}", ts.describe());
    let Some((ts, _)) = backups(
        "backups-restore-blind-json",
        &["restore", UPGRADE, "--json"],
    ) else {
        return;
    };
    assert!(
        ts.stdout.contains("\"needsConfirmation\": true"),
        "{}",
        ts.describe()
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn dry_run_prints_the_plan_and_exits_0() {
    let Some((ts, _)) = backups(
        "backups-restore-dry-run",
        &["restore", UPGRADE, "--dry-run"],
    ) else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(
        ts.stdout.contains("Would restore 1 file(s)"),
        "{}",
        ts.describe()
    );
    backups(
        "backups-restore-dry-run-json",
        &["restore", UPGRADE, "--dry-run", "--json"],
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn restore_with_yes_writes_the_missing_file_back() {
    let Some((ts, _)) = parity::case("backups-restore-yes")
        .fixture(FIXTURE)
        .args(&["backups", "restore", INIT, "--yes"])
        .writes(&[".claude/c.md"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(
        ts.stdout.contains("restored .claude/c.md"),
        "{}",
        ts.describe()
    );
    assert!(
        !ts.stdout.contains("undoable"),
        "no pre-restore snapshot: {}",
        ts.describe()
    );
    parity::case("backups-restore-yes-json")
        .fixture(FIXTURE)
        .args(&["backups", "restore", INIT, "--yes", "--json"])
        .writes(&[".claude/c.md"])
        .run();
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_mistyped_subcommand_is_an_invocation_error() {
    let Some((ts, _)) = backups("backups-unknown-sub", &["purge"]) else {
        return;
    };
    assert_eq!(ts.code, 2, "{}", ts.describe());
    assert!(
        ts.stderr.contains("Valid subcommands: list, restore"),
        "{}",
        ts.describe()
    );
}
