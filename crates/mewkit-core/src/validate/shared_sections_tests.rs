//! A section is the text between its marker lines, and nothing else.
use super::{extract_section, section_drift};

const DOC: &str = "intro\n<!-- shared:core -->\nline one\nline two\n<!-- /shared:core -->\noutro\n";

#[test]
fn the_text_between_the_markers_is_returned_without_them() {
    assert_eq!(
        extract_section(DOC, "core").as_deref(),
        Some("line one\nline two")
    );
}

#[test]
fn a_missing_or_unclosed_marker_yields_nothing() {
    assert_eq!(extract_section(DOC, "other"), None);
    assert_eq!(extract_section("<!-- shared:core -->\nx\n", "core"), None);
    assert_eq!(extract_section("x\n<!-- /shared:core -->\n", "core"), None);
}

#[test]
fn text_outside_the_markers_does_not_count_as_drift() {
    let other =
        "different intro\n<!-- shared:core -->\nline one\nline two\n<!-- /shared:core -->\n";
    assert_eq!(section_drift(DOC, other, "core"), None);
}

#[test]
fn a_changed_or_absent_section_is_reported() {
    let changed = DOC.replace("line two", "line 2");
    assert_eq!(
        section_drift(DOC, &changed, "core").as_deref(),
        Some("`core` section differs")
    );
    assert_eq!(
        section_drift(DOC, "no markers", "core").as_deref(),
        Some("has no `core` section")
    );
}
