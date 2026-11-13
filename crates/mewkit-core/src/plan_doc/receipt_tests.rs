//! The receipt's cross-language contract, pinned from the Rust side.
//!
//! The Node verifier is exercised against these same bytes by
//! `crates/mewkit-cli/tests/parity/plan_receipt_consumer.rs`; what is asserted
//! here is the shape of the body the digest is taken over, because that is what
//! makes the two agree.
use std::io::Write;

use super::*;

fn plan_file(content: &str) -> (tempfile::TempDir, std::path::PathBuf) {
    let dir = tempfile::tempdir().expect("temp dir");
    let path = dir.path().join("plan.md");
    let mut file = std::fs::File::create(&path).expect("create plan");
    file.write_all(content.as_bytes()).expect("write plan");
    (dir, path)
}

const PLAN: &str = "---\ntitle: T\nstatus: pending\n---\n\n## Goal\n\nIt works.\n";

#[test]
fn the_body_excludes_frontmatter_so_stamping_never_invalidates_itself() {
    assert_eq!(plan_body(PLAN), "\n## Goal\n\nIt works.\n");
}

#[test]
fn a_plan_without_frontmatter_is_entirely_body() {
    // A plan predating the stamp must stay hashable rather than unreadable.
    assert_eq!(plan_body("# Title\n"), "# Title\n");
}

/// A CRLF file's first line is `---\r`, which is not the fence — so the whole
/// file is body, and the hash still answers. The REFUSAL to stamp it is the
/// behaviour that follows, asserted below.
#[test]
fn a_crlf_plan_has_no_recognised_frontmatter() {
    let crlf = PLAN.replace('\n', "\r\n");
    assert!(plan_body(&crlf).starts_with("---\r\n"));
}

#[test]
fn a_crlf_plan_is_refused_rather_than_half_stamped() {
    let (_dir, path) = plan_file(&PLAN.replace('\n', "\r\n"));
    let before = std::fs::read(&path).expect("read before");
    let receipt = stamp(&path, "tester", "2026-11-12");
    assert_eq!(receipt.code, UNREADABLE);
    assert!(receipt.status.ends_with("has no YAML frontmatter to stamp"));
    assert_eq!(
        std::fs::read(&path).expect("read after"),
        before,
        "a refused stamp must not have touched the file"
    );
}

#[test]
fn trailing_whitespace_is_part_of_the_body() {
    // Hashing a trimmed body would let an invisible edit carry an approval over.
    let padded = PLAN.replace("It works.", "It works.  ");
    assert_ne!(plan_hash(PLAN), plan_hash(&padded));
}

#[test]
fn a_stamped_plan_verifies_fresh_and_goes_stale_on_a_body_edit() {
    let (_dir, path) = plan_file(PLAN);
    assert_eq!(verify(&path).code, NO_RECEIPT);
    assert_eq!(stamp(&path, "tester", "2026-11-12").code, FRESH);
    assert_eq!(verify(&path).code, FRESH);

    let stamped = std::fs::read_to_string(&path).expect("read stamped");
    std::fs::write(&path, stamped.replace("It works.", "It does not.")).expect("edit body");
    assert_eq!(verify(&path).code, STALE);
}

#[test]
fn re_stamping_replaces_the_old_block_instead_of_nesting_one() {
    let (_dir, path) = plan_file(PLAN);
    stamp(&path, "first", "2026-11-11");
    stamp(&path, "second", "2026-11-12");
    let content = std::fs::read_to_string(&path).expect("read stamped");
    assert_eq!(content.matches("approval:").count(), 1);
    assert!(content.contains("approved_by: second"));
    assert_eq!(verify(&path).code, FRESH);
}

#[test]
fn a_plan_hash_outside_the_approval_block_is_not_the_receipt() {
    let (_dir, path) = plan_file("---\ntitle: T\n---\n\nplan_hash: deadbeef\n");
    assert_eq!(verify(&path).code, NO_RECEIPT);
}

#[test]
fn an_unfenced_frontmatter_is_refused_rather_than_reported_as_stamped() {
    let (_dir, path) = plan_file("---\ntitle: T\n");
    let receipt = stamp(&path, "tester", "2026-11-12");
    assert_eq!(receipt.code, UNREADABLE);
    assert!(
        receipt
            .status
            .ends_with("no closing frontmatter fence — nothing stamped")
    );
}

#[test]
fn a_missing_file_is_unreadable_not_a_panic() {
    let dir = tempfile::tempdir().expect("temp dir");
    assert_eq!(verify(&dir.path().join("absent.md")).code, UNREADABLE);
    assert_eq!(
        stamp(&dir.path().join("absent.md"), "t", "d").code,
        UNREADABLE
    );
}
