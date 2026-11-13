//! `task new|list` against both CLIs: the scaffolded file, the table, and the
//! durable activation.
//!
//! ## Why the `task new` cases pin `TZ`
//!
//! The filename stamp is the LOCAL calendar date in BOTH CLIs, and both read
//! the zone from `TZ` (Node natively, this one through `jiff`). The pin is not
//! papering over a divergence — it makes the comparison REPRODUCIBLE, so a case
//! means the same thing on a developer's machine and on a CI runner. Two zones
//! are pinned across the cases below, one of them several hours from UTC, so a
//! stamp that silently went back to UTC would fail rather than pass by
//! coincidence on a UTC runner.
use crate::parity;

/// The zone most `new` cases run in. UTC is the boring baseline.
const UTC: &str = "UTC";
/// A zone far from UTC, for the case that proves the stamp is actually local.
const OFFSET_ZONE: &str = "Asia/Ho_Chi_Minh";

/// A `new` case: the fixture, a pinned zone, and the arguments.
fn new_case_in(zone: &str, name: &'static str, args: &[&str]) -> parity::Case {
    parity::case(name)
        .fixture("task-empty-project")
        .env("TZ", zone)
        .args(args)
}

/// A `new` case in UTC.
fn new_case(name: &'static str, args: &[&str]) -> parity::Case {
    new_case_in(UTC, name, args)
}

/// Clap renders its own missing/unknown-subcommand error; the npm CLI renders
/// the catalogue's. Both exit 2, which is the contract a script checks.
const SUBCOMMAND_WORDING: &str = "a usage error for the sub-verb slot is each parser's own text; \
     the exit code is what callers check";

#[test]
#[ignore = "needs node and the TS build"]
fn a_bare_task_is_a_usage_error() {
    let Some((ts, _)) = parity::case("task-missing-subcommand")
        .fixture("task-empty-project")
        .args(&["task"])
        // Only stderr is allowed to differ: both CLIs print the refusal there
        // and leave stdout EMPTY, so stdout stays compared.
        .ignore_stderr(SUBCOMMAND_WORDING)
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 2, "{}", ts.describe());
}

#[test]
#[ignore = "needs node and the TS build"]
fn an_unknown_task_subcommand_is_a_usage_error() {
    let Some((ts, _)) = parity::case("task-unknown-subcommand")
        .fixture("task-empty-project")
        .args(&["task", "frobnicate"])
        .ignore_stderr(SUBCOMMAND_WORDING)
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 2, "{}", ts.describe());
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_new_task_file_is_written_the_same_way_by_both_clis() {
    let Some((ts, _)) = new_case("task-new", &["task", "new", "Add user authentication"]).run()
    else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(
        ts.stdout.contains("add-user-authentication.feature.md"),
        "{}",
        ts.describe()
    );
}

