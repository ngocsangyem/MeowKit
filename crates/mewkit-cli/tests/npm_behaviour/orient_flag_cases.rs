//! `orient`'s flags and exit codes, compared against what the npm CLI did.
//!
//! Separated from the outcome cases because these are about the COMMAND LINE —
//! which flag wins, what a failure exits with, what `--help` does — rather than
//! about what durable state means.
use crate::npm;

/// `--no-record` leaves the project untouched in both CLIs. The bare form is
/// not an npm-comparison case: the npm CLI records nothing there (its parser pre-sets
/// the boolean) while this CLI records, as the help says; `tests/cli.rs` pins
/// the Rust side.
#[test]
fn no_record_writes_nothing() {
    npm::case("orient-no-record")
        .fixture("active-task")
        .args(&["orient", "--no-record"])
        .run();
}

#[test]
fn record_writes_one_trace_line() {
    let (ts, _) = npm::case("orient-record")
        .fixture("active-task")
        .args(&["orient", "--record"])
        .writes(&[".meowkit/telemetry/trace-log.jsonl"])
        .run();
    assert_eq!(ts.code, 0, "{}", ts.describe());
}

#[test]
fn record_with_the_measurement_fields_pinned_through_the_environment() {
    npm::case("orient-record-env")
        .fixture("active-task")
        .args(&["orient", "--record", "--json"])
        .env("MEOWKIT_RUN_ID", "run-parity")
        .env("MEOWKIT_MODEL_HINT", "opus")
        .env("MEOWKIT_AUTOBUILD_MODE", "FULL")
        .env("MEOWKIT_HARNESS_VERSION", "3.0.0")
        .writes(&[".meowkit/telemetry/trace-log.jsonl"])
        .run();
}

/// The last flag wins in both CLIs (minimist is last-wins; clap's
/// `overrides_with` is too), so neither order may record where the other does.
#[test]
fn the_last_record_flag_wins_in_both_orders() {
    for (index, args) in [
        ["orient", "--record", "--no-record"],
        ["orient", "--no-record", "--record"],
    ]
    .into_iter()
    .enumerate()
    {
        npm::case(format!("orient-record-precedence-{index}"))
            .fixture("active-task")
            .args(&args)
            .run();
    }
}

/// Unknown flags, a typed boolean and a stray word are dropped the way minimist
/// drops them, so the command still runs and prints the same thing. `--target`
/// is a global string flag in the npm table, so it swallows `x` in both.
#[test]
fn unknown_flags_and_stray_words_are_ignored_like_minimist() {
    for (index, args) in [
        &["orient", "--no-recrd", "--no-record"][..],
        &["orient", "--bogus", "--json", "--no-record"],
        &["orient", "--json=yes", "--no-record"],
        &["orient", "--json=false", "--no-record"],
        &["orient", "stray", "--no-record"],
        &["orient", "--target", "x", "--json", "--no-record"],
        &["orient", "-y", "--no-record", "--json"],
    ]
    .into_iter()
    .enumerate()
    {
        npm::case(format!("orient-tolerated-argv-{index}"))
            .fixture("active-task")
            .args(args)
            .run();
    }
}

/// The one failure path: a pointer file that cannot be read at all. Exit 1 in
/// both CLIs — the fact a script checks — while the message naming the errno is
/// each runtime's own.
#[test]
fn an_unreadable_pointer_exits_one_in_both_clis() {
    let (ts, rust) = npm::case("orient-unreadable-pointer")
        .fixture("unreadable-pointer")
        .args(&["orient"])
        .ignore_stderr(
            "the errno phrasing is the runtime's: node says `EISDIR: illegal operation on \
             a directory`, Rust says `Is a directory (os error 21)`",
        )
        .run();
    assert_eq!((ts.code, rust.code), (1, 1), "{}", rust.describe());
    for run in [&ts, &rust] {
        assert!(
            run.stdout.is_empty(),
            "a failed orientation must print no orientation: {}",
            run.describe()
        );
    }
}

/// Asking for help must never run the thing being asked about: exit 0, nothing
/// written, no orientation printed.
#[test]
fn help_describes_the_verb_without_orienting() {
    let (ts, rust) = npm::case("orient-help")
        .fixture("active-task")
        .args(&["orient", "--help"])
        .ignore_stdout(
            "each CLI renders its own help: the npm one from its flag catalogue, \
             this one from clap",
        )
        .run();
    for run in [&ts, &rust] {
        assert_eq!(run.code, 0, "{}", run.describe());
        assert!(
            run.stdout.contains("--json") && run.stdout.contains("record"),
            "the help must name the flags: {}",
            run.describe()
        );
        assert!(
            !run.stdout.contains("orientation:"),
            "help must not orient: {}",
            run.describe()
        );
    }
}
