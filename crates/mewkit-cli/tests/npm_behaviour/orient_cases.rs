//! `orient` against both CLIs: every flag, every outcome, every exit code.
//!
//! The SessionStart hook runs this verb on every resume and injects its stdout
//! into the session, so "the same bytes" is the actual contract here, not a
//! stand-in for it. These cases pass `--no-record`, as the hook does: bare
//! `orient` records here and not in the npm CLI (see `orient_flag_cases.rs`).
use crate::npm;

/// Message wording from a JSON parser or a schema validator belongs to the
/// engine that produced it (V8 and zod on one side, serde on the other). The
/// FACT that the record is unreadable is what the comparison is about, and the human
/// renderer prints only the task id — the full message appears in `--json`.
const PARSER_WORDING: &str = "a parse failure's wording is the engine's own; \
                              the human output compares the id, which both agree on";

#[test]
fn no_durable_state_orients_to_none() {
    npm::case("orient-none")
        .fixture("empty-project")
        .args(&["orient", "--no-record"])
        .run();
}

#[test]
fn no_durable_state_as_json() {
    npm::case("orient-none-json")
        .fixture("empty-project")
        .args(&["orient", "--json", "--no-record"])
        .run();
}

#[test]
fn the_sole_record_is_the_active_task() {
    npm::case("orient-active")
        .fixture("active-task")
        .args(&["orient", "--no-record"])
        .run();
}

#[test]
fn the_sole_record_as_json() {
    npm::case("orient-active-json")
        .fixture("active-task")
        .args(&["orient", "--json", "--no-record"])
        .run();
}

/// Several resumable tasks must not be resolved to one, in either CLI — and the
/// hint that names the way out is part of the output.
#[test]
fn several_resumable_tasks_are_ambiguous() {
    npm::case("orient-ambiguous")
        .fixture("ambiguous-tasks")
        .args(&["orient", "--no-record"])
        .run();
}

#[test]
fn several_resumable_tasks_as_json() {
    npm::case("orient-ambiguous-json")
        .fixture("ambiguous-tasks")
        .args(&["orient", "--json", "--no-record"])
        .run();
}

/// The pointer decides between candidates, and a blocked task still resolves.
#[test]
fn the_pointer_resolves_the_ambiguity() {
    let (ts, _) = npm::case("orient-pointed")
        .fixture("pointed-task")
        .args(&["orient", "--no-record"])
        .run();
    // Two candidates plus a pointer naming the blocked one: agreement on
    // "ambiguous" would pass the comparison without exercising the pointer.
    assert!(
        ts.stdout.contains("task: zeta") && ts.stdout.contains("status: blocked"),
        "the fixture stopped exercising the pointer: {}",
        ts.describe()
    );
}

#[test]
fn the_pointer_resolves_the_ambiguity_as_json() {
    npm::case("orient-pointed-json")
        .fixture("pointed-task")
        .args(&["orient", "--json", "--no-record"])
        .run();
}

/// A repo whose recorded revision no longer matches is reported; a repo that is
/// not there any more is silent, because "unknown" is not "moved".
#[test]
fn a_moved_repo_revision_is_stale_in_both_clis() {
    let (ts, _) = npm::case("orient-stale-repo")
        .fixture("stale-repo")
        .args(&["orient", "--no-record"])
        .run();
    // Agreement on an EMPTY warning list would pass the comparison while
    // proving nothing, so the fixture is held to actually going stale.
    assert!(
        ts.stdout.contains("stale: repo ") && ts.stdout.contains("moved from aaaaaaa"),
        "the fixture stopped exercising staleness: {}",
        ts.describe()
    );
}

#[test]
fn a_moved_repo_revision_as_json() {
    let (ts, _) = npm::case("orient-stale-repo-json")
        .fixture("stale-repo")
        .args(&["orient", "--json", "--no-record"])
        .run();
    // Exactly one warning: the repo that moved. The repo recorded at a path
    // that no longer exists stays silent, because "unknown" is not "moved".
    assert_eq!(
        ts.stdout.matches("moved from").count(),
        1,
        "the fixture stopped exercising staleness: {}",
        ts.describe()
    );
}

/// One unreadable record never hides the readable ones, and the human block
/// names only the id — so this comparison needs no allowance at all.
#[test]
fn an_unreadable_record_is_surfaced_not_fatal() {
    let (ts, _) = npm::case("orient-corrupt-record")
        .fixture("corrupt-record")
        .args(&["orient", "--no-record"])
        .run();
    assert!(
        ts.stdout.contains("task: alpha") && ts.stdout.contains("unreadable: broken"),
        "the readable record must still resolve beside the broken one: {}",
        ts.describe()
    );
}

#[test]
fn an_unreadable_record_as_json() {
    npm::case("orient-corrupt-record-json")
        .fixture("corrupt-record")
        .args(&["orient", "--json", "--no-record"])
        .redact(
            r#""problem": "[^"]*""#,
            r#""problem": "<message>""#,
            PARSER_WORDING,
        )
        .run();
}
