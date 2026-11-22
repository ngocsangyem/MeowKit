//! Unit tests for `result` — the result rules.
use super::*;

#[test]
fn na_is_padded_so_names_align() {
    assert_eq!(Status::Na.label().len(), Status::Pass.label().len());
}

#[test]
fn print_order_names_each_section_once() {
    // A section listed twice prints its rows twice; one listed never
    // computes rows that no reader sees. Headings are unique, so comparing
    // the set of headings catches both.
    let mut headings: Vec<&str> = Section::ORDER.iter().map(|s| s.heading()).collect();
    let listed = headings.len();
    headings.sort_unstable();
    headings.dedup();
    assert_eq!(headings.len(), listed, "a section is listed twice");
    assert_eq!(listed, 16, "a section was added without a print position");
}
