//! Marked sections of a file, for families whose members share a block rather
//! than a whole file.
//!
//! An agent cannot include another file, so the boilerplate several agents
//! share is copied into each one. Each copy sits between a pair of marker
//! lines and the rest of the file is free to differ:
//!
//! ```text
//! <!-- shared:executor-memory -->
//! ...text kept identical in every member...
//! <!-- /shared:executor-memory -->
//! ```
//!
//! The marker lines themselves are not part of the compared text.

fn start_marker(name: &str) -> String {
    format!("<!-- shared:{name} -->")
}

fn end_marker(name: &str) -> String {
    format!("<!-- /shared:{name} -->")
}

/// The lines strictly between the first start marker for `name` and the next
/// end marker, or `None` when either marker is absent or the end comes first.
pub fn extract_section(text: &str, name: &str) -> Option<String> {
    let (start, end) = (start_marker(name), end_marker(name));
    let mut body: Option<Vec<&str>> = None;
    for line in text.lines() {
        match body.as_mut() {
            None if line.trim() == start => body = Some(Vec::new()),
            Some(lines) if line.trim() == end => return Some(lines.join("\n")),
            Some(lines) => lines.push(line),
            None => {}
        }
    }
    None
}

/// Why `actual` does not match `expected` in section `name`, or `None` when it does.
pub fn section_drift(expected: &str, actual: &str, name: &str) -> Option<String> {
    match (
        extract_section(expected, name),
        extract_section(actual, name),
    ) {
        (_, None) => Some(format!("has no `{name}` section")),
        (Some(want), Some(got)) if want != got => Some(format!("`{name}` section differs")),
        _ => None,
    }
}

#[cfg(test)]
#[path = "shared_sections_tests.rs"]
mod shared_sections_tests;
