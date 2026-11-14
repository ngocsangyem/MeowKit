//! `trace` against both CLIs: every subcommand in text and JSON, the friction
//! write, and the no-project refusal.
//!
//! The `trace-log` fixture is deliberately untidy — a blank line, a malformed
//! line, a bare string, an array record, a null and a numeric event, numeric-
//! looking run ids, stale and future timestamps, friction that normalises
//! together — because the npm CLI reads the log loosely and those are the
//! places a port drifts. Timestamps are 2020 (stale) or 2999 (never stale) so
//! the audit does not depend on the day the suite runs.
use crate::npm;

fn trace(name: &'static str, fixture: &'static str, args: &[&str]) -> (npm::Run, npm::Run) {
    let mut argv = vec!["trace"];
    argv.extend_from_slice(args);
    npm::case(name).fixture(fixture).args(&argv).run()
}

#[test]
fn score_by_lane_in_text_and_json() {
    let (ts, _) = trace("trace-score-lanes", "trace-log", &["score"]);
    assert!(ts.stdout.contains("r2  tier=detailed"), "{}", ts.describe());
    let (ts, _) = trace("trace-score-lanes-json", "trace-log", &["score", "--json"]);
    // Numeric-looking lanes enumerate first in a JS object.
    assert!(
        ts.stdout.find("\"2\"") < ts.stdout.find("\"r1\""),
        "{}",
        ts.describe()
    );
}

#[test]
fn score_one_run_in_text_and_json() {
    trace("trace-score-run", "trace-log", &["score", "--id", "r2"]);
    trace(
        "trace-score-run-json",
        "trace-log",
        &["score", "--id=r1", "--json"],
    );
    trace(
        "trace-score-run-unknown",
        "trace-log",
        &["score", "--id", "nobody"],
    );
}

#[test]
fn score_with_no_log_yet() {
    let (ts, _) = trace("trace-score-empty", "trace-empty", &["score"]);
    assert!(
        ts.stdout.contains("no trace records yet."),
        "{}",
        ts.describe()
    );
    trace(
        "trace-score-empty-json",
        "trace-empty",
        &["score", "--json"],
    );
}

#[test]
fn audit_in_text_and_json() {
    let (ts, _) = trace("trace-audit", "trace-log", &["audit"]);
    assert!(ts.stdout.contains("Repeated friction"), "{}", ts.describe());
    trace("trace-audit-json", "trace-log", &["audit", "--json"]);
    trace("trace-audit-empty", "trace-empty", &["audit"]);
}

#[test]
fn propose_dry_run_and_json() {
    let (ts, _) = trace("trace-propose-dry", "trace-log", &["propose"]);
    assert!(ts.stdout.contains("(dry-run)"), "{}", ts.describe());
    // `--json` wins over `--commit`: nothing is written.
    trace(
        "trace-propose-json",
        "trace-log",
        &["propose", "--json", "--commit"],
    );
    trace("trace-propose-nothing", "trace-propose-quiet", &["propose"]);
    trace(
        "trace-propose-nothing-commit",
        "trace-propose-quiet",
        &["propose", "--commit"],
    );
}

#[test]
fn propose_commit_appends_to_the_backlog() {
    let (ts, _) = npm::case("trace-propose-commit")
        .fixture("trace-log")
        .args(&["trace", "propose", "--commit"])
        .writes(&["tasks/backlog/improvement-backlog.md"])
        .run();
    assert!(ts.stdout.contains("Appended"), "{}", ts.describe());
}

#[test]
fn friction_is_recorded_redacted_and_attributed() {
    let (ts, _) = npm::case("trace-friction")
        .fixture("trace-empty")
        .args(&[
            "trace",
            "--friction",
            "hook slow, token=abc123 and ghp_ABCDEFGH12345678",
            "--responsibility",
            "ci",
            "--id",
            "run-7",
        ])
        .writes(&[".meowkit/telemetry/trace-log.jsonl"])
        .run();
    assert!(
        ts.stdout.contains("Recorded friction. [ci] "),
        "{}",
        ts.describe()
    );
    assert!(!ts.stdout.contains("abc123"), "{}", ts.describe());
    npm::case("trace-friction-plain")
        .fixture("trace-log")
        .args(&["trace", "--friction", "plain note", "score"])
        .writes(&[".meowkit/telemetry/trace-log.jsonl"])
        .run();
}

#[test]
fn an_empty_friction_reads_instead_and_usage_is_the_default() {
    trace(
        "trace-friction-empty",
        "trace-log",
        &["score", "--friction"],
    );
    let (ts, _) = trace("trace-usage", "trace-log", &[]);
    assert!(
        ts.stdout.contains("trace score [--id <run>]"),
        "{}",
        ts.describe()
    );
    let (ts, _) = trace("trace-unknown-subcommand", "trace-log", &["nonsense"]);
    assert_eq!(ts.code, 2, "{}", ts.describe());
    // Refused before the friction write: nothing reaches the log.
    npm::case("trace-unknown-subcommand-with-friction")
        .fixture("trace-empty")
        .args(&["trace", "nonsense", "--friction", "x"])
        .run();
}

/// clap renders this binary's help; the npm CLI renders its catalogue.
const OWN_HELP: &str = "help text is rendered by each CLI's own parser";

#[test]
fn help_exits_zero_without_running() {
    npm::case("trace-help")
        .fixture("trace-empty")
        .args(&["trace", "--help"])
        .ignore_stdout(OWN_HELP)
        .run();
}

#[test]
fn no_claude_directory_is_reported_and_exits_zero() {
    let (ts, _) = trace("trace-no-claude", "empty-project", &["audit"]);
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(ts.stderr.contains("Could not find .claude/ directory."));
}
