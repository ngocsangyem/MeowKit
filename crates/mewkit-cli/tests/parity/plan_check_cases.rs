//! `plan check` against both CLIs, with and without `--structural`.
//!
//! `--structural` is the check the planning flow runs BEFORE presenting Gate 1,
//! and callers match on the `PLAN_COMPLETE` / `PLAN_INCOMPLETE` marker rather
//! than on the exit code alone — so the marker line is part of the contract.
use crate::parity;

/// A read failure's wording belongs to the engine that produced it (libuv on
/// one side, `std::io` on the other). The FACT that the phase file could not be
/// read, and the exit code that follows, is what parity is about.
const READ_WORDING: &str = "a read failure's wording is the engine's own; the \
                            command prefix and the exit code are compared";

#[test]
#[ignore = "needs node and the TS build"]
fn a_complete_phase_file_passes() {
    let Some((ts, _)) = parity::case("plan-check-phase")
        .fixture("plan-complete")
        .args(&[
            "plan",
            "check",
            "tasks/plans/261112-demo-plan/phase-01-setup.md",
        ])
        .run()
    else {
        return;
    };
    // The dependency line only prints when there are dependencies, so a fixture
    // that lost them would silently stop comparing it.
    assert!(
        ts.stdout.contains("deps:   bootstrap, toolchain"),
        "the fixture stopped exercising the dependency line: {}",
        ts.describe()
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_complete_phase_file_as_json() {
    parity::case("plan-check-phase-json")
        .fixture("plan-complete")
        .args(&[
            "plan",
            "check",
            "--json",
            "tasks/plans/261112-demo-plan/phase-01-setup.md",
        ])
        .run();
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_phase_file_missing_a_required_section_exits_one() {
    let Some((ts, _)) = parity::case("plan-check-phase-incomplete")
        .fixture("plan-ragged")
        .args(&[
            "plan",
            "check",
            "tasks/plans/261112-ragged-plan/phase-02-ragged.md",
        ])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stdout.contains("Missing: Implementation Steps"),
        "the fixture stopped missing a section: {}",
        ts.describe()
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_missing_phase_file_argument_exits_one() {
    let Some((ts, _)) = parity::case("plan-check-no-target")
        .fixture("plan-complete")
        .args(&["plan", "check"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
}

#[test]
#[ignore = "needs node and the TS build"]
fn an_unreadable_phase_file_exits_one() {
    let Some((ts, _)) = parity::case("plan-check-unreadable")
        .fixture("plan-complete")
        .args(&["plan", "check", "tasks/plans/261112-demo-plan/absent.md"])
        .redact(
            r"plan check: .*",
            "plan check: <read failure>",
            READ_WORDING,
        )
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_structurally_complete_plan_prints_the_complete_marker() {
    let Some((ts, _)) = parity::case("plan-check-structural")
        .fixture("plan-complete")
        .args(&[
            "plan",
            "check",
            "--structural",
            "tasks/plans/261112-demo-plan",
        ])
        .run()
    else {
        return;
    };
    assert!(
        ts.stdout
            .starts_with("PLAN_COMPLETE (1 phase file validated)"),
        "the marker line is the contract: {}",
        ts.describe()
    );
}

/// A plan DIRECTORY and its `plan.md` are the same subject, so both spellings
/// must reach the same verdict.
#[test]
#[ignore = "needs node and the TS build"]
fn the_structural_check_accepts_the_plan_md_itself() {
    parity::case("plan-check-structural-file")
        .fixture("plan-complete")
        .args(&[
            "plan",
            "check",
            "--structural",
            "tasks/plans/261112-demo-plan/plan.md",
        ])
        .run();
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_structurally_incomplete_plan_lists_every_issue() {
    let Some((ts, _)) = parity::case("plan-check-structural-ragged")
        .fixture("plan-ragged")
        .args(&[
            "plan",
            "check",
            "--structural",
            "tasks/plans/261112-ragged-plan",
        ])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    // One of each severity, so a renderer cannot pass by printing only errors.
    assert!(
        ts.stdout.contains("PLAN_INCOMPLETE")
            && ts.stdout.contains("  - WARN ")
            && ts.stdout.contains("  - ERROR "),
        "the fixture stopped producing both severities: {}",
        ts.describe()
    );
}

/// The frontmatter-present branch: per-field reporting, the `handoff.next` enum
/// and a missing goal section, none of which the no-frontmatter plan reaches.
#[test]
#[ignore = "needs node and the TS build"]
fn the_structural_check_validates_frontmatter_fields_and_handoff() {
    let Some((ts, _)) = parity::case("plan-check-structural-handoff")
        .fixture("plan-ragged")
        .args(&[
            "plan",
            "check",
            "--structural",
            "tasks/plans/261112-handoff-plan",
        ])
        .run()
    else {
        return;
    };
    assert!(
        ts.stdout.contains("handoff.next 'deploy' not in"),
        "the fixture stopped exercising the handoff enum: {}",
        ts.describe()
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_structural_report_as_json() {
    parity::case("plan-check-structural-json")
        .fixture("plan-ragged")
        .args(&[
            "plan",
            "check",
            "--structural",
            "--json",
            "tasks/plans/261112-ragged-plan",
        ])
        .run();
}

#[test]
#[ignore = "needs node and the TS build"]
fn an_absent_plan_is_reported_as_an_incomplete_structure() {
    let Some((ts, _)) = parity::case("plan-check-structural-absent")
        .fixture("plan-complete")
        .args(&[
            "plan",
            "check",
            "--structural",
            "tasks/plans/261112-not-here",
        ])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(ts.stdout.contains("File not found:"), "{}", ts.describe());
}

/// A plan authored on Windows reaches a verdict rather than a crash. Its
/// frontmatter IS parsed here (the fence regex allows `\r\n`), unlike the
/// receipt's line reader — which is why `plan approve` refuses the same file.
#[test]
#[ignore = "needs node and the TS build"]
fn a_crlf_plan_still_reaches_a_structural_verdict() {
    let Some((ts, _)) = parity::case("plan-check-structural-crlf")
        .fixture("plan-approvable")
        .args(&[
            "plan",
            "check",
            "--structural",
            "tasks/plans/261112-crlf-plan",
        ])
        .run()
    else {
        return;
    };
    assert!(
        ts.stdout.starts_with("PLAN_COMPLETE"),
        "a CRLF plan must not fail on its line endings: {}",
        ts.describe()
    );
}
