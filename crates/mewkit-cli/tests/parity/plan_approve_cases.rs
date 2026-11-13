//! `plan approve` against both CLIs: the stamped bytes, the activation writes
//! and every refusal.
//!
//! This is the verb with the hardest contract in the port. The `approval:`
//! block one CLI writes is read by the OTHER CLI's verifier (`approval-receipt.cjs`,
//! which every write guard runs), so the file content comparison below is the
//! Gate 1 interoperability test — and `plan_receipt_consumer.rs` then runs that
//! verifier against what the Rust binary wrote.
use crate::parity;

/// The npm CLI stamps by SPAWNING `node approval-receipt.cjs`, so its failure
/// line quotes a `Command failed: <interpreter> <script> …` wrapper around the
/// helper's own message. The Rust CLI stamps in-process and has no subprocess to
/// quote. The helper's message itself is compared on stderr, where both print
/// it unwrapped, and the exit code and the untouched file are compared too.
const SUBPROCESS_WRAPPER: &str = "the npm CLI wraps the refusal in its \
                                  child-process error; the reason itself is compared on stderr";

/// A filesystem refusal is reported in the words of the runtime that hit it
/// (libuv names the syscall, `std::io` names the errno). What must agree is the
/// SHAPE of the failure: the receipt stays stamped, the record is rolled back,
/// the command says the task is not active, and the exit code is 1.
const OS_ERROR_WORDING: &str = "the cause is the runtime's own filesystem error; \
                                the outcome lines, the rollback and the exit code are compared";

/// The approve path writes the receipt INTO plan.md, so that file is the write
/// to prove. Named here so a case cannot regress to proving nothing.
const PLAN_MD: &str = "tasks/plans/261112-demo-plan/plan.md";

#[test]
#[ignore = "needs node and the TS build"]
fn a_named_approver_is_recorded_in_the_receipt() {
    let Some((ts, _)) = parity::case("plan-approve-by")
        .fixture("plan-approvable")
        .args(&[
            "plan",
            "approve",
            "tasks/plans/261112-demo-plan",
            "--by",
            "tester",
        ])
        .writes(&[PLAN_MD])
        .run()
    else {
        return;
    };
    assert!(
        ts.stdout.contains("Stamped approval on") && ts.stdout.contains("approved_by: tester"),
        "the case stopped exercising the stamp: {}",
        ts.describe()
    );
}

