//! `approval-receipt.cjs` against a receipt the Rust binary stamped.

use super::*;

const PLAN_DIR: &str = "tasks/plans/261112-demo-plan";

fn stamped_plan(s: &Scratch) -> PathBuf {
    let run = rust(s, &["plan", "approve", PLAN_DIR, "--by", "tester"], None);
    assert_eq!(run.code, 0, "the Rust stamp failed: {}", run.describe());
    s.project.join(PLAN_DIR).join("plan.md")
}

#[test]
#[ignore = "needs node and the TS build"]
fn the_receipt_verifier_recomputes_the_digest_the_rust_stamp_recorded() {
    let Some(_) = parity::check("hook-mirror-receipt-hash") else {
        return;
    };
    let s = scratch("mewkit-mirror-receipt-", "plan-approvable");
    let plan = stamped_plan(&s);
    let helper = hook("lib/approval-receipt.cjs");

    let (code, digest) = node(&s, &[helper.as_ref(), "hash".as_ref(), plan.as_ref()]);
    assert_eq!(code, 0, "the helper could not hash the plan: {digest}");
    let text = std::fs::read_to_string(&plan).expect("read the stamped plan");
    assert!(
        text.contains(&format!("  plan_hash: {digest}")),
        "the digest the shipped helper computes is not the one Rust stamped ({digest}):\n{text}"
    );
}

#[test]
#[ignore = "needs node and the TS build"]
fn a_renamed_receipt_field_reads_as_no_receipt() {
    let Some(_) = parity::check("hook-mirror-receipt-rename") else {
        return;
    };
    let s = scratch("mewkit-mirror-receipt-neg-", "plan-approvable");
    let plan = stamped_plan(&s);
    let helper = hook("lib/approval-receipt.cjs");
    let verify = || node(&s, &[helper.as_ref(), "verify".as_ref(), plan.as_ref()]);
    assert_eq!(
        verify(),
        (0, "fresh".to_string()),
        "the baseline must be fresh"
    );

    // The verifier reads `plan_hash` inside `approval:`; if the writer ever
    // renamed either, every guard would see a plan with no receipt.
    for (from, to) in [("plan_hash:", "planHash:"), ("approval:", "approvals:")] {
        let text = std::fs::read_to_string(&plan).expect("read the plan");
        let renamed = text.replace(from, to);
        assert_ne!(text, renamed, "the stamp no longer contains {from}");
        std::fs::write(&plan, &renamed).expect("write the renamed plan");
        assert_eq!(
            verify(),
            (10, "no-receipt".to_string()),
            "renaming {from} to {to} was not noticed"
        );
        std::fs::write(&plan, text).expect("restore the plan");
    }
}
