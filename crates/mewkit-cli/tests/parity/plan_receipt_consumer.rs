//! The Gate 1 consumer must accept a receipt the RUST binary stamped.
//!
//! `.claude/hooks/lib/approval-receipt.cjs` is the verifier every write guard
//! runs (`hooks/lib/core/plan-gate.cjs` branches on its codes), and it
//! recomputes the plan hash itself. So the check that matters is not "both CLIs
//! print the same digest" — it is "the SHIPPED verifier, under Node, calls the
//! Rust-written receipt fresh, and calls it stale once the body changes".
//!
//! Run against the repo's real helper, never a copy: a test that verified a
//! vendored duplicate would keep passing after the real one changed.
use std::path::Path;
use std::process::Command;

use crate::parity;

/// `{ code, status }` of one helper invocation.
fn run_helper(repo: &Path, project: &Path, command: &str, plan: &Path) -> (i32, String) {
    let helper = repo.join(".claude/hooks/lib/approval-receipt.cjs");
    assert!(
        helper.is_file(),
        "the shipped receipt helper is missing at {}",
        helper.display()
    );
    let out = Command::new("node")
        .arg(&helper)
        .arg(command)
        .arg(plan)
        .current_dir(project)
        .output()
        .expect("spawn the receipt helper");
    let text = format!(
        "{}{}",
        String::from_utf8_lossy(&out.stdout),
        String::from_utf8_lossy(&out.stderr)
    );
    (out.status.code().unwrap_or(-1), text.trim().to_string())
}

#[test]
#[ignore = "needs node and the TS build"]
fn the_shipped_verifier_accepts_a_receipt_this_binary_stamped() {
    let Some(_) = parity::check("plan-receipt-consumer") else {
        return;
    };
    let repo = parity::repo_root();
    let scratch = tempfile::Builder::new()
        .prefix("mewkit-receipt-")
        .tempdir()
        .expect("create the scratch dir");
    let project = scratch.path().join("project");
    let home = scratch.path().join("home");
    std::fs::create_dir_all(&home).expect("create the temp home");
    parity::copy_fixture("plan-approvable", &project);
    let plan = project.join("tasks/plans/261112-demo-plan/plan.md");

    // Before the stamp the guard sees no receipt, which is what BLOCKS — so the
    // test starts from the state it must move away from.
    assert_eq!(
        run_helper(&repo, &project, "verify", &plan).0,
        10,
        "an unstamped plan must read as no-receipt"
    );

    let stamped = parity::run_rust(
        &project,
        &home,
        &[
            "plan",
            "approve",
            "tasks/plans/261112-demo-plan",
            "--by",
            "tester",
        ],
        &[],
        None,
    );
    assert_eq!(
        stamped.code,
        0,
        "the Rust stamp failed: {}",
        stamped.describe()
    );

    let (code, status) = run_helper(&repo, &project, "verify", &plan);
    assert_eq!(
        (code, status.as_str()),
        (0, "fresh"),
        "the shipped verifier rejected a receipt this binary wrote"
    );

    // The whole point of the receipt is the revision BINDING: editing the body
    // must invalidate it, or an approval silently carries over to changed scope.
    let body = std::fs::read_to_string(&plan).expect("read the stamped plan");
    std::fs::write(
        &plan,
        body.replace("nothing missing", "something else entirely"),
    )
    .expect("edit the plan body");
    let (code, status) = run_helper(&repo, &project, "verify", &plan);
    assert_eq!(
        (code, status.as_str()),
        (11, "stale"),
        "an edited body must invalidate the receipt"
    );
}

/// Fixtures that must carry the helper, because the npm CLI resolves it from
/// the cwd and refuses to stamp without it.
const FIXTURES_WITH_HELPER: [&str; 3] = [
    "plan-activation-blocked",
    "plan-approvable",
    "plan-reactivate",
];

/// Those copies can DRIFT, and a drifted copy would make the approve parity
/// cases compare the two CLIs against a verifier no project actually ships. So
/// each copy is pinned to the shipped file, byte for byte.
#[test]
fn every_fixture_copy_of_the_receipt_helper_matches_the_shipped_one() {
    let repo = parity::repo_root();
    let shipped = repo.join(".claude/hooks/lib/approval-receipt.cjs");
    let expected = std::fs::read(&shipped).expect("read the shipped helper");
    for fixture in FIXTURES_WITH_HELPER {
        let vendored = repo
            .join("crates/mewkit-cli/tests/parity/fixtures")
            .join(fixture)
            .join("_claude/hooks/lib/approval-receipt.cjs");
        assert_eq!(
            expected,
            std::fs::read(&vendored).expect("read the fixture helper"),
            "{fixture}'s copy of approval-receipt.cjs has drifted from {} — \
             copy it again and re-run the approve parity cases",
            shipped.display()
        );
    }
}
