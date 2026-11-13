//! `task-state show|update` against both CLIs.
//!
//! `show` is read by a human and by the cook, fix and review skills; `update`
//! is the only writer of the durable record, so the written JSON is compared
//! byte for byte as well as the output.
use crate::parity;

/// Message wording from a JSON parser belongs to the engine that produced it
/// (V8 and zod on one side, serde on the other). The FACT that the record is
/// unreadable is what parity is about.
const PARSER_WORDING: &str = "a parse failure's wording is the engine's own; \
                              the id and the fact of the failure are compared";

/// Clap renders its own unknown-subcommand error; the npm CLI renders the
/// catalogue's. Both exit 2.
const SUBCOMMAND_WORDING: &str = "a usage error for the sub-verb slot is each parser's own text; \
     the exit code is what callers check";

/// The run id is pinned so the trace line a write emits is comparable.
fn update_case(name: &'static str, fixture: &'static str, args: &[&str]) -> parity::Case {
    parity::case(name)
        .fixture(fixture)
        .args(args)
        .env("MEOWKIT_RUN_ID", "fixed-run")
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_bare_task_state_shows_rather_than_failing() {
    let Some((ts, _)) = parity::case("task-state-bare")
        .fixture("task-state-records")
        .args(&["task-state"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(
        ts.stdout.starts_with("Durable task state"),
        "{}",
        ts.describe()
    );
}

/// `--json` on the BARE form, not only after a sub-verb: the npm CLI parses
/// flags independently of the positional, and a flag that only worked after
/// `show` would break a caller that wrote it the other way round.
#[test]
#[ignore = "needs node and the TS build"]
fn a_bare_task_state_takes_the_json_flag() {
    let Some((ts, _)) = parity::case("task-state-bare-json")
        .fixture("task-state-records")
        .args(&["task-state", "--json"])
        .run()
    else {
        return;
    };
    assert!(
        ts.stdout.starts_with("{\n  \"records\""),
        "{}",
        ts.describe()
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn an_empty_store_says_so_in_both_clis() {
    parity::case("task-state-show-empty")
        .fixture("task-empty-project")
        .args(&["task-state", "show"])
        .run();
}

/// The human block: the pointer, the current marker, and every optional line a
/// record can carry.
#[test]
#[ignore = "needs node and the TS build"]
fn show_renders_every_recorded_field() {
    let Some((ts, _)) = parity::case("task-state-show")
        .fixture("task-state-records")
        .args(&["task-state", "show"])
        .run()
    else {
        return;
    };
    for expected in [
        "active plan: tasks/plans/261112-alpha-work/plan.md",
        "alpha [blocked] tasks/plans/261112-alpha-work/plan.md ◀ current",
        "step: phase 3 build  next: port task-state",
        "repos: /srv/alpha@aaaaaaa, /srv/beta@(no-rev)",
        "blockers: the npm CLI still owns plan approve",
        "evidence: tasks/reports/261112-port.md",
        "decisions: cap.memory.write=selected",
        "zeta [active]",
        "step: (none)  next: (none)",
    ] {
        assert!(
            ts.stdout.contains(expected),
            "the fixture stopped exercising {expected:?}: {}",
            ts.describe()
        );
    }
}

/// A task-id positional is accepted and ignored by `show` in both CLIs —
/// the POINTER decides which record is current, never an argument.
#[test]
#[ignore = "needs node and the TS build"]
fn show_ignores_a_task_id_positional() {
    let Some((ts, _)) = parity::case("task-state-show-task-id")
        .fixture("task-state-records")
        .args(&["task-state", "show", "zeta"])
        .run()
    else {
        return;
    };
    assert!(ts.stdout.contains("alpha [blocked]"), "{}", ts.describe());
    assert!(ts.stdout.contains("◀ current"), "{}", ts.describe());
}

#[test]
#[ignore = "needs node and the TS build"]
fn show_as_json_is_the_whole_resume_document() {
    let Some((ts, _)) = parity::case("task-state-show-json")
        .fixture("task-state-records")
        .args(&["task-state", "show", "--json"])
        .run()
    else {
        return;
    };
    // The additive field an older binary must not strip survives the read.
    assert!(ts.stdout.contains("futureField"), "{}", ts.describe());
    assert!(
        ts.stdout.contains("\"activePlanPointer\""),
        "{}",
        ts.describe()
    );
}

/// A pre-canonical pointer resolves the current record by EXACT slug match.
#[test]
#[ignore = "needs node and the TS build"]
fn a_legacy_pointer_still_marks_the_current_record() {
    let Some((ts, _)) = parity::case("task-state-legacy-pointer")
        .fixture("task-state-legacy-pointer")
        .args(&["task-state", "show"])
        .run()
    else {
        return;
    };
    assert!(
        ts.stdout.contains("◀ current"),
        "the fixture stopped exercising the legacy pointer: {}",
        ts.describe()
    );
}

/// One unreadable record never hides the readable one, and the human block
/// names only the id — so the wording allowance is needed for `--json` only.
#[test]
#[ignore = "needs node and the TS build"]
fn an_unreadable_record_is_surfaced_beside_the_readable_ones() {
    let Some((ts, _)) = parity::case("task-state-show-corrupt")
        .fixture("task-state-corrupt")
        .args(&["task-state", "show"])
        .redact(
            r"\[ISSUE\] broken: .*",
            "[ISSUE] broken: <message>",
            PARSER_WORDING,
        )
        .run()
    else {
        return;
    };
    assert!(ts.stdout.contains("alpha [active]"), "{}", ts.describe());
    assert!(ts.stdout.contains("[ISSUE] broken:"), "{}", ts.describe());
}

#[test]
#[ignore = "needs node and the TS build"]
fn an_unreadable_record_as_json() {
    parity::case("task-state-show-corrupt-json")
        .fixture("task-state-corrupt")
        .args(&["task-state", "show", "--json"])
        .redact(
            r#""problem": "[^"]*""#,
            r#""problem": "<message>""#,
            PARSER_WORDING,
        )
        .run();
}

#[test]
#[ignore = "needs node and the TS build"]
fn an_unknown_task_state_subcommand_is_a_usage_error() {
    let Some((ts, _)) = parity::case("task-state-unknown-subcommand")
        .fixture("task-state-records")
        .args(&["task-state", "frobnicate"])
        .ignore_stderr(SUBCOMMAND_WORDING)
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 2, "{}", ts.describe());
}

#[test]
#[ignore = "needs node and the TS build"]
fn an_update_without_a_task_id_is_refused() {
    let Some((ts, _)) = update_case(
        "task-state-update-no-id",
        "task-state-records",
        &["task-state", "update"],
    )
    .run() else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(ts.stderr.contains("requires a task id."));
}

#[test]
#[ignore = "needs node and the TS build"]
fn an_unknown_status_is_refused_before_anything_is_written() {
    let Some((ts, _)) = update_case(
        "task-state-update-bad-status",
        "task-state-records",
        &["task-state", "update", "alpha", "--status", "paused"],
    )
    .run() else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(ts.stderr.contains("Expected active|blocked|done."));
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_decision_token_with_an_unknown_word_is_refused() {
    let Some((ts, _)) = update_case(
        "task-state-update-bad-decision",
        "task-state-records",
        &[
            "task-state",
            "update",
            "alpha",
            "--capability-decision",
            "cap.one|skiped|typo",
        ],
    )
    .run() else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(ts.stderr.contains("invalid capability decision \"skiped\""));
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_decision_token_missing_its_decision_is_refused() {
    let Some((ts, _)) = update_case(
        "task-state-update-short-decision",
        "task-state-records",
        &[
            "task-state",
            "update",
            "alpha",
            "--capability-decision",
            "cap.one",
        ],
    )
    .run() else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(ts.stderr.contains("needs \"capId|decision|reason\""));
}

/// An update on a task nothing has recorded CREATES the record, and writes the
/// transition trace beside it.
#[test]
#[ignore = "needs node and the TS build"]
fn an_update_creates_a_missing_record() {
    let Some((ts, _)) = update_case(
        "task-state-update-creates",
        "task-empty-project",
        &[
            "task-state",
            "update",
            "fresh",
            "--status",
            "active",
            "--step",
            "ported note",
            "--next",
            "port task",
            "--plan",
            "tasks/plans/261112-demo/plan.md",
        ],
    )
    .writes(&[
        "tasks/active/fresh.json",
        ".meowkit/telemetry/trace-log.jsonl",
    ])
    .run() else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(
        ts.stdout
            .contains("Updated task record: tasks/active/fresh.json"),
        "{}",
        ts.describe()
    );
}

/// Every repeatable flag at once, each given TWICE: the lists merge, the
/// duplicates collapse, and the untouched fields survive.
#[test]
#[ignore = "needs node and the TS build"]
fn the_repeatable_flags_merge_into_the_existing_record() {
    let Some((ts, _)) = update_case(
        "task-state-update-merges",
        "task-state-records",
        &[
            "task-state",
            "update",
            "alpha",
            "--status",
            "blocked",
            "--blocker",
            "the npm CLI still owns plan approve",
            "--blocker",
            "the parity job needs a node leg",
            "--verification",
            "cargo-test=pass",
            "--verification",
            "cargo-clippy:clean",
            "--evidence-ref",
            "tasks/reports/261112-port.md",
            "--evidence-ref",
            "tasks/reports/261112-second.md",
            "--capability-decision",
            "cap.trace.append|skipped|advisory only",
        ],
    )
    .writes(&["tasks/active/alpha.json"])
    .run() else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
}

/// `--json` is declared for `task-state`; `update` accepts and ignores it.
#[test]
#[ignore = "needs node and the TS build"]
fn an_update_accepts_the_json_flag_without_changing_its_output() {
    let Some((ts, _)) = update_case(
        "task-state-update-json",
        "task-state-records",
        &[
            "task-state",
            "update",
            "zeta",
            "--step",
            "phase 4",
            "--json",
        ],
    )
    .run() else {
        return;
    };
    assert!(
        ts.stdout.starts_with("Updated task record:"),
        "{}",
        ts.describe()
    );
}

/// Completing a task clears ITS pointer. The fixture's pointer names `alpha`,
/// so finishing `zeta` must leave it alone.
#[test]
#[ignore = "needs node and the TS build"]
fn completing_a_task_clears_only_its_own_pointer() {
    let Some((ts, _)) = update_case(
        "task-state-update-done-other-task",
        "task-state-records",
        &["task-state", "update", "zeta", "--status", "done"],
    )
    .writes(&[".meowkit/state/active-plan.json"])
    .run() else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
}

#[test]
#[ignore = "needs node and the TS build"]
fn completing_the_pointed_task_removes_the_pointer() {
    let Some((ts, _)) = update_case(
        "task-state-update-done",
        "task-state-records",
        &["task-state", "update", "alpha", "--status", "done"],
    )
    .run() else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    // Agreement on "the pointer is still there" would pass the tree
    // comparison while proving nothing.
    assert!(!ts.stdout.contains("active-plan"), "{}", ts.describe());
}

/// A record this binary cannot read is refused LOUDLY and left byte-identical.
#[test]
#[ignore = "needs node and the TS build"]
fn an_incompatible_record_is_never_overwritten() {
    let Some((ts, _)) = update_case(
        "task-state-update-incompatible",
        "task-state-incompatible",
        &["task-state", "update", "future", "--status", "done"],
    )
    .run() else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stderr
            .contains("Refusing to update: Incompatible task record:"),
        "{}",
        ts.describe()
    );
}
