//! Unit tests for `dir_order` — the dir order rules.
use super::*;

#[test]
fn names_come_back_in_byte_order() {
    let scratch = tempfile::tempdir().expect("a temp dir");
    // Written in an order that is not the sorted one, and chosen so that
    // byte order and case-insensitive order DISAGREE: `Z` (0x5A) sorts
    // before `a` (0x61), which is what `strcoll` in the C locale does.
    for name in ["beta", "Zeta", "alpha"] {
        std::fs::write(scratch.path().join(name), "x").expect("write a file");
    }
    assert_eq!(sorted_names(scratch.path()), vec!["Zeta", "alpha", "beta"]);
}