/// Activation is OFF by default, because the npm CLI's flag table declares
/// `activate` a boolean and therefore pre-sets it to false — so an unflagged
/// run reports the opt-out. A Rust CLI that activated here would write task
/// state the npm CLI does not.
#[test]
#[ignore = "needs node and the TS build"]
fn activation_is_off_unless_asked_for() {
    let Some((ts, _)) = parity::case("plan-approve-default")
        .fixture("plan-approvable")
        .args(&["plan", "approve", "tasks/plans/261112-demo-plan"])
        .writes(&[PLAN_MD])
        .run()
    else {
        return;
    };
    assert!(
        ts.stdout
            .contains("Skipped durable activation (--no-activate)."),
        "the default must not activate: {}",
        ts.describe()
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn the_explicit_opt_out_is_accepted() {
    parity::case("plan-approve-no-activate")
        .fixture("plan-approvable")
        .args(&[
            "plan",
            "approve",
            "tasks/plans/261112-demo-plan",
            "--no-activate",
        ])
        .writes(&[PLAN_MD])
        .run();
}

/// `--activate` writes three things beside the receipt: the task record, the
/// canonical pointer with its legacy mirror, and an advisory transition trace.
#[test]
#[ignore = "needs node and the TS build"]
fn activation_writes_the_record_the_pointer_and_the_trace() {
    let Some((ts, _)) = parity::case("plan-approve-activate")
        .fixture("plan-approvable")
        .args(&[
            "plan",
            "approve",
            "tasks/plans/261112-demo-plan",
            "--by",
            "tester",
            "--activate",
        ])
        .writes(&[
            PLAN_MD,
            "tasks/active/261112-demo-plan.json",
            ".meowkit/state/active-plan.json",
            ".meowkit/telemetry/trace-log.jsonl",
        ])
        .run()
    else {
        return;
    };
    assert!(
        ts.stdout.contains("✓ Activated task 261112-demo-plan"),
        "{}",
        ts.describe()
    );
}

/// Re-activating keeps ONE record, preserves the fields this call does not own
/// (including a key a newer writer added), and reports `createdRecord: false`
/// on the trace.
#[test]
#[ignore = "needs node and the TS build"]
fn re_activating_an_existing_task_merges_rather_than_replaces() {
    let Some((ts, rust)) = parity::case("plan-approve-reactivate")
        .fixture("plan-reactivate")
        .args(&[
            "plan",
            "approve",
            "tasks/plans/261112-demo-plan",
            "--by",
            "tester",
            "--activate",
        ])
        .writes(&["tasks/active/261112-demo-plan.json"])
        .run()
    else {
        return;
    };
    assert!(ts.stdout.contains("✓ Activated task"), "{}", ts.describe());
    assert!(
        rust.stdout.contains("✓ Activated task"),
        "{}",
        rust.describe()
    );
}

/// Stamp and activation are SEPARATE facts, and this is the case that proves
/// it: the receipt is written, the activation then fails, and the command must
/// exit non-zero while saying plainly that the task is NOT active. A CLI that
/// reported success here would leave an approved plan with no resumable task.
#[test]
#[ignore = "needs node and the TS build"]
fn a_failed_activation_rolls_back_and_never_claims_success() {
    let Some((ts, _)) = parity::case("plan-approve-activation-blocked")
        .fixture("plan-activation-blocked")
        .args(&[
            "plan",
            "approve",
            "tasks/plans/261112-demo-plan",
            "--by",
            "tester",
            "--activate",
        ])
        .redact(
            r"  cause: .*",
            "  cause: <filesystem refusal>",
            OS_ERROR_WORDING,
        )
        .writes(&[PLAN_MD])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stdout
            .contains("✗ Activation FAILED for task 261112-demo-plan")
            && ts.stdout.contains("The partial record was rolled back."),
        "{}",
        ts.describe()
    );
    // The stamp survives the failed activation — it is a separate, durable fact.
    assert!(
        ts.stdout.contains("✓ Gate 1 approval receipt stamped."),
        "{}",
        ts.describe()
    );
}

/// Trailing whitespace is part of the hashed body, so both CLIs must produce the
/// SAME digest for a file carrying it — otherwise an invisible edit could carry
/// an approval over, or a receipt written by one CLI would read stale to the
/// other. The file comparison the harness runs IS that assertion.
#[test]
#[ignore = "needs node and the TS build"]
fn trailing_whitespace_hashes_the_same_in_both_clis() {
    let Some((ts, _)) = parity::case("plan-approve-padded")
        .fixture("plan-approvable")
        .args(&[
            "plan",
            "approve",
            "tasks/plans/261112-padded-plan",
            "--by",
            "tester",
        ])
        .writes(&["tasks/plans/261112-padded-plan/plan.md"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
}

/// A CRLF plan is REFUSED by both, because the receipt's line reader sees
/// `---\r` rather than the fence. Reporting success on a file nothing stamped
/// would be the dangerous outcome, so the refusal is the behaviour under test.
#[test]
#[ignore = "needs node and the TS build"]
fn a_crlf_plan_is_refused_by_both_clis() {
    let Some((ts, _)) = parity::case("plan-approve-crlf")
        .fixture("plan-approvable")
        .args(&[
            "plan",
            "approve",
            "tasks/plans/261112-crlf-plan",
            "--by",
            "tester",
        ])
        .redact(
            r"(?s)failed to stamp receipt — .*",
            "failed to stamp receipt — <refusal; compared on stderr>",
            SUBPROCESS_WRAPPER,
        )
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stderr.contains("has no YAML frontmatter to stamp"),
        "the reason must reach stderr unwrapped: {}",
        ts.describe()
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_missing_target_prints_the_usage_line() {
    let Some((ts, _)) = parity::case("plan-approve-no-target")
        .fixture("plan-approvable")
        .args(&["plan", "approve"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
}

#[test]
#[ignore = "needs node and the TS build"]
fn an_absent_plan_file_is_refused() {
    let Some((ts, _)) = parity::case("plan-approve-absent")
        .fixture("plan-approvable")
        .args(&["plan", "approve", "tasks/plans/261112-not-here"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
}

/// A project whose verifier is not installed gets no receipt: a stamp nothing
/// can check is a stamp that would read as approval without ever being verified.
#[test]
#[ignore = "needs node and the TS build"]
fn a_project_without_the_receipt_verifier_is_refused() {
    let Some((ts, _)) = parity::case("plan-approve-no-helper")
        .fixture("plan-complete")
        .args(&["plan", "approve", "tasks/plans/261112-demo-plan"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stdout.contains("approval-receipt helper not found at"),
        "{}",
        ts.describe()
    );
}
