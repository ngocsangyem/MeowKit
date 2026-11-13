//! One flag, one check: the scoped runs CI invokes, and their exit codes.
//!
//! Each of these flags is a CI step somewhere in the kit, so "the same rows and
//! the same code" is the contract that step parses. `--memory` has its own file
//! beside this one, because a hook rather than a CI step reads it.
use crate::parity;

/// The gate-authority floor: one asserted claim is reported, while a statement
/// of the contract and a suppressed quotation are not.
#[test]
#[ignore = "needs node and the TS build"]
fn an_automated_gate_approval_claim_fails_the_gates_check() {
    let Some((ts, _)) = parity::case("validate-gates")
        .fixture("validate-gate-authority")
        .args(&["validate", "--gates"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stdout
            .contains("[FAIL] Automated gate-approval claims (1)"),
        "exactly one of the fixture's three lines may be reported: {}",
        ts.describe()
    );
}

/// Prose that states the contract is not prose that breaks it: the same check
/// over a tree with no claim at all passes.
#[test]
#[ignore = "needs node and the TS build"]
fn a_clean_tree_passes_the_gates_check() {
    let Some((ts, _)) = parity::case("validate-gates-clean")
        .fixture("validate-flat-copy")
        .args(&["validate", "--gates"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    // The scanned-file count lives in the PASS row's detail, which the
    // renderer suppresses; the row's NAME is what a reader sees.
    assert!(
        ts.stdout
            .contains("[PASS] No automated gate-approval claims"),
        "{}",
        ts.describe()
    );
}

/// A broad intent→skill table in an always-loaded rule file WARNs, which does
/// not fail the build on its own.
#[test]
#[ignore = "needs node and the TS build"]
fn a_broad_routing_table_warns_without_failing() {
    let Some((ts, _)) = parity::case("validate-rules")
        .fixture("validate-routing-table")
        .args(&["validate", "--rules"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(
        ts.stdout
            .contains("[WARN] Routing-table breadth: rules/skill-routing.md"),
        "the fixture stopped tripping the heuristic: {}",
        ts.describe()
    );
}

/// The same WARN under `--strict`, where it becomes the failure.
#[test]
#[ignore = "needs node and the TS build"]
fn a_routing_warning_fails_under_strict() {
    let Some((ts, _)) = parity::case("validate-rules-strict")
        .fixture("validate-routing-table")
        .args(&["validate", "--rules", "--strict"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
}

/// The rules check on a file set with no routing table at all reports one PASS.
#[test]
#[ignore = "needs node and the TS build"]
fn no_routing_table_reports_one_pass() {
    let Some((ts, _)) = parity::case("validate-rules-clean")
        .fixture("validate-flat-copy")
        .args(&["validate", "--rules"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(
        ts.stdout.contains("[PASS] Routing-table breadth"),
        "{}",
        ts.describe()
    );
}

/// `--docs-refs` scoped to the allowlist check: one error and one reserved
/// warning from the same fixture.
#[test]
#[ignore = "needs node and the TS build"]
fn the_docs_reference_check_reports_errors_and_reserved_paths() {
    let Some((ts, _)) = parity::case("validate-docs-refs")
        .fixture("validate-docs-refs")
        .args(&["validate", "--docs-refs"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stdout.contains("1 error(s), 1 warning(s)"),
        "the fixture stopped exercising both levels: {}",
        ts.describe()
    );
}

/// With no maintainer contract there is no allowlist, so the check is N/A —
/// rendered as a PASS row, because a consumer install ships without the
/// contract and must not fail for it. The whole report is one row.
#[test]
#[ignore = "needs node and the TS build"]
fn an_absent_contract_makes_the_docs_check_not_applicable() {
    let Some((ts, _)) = parity::case("validate-docs-refs-na")
        .fixture("validate-flat-copy")
        .args(&["validate", "--docs-refs"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(
        ts.stdout
            .contains("Docs\n  [PASS] Docs references on Type-1 allowlist\n\n1 passed"),
        "{}",
        ts.describe()
    );
}

/// A reference on the RESERVED list and nothing else: a WARN, which does not
/// fail the build on its own.
#[test]
#[ignore = "needs node and the TS build"]
fn a_reserved_docs_reference_warns_without_failing() {
    let Some((ts, _)) = parity::case("validate-docs-refs-reserved")
        .fixture("validate-docs-refs-reserved")
        .args(&["validate", "--docs-refs"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 0, "{}", ts.describe());
    assert!(
        ts.stdout.contains("0 error(s), 1 warning(s)"),
        "the fixture stopped producing exactly one warning: {}",
        ts.describe()
    );
}

/// The same run under `--strict`, where that WARN is the failure. The pair is
/// what proves `--strict` acts on warnings rather than on something else.
#[test]
#[ignore = "needs node and the TS build"]
fn strict_fails_on_a_warning_that_otherwise_passes() {
    let Some((ts, _)) = parity::case("validate-docs-refs-reserved-strict")
        .fixture("validate-docs-refs-reserved")
        .args(&["validate", "--docs-refs", "--strict"])
        .run()
    else {
        return;
    };
    assert_eq!(ts.code, 1, "{}", ts.describe());
    assert!(
        ts.stdout.contains("1 warnings") && !ts.stdout.contains("failed"),
        "the failure must come from the WARN, not from a FAIL row: {}",
        ts.describe()
    );
}