/// The same creation in a zone seven hours from UTC.
///
/// This is the case the local-date port exists for: for seven hours of every
/// day the local calendar and the UTC one disagree, and both CLIs must still
/// write the SAME filename — while `created:` in the frontmatter stays UTC in
/// both, which the file comparison also checks. On a UTC runner the window is
/// not controllable, so what this pins is that the two agree under a non-UTC
/// zone at whatever hour it runs.
#[test]
#[ignore = "needs node and the TS build"]
fn a_new_task_file_is_named_by_the_local_date_in_both_clis() {
    let Some((ts, _)) = new_case_in(
        OFFSET_ZONE,
        "task-new-non-utc-zone",
        &["task", "new", "Add user authentication"],
    )
    .run() else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(
        ts.stdout.contains("add-user-authentication.feature.md"),
        "{}",
        ts.describe()
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn the_type_and_priority_flags_reach_the_file_name_and_the_frontmatter() {
    let Some((ts, _)) = new_case(
        "task-new-type-priority",
        &[
            "task",
            "new",
            "--type",
            "bug-fix",
            "--priority",
            "high",
            "Fix null session crash",
        ],
    )
    .run() else {
        return;
    };
    // `bug-fix` shortens to `bug` in the name — a mapping worth proving.
    assert!(
        ts.stdout.contains("fix-null-session-crash.bug.md"),
        "{}",
        ts.describe()
    );
}

/// A description that escaped its quotes is still one sentence: the npm CLI
/// joins the remaining positionals with a space, and so does this one.
#[test]
#[ignore = "needs node and the TS build"]
fn an_unquoted_description_is_joined_back_together() {
    let Some((ts, _)) = new_case(
        "task-new-unquoted-description",
        &["task", "new", "Add", "user", "authentication"],
    )
    .run() else {
        return;
    };
    assert!(
        ts.stdout.contains("add-user-authentication.feature.md"),
        "{}",
        ts.describe()
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn an_unknown_type_is_refused_before_anything_is_written() {
    let Some((ts, _)) = new_case(
        "task-new-invalid-type",
        &["task", "new", "--type", "chore", "Something"],
    )
    .run() else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(ts.stderr.contains("Invalid --type \"chore\""));
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_missing_description_is_refused() {
    let Some((ts, _)) = new_case("task-new-no-description", &["task", "new"]).run() else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(ts.stderr.contains("Description is required."));
}

/// `--activate` writes durable state beside the scaffolded file: the record,
/// the canonical pointer, and the advisory transition trace.
#[test]
#[ignore = "needs node and the TS build"]
fn activation_writes_the_record_the_pointer_and_the_trace() {
    let Some((ts, _)) = new_case(
        "task-new-activate",
        &["task", "new", "--activate", "Add user authentication"],
    )
    .writes(&[
        "tasks/active/add-user-authentication.json",
        ".meowkit/state/active-plan.json",
        ".meowkit/telemetry/trace-log.jsonl",
    ])
    .env("MEOWKIT_RUN_ID", "fixed-run")
    .run() else {
        return;
    };
    assert!(
        ts.stdout
            .contains("✓ Activated task add-user-authentication (no-plan)"),
        "{}",
        ts.describe()
    );
}

/// A failed pointer commit is reported as a failed ACTIVATION and rolls the
/// new record back, so no caller is told a task is active when nothing names
/// it. The fixture blocks the commit by putting a FILE where the state
/// directory belongs.
#[test]
#[ignore = "needs node and the TS build"]
fn a_failed_pointer_commit_rolls_the_record_back() {
    let Some((ts, _)) = parity::case("task-new-activation-fails")
        .fixture("task-blocked-state")
        .env("TZ", UTC)
        .args(&["task", "new", "--activate", "Add user authentication"])
        .redact(
            r"cause: .*",
            "cause: <message>",
            "a filesystem error's wording belongs to the runtime that raised it; \
             the refusal, the rollback and the exit code are what parity is about",
        )
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stderr
            .contains("✗ Activation FAILED for task add-user-authentication — NOT active."),
        "{}",
        ts.describe()
    );
    assert!(
        ts.stderr.contains("The partial record was rolled back."),
        "the fixture stopped exercising the rollback: {}",
        ts.describe()
    );
}

/// `--no-activate` is the documented opt-out, and the default is already off:
/// the case proves it writes no durable state in either CLI.
#[test]
#[ignore = "needs node and the TS build"]
fn the_activation_opt_out_writes_no_durable_state() {
    let Some((ts, _)) = new_case(
        "task-new-no-activate",
        &["task", "new", "--no-activate", "Add user authentication"],
    )
    .run() else {
        return;
    };
    assert!(!ts.stdout.contains("Activated"), "{}", ts.describe());
}

#[test]
#[ignore = "needs node and the TS build"]
fn no_task_tree_is_an_answer_rather_than_a_failure() {
    let Some((ts, _)) = parity::case("task-list-no-tree")
        .fixture("task-empty-project")
        .args(&["task", "list"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(ts.stdout.contains("No tasks/ directory found."));
}

#[test]
#[ignore = "needs node and the TS build"]
fn an_empty_task_tree_names_the_directory_it_scanned() {
    let Some((ts, _)) = parity::case("task-list-empty-tree")
        .fixture("task-empty-tree")
        .args(&["task", "list"])
        .run()
    else {
        return;
    };
    assert!(
        ts.stdout.contains("No task files found in"),
        "{}",
        ts.describe()
    );
}

/// The table itself: every column padded to the same width, and a file with no
/// frontmatter defaulted the same way.
#[test]
#[ignore = "needs node and the TS build"]
fn the_listing_table_matches_column_for_column() {
    let Some((ts, _)) = parity::case("task-list")
        .fixture("task-files")
        .args(&["task", "list"])
        .run()
    else {
        return;
    };
    assert!(ts.stdout.contains("3 tasks found"), "{}", ts.describe());
    assert!(ts.stdout.contains("in-progress"), "{}", ts.describe());
    // The frontmatter-less file defaults to unknown/medium and its basename.
    assert!(ts.stdout.contains("unknown"), "{}", ts.describe());
}

#[test]
#[ignore = "needs node and the TS build"]
fn the_status_filter_selects_one_row() {
    let Some((ts, _)) = parity::case("task-list-status")
        .fixture("task-files")
        .args(&["task", "list", "--status", "in-progress"])
        .run()
    else {
        return;
    };
    assert!(ts.stdout.contains("1 task found"), "{}", ts.describe());
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_filter_that_matches_nothing_says_which_status_it_looked_for() {
    let Some((ts, _)) = parity::case("task-list-status-no-match")
        .fixture("task-files")
        .args(&["task", "list", "--status", "review"])
        .run()
    else {
        return;
    };
    assert!(
        ts.stdout.contains("No tasks with status \"review\""),
        "{}",
        ts.describe()
    );
}

/// `--all` scans the whole tree, so a completed task outside `active/` appears.
#[test]
#[ignore = "needs node and the TS build"]
fn the_all_flag_reaches_outside_the_active_directory() {
    let Some((ts, _)) = parity::case("task-list-all")
        .fixture("task-files")
        .args(&["task", "list", "--all"])
        .run()
    else {
        return;
    };
    assert!(ts.stdout.contains("4 tasks found"), "{}", ts.describe());
    assert!(ts.stdout.contains("done"), "{}", ts.describe());
}

#[test]
#[ignore = "needs node and the TS build"]
fn the_all_flag_and_the_status_filter_compose() {
    let Some((ts, _)) = parity::case("task-list-all-status")
        .fixture("task-files")
        .args(&["task", "list", "--all", "--status", "done"])
        .run()
    else {
        return;
    };
    assert!(ts.stdout.contains("1 task found"), "{}", ts.describe());
}
