//! The entry format, and the usage block that teaches it.
//!
//! Shape validation is separate from the content scan: a malformed entry is a
//! mistake to correct, a flagged one is content to reconsider, and the two
//! refusals read differently for that reason.

/// Lines the approved entry format requires, so an entry stays reviewable and
/// prunable by a later session that did not write it.
const REQUIRED_MARKERS: [&str; 3] = ["Why:", "Apply when:", "Source:"];

/// The usage block, byte-identical to the npm CLI's — including the `mewkit`
/// program name, which is what a user actually types during the transition.
pub const USAGE: &str = concat!(
    "Usage: mewkit note <decisions|gotchas>   (entry text on stdin)\n",
    "\n",
    "The entry must start with a `## ` heading line and contain:\n",
    "  Why:          why the decision/gotcha is non-obvious\n",
    "  Apply when:   the situation a future session should recognise\n",
    "  Source:       the file, symbol or commit it came from\n",
    "\n",
    "Example:\n",
    r"  printf '## Vitest serializes files here   <!-- 2026-11-01 -->\nWhy: ...\nApply when: ...\nSource: vitest.config.ts\n' \",
    "\n",
    "    | mewkit note gotchas"
);

/// `String#trim`'s character set, which is not `char::is_whitespace`'s.
///
/// JavaScript trims U+FEFF (a BOM a pipe often carries) and Rust does not, so a
/// BOM-prefixed entry would fail the heading check here while passing it there —
/// a refusal for a byte the user cannot see. The reverse gap (U+0085, which Rust
/// trims and JavaScript does not) is left alone: it cannot change a verdict,
/// because an entry that starts with U+0085 has no `## ` heading either way.
pub(super) fn js_trim(text: &str) -> &str {
    text.trim_matches(|c: char| c.is_whitespace() || c == '\u{feff}')
}

/// `None` when the entry is well-formed, else the problem to report.
///
/// Every check runs against the TRIMMED entry, because the writer is a pipe:
/// `printf` and a here-doc differ in trailing newlines, and that is not a
/// formatting mistake worth refusing.
pub fn validate_note_shape(entry: &str) -> Option<String> {
    let trimmed = js_trim(entry);
    if trimmed.is_empty() {
        return Some("the entry is empty — nothing to append".to_string());
    }
    let lines = crate::memory::split_lines(trimmed);
    if !lines.first().is_some_and(|first| first.starts_with("## ")) {
        return Some("the entry must start with a `## ` heading line".to_string());
    }
    let missing: Vec<&str> = REQUIRED_MARKERS
        .iter()
        .copied()
        .filter(|marker| {
            !lines
                .iter()
                .any(|line| line.trim_start().starts_with(marker))
        })
        .collect();
    if !missing.is_empty() {
        // `a line, a b line` — the npm CLI's joiner, kept so the two refusals
        // are the same sentence.
        return Some(format!(
            "the entry is missing a {} line",
            missing.join(" line, a ")
        ));
    }
    None
}
