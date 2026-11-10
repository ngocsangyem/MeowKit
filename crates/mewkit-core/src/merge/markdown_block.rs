//! A marked block inside a user-owned Markdown file (e.g. `AGENTS.md`).
//!
//! ```text
//! <!-- mewkit:begin ID -->
//! content
//! <!-- mewkit:end ID -->
//! ```
//!
//! `strip(merge(user, ..)) == user` byte for byte. When `user` does not end in
//! a newline, merge has to add one before the block; the begin marker records
//! that as `+nl`, because otherwise "a" and "a\n" merge to identical bytes and
//! strip could not tell which to give back.
use super::MergeError;

const BEGIN: &str = "<!-- mewkit:begin ";
const END: &str = "<!-- mewkit:end ";
const CLOSE: &str = " -->";
const ADDED_NL: &str = " +nl";

/// Insert or replace block `id` with `content`.
pub fn merge(text: &str, id: &str, content: &str) -> Result<String, MergeError> {
    check_id(id)?;
    check_content(content)?;
    if let Some(span) = find(text, id)? {
        let begin_line = &text[span.start
            ..text[span.start..]
                .find('\n')
                .map_or(text.len(), |i| span.start + i)];
        let block = render(id, content, begin_line.contains(ADDED_NL));
        return Ok(format!(
            "{}{}{}",
            &text[..span.start],
            block,
            &text[span.end..]
        ));
    }
    let added_nl = !text.is_empty() && !text.ends_with('\n');
    let sep = if added_nl { "\n" } else { "" };
    Ok(format!("{text}{sep}{}", render(id, content, added_nl)))
}

/// Remove block `id`, restoring the text exactly as it was before merge.
/// Text without the block is returned unchanged.
pub fn strip(text: &str, id: &str) -> Result<String, MergeError> {
    check_id(id)?;
    let Some(span) = find(text, id)? else {
        return Ok(text.to_owned());
    };
    let head = &text[..span.start];
    let begin_line_end = text[span.start..]
        .find('\n')
        .map_or(text.len(), |i| span.start + i);
    let head = if text[span.start..begin_line_end].contains(ADDED_NL) {
        head.strip_suffix('\n').unwrap_or(head)
    } else {
        head
    };
    Ok(format!("{head}{}", &text[span.end..]))
}

fn render(id: &str, content: &str, added_nl: bool) -> String {
    let flag = if added_nl { ADDED_NL } else { "" };
    let body = if content.is_empty() || content.ends_with('\n') {
        content.to_owned()
    } else {
        format!("{content}\n")
    };
    format!("{BEGIN}{id}{flag}{CLOSE}\n{body}{END}{id}{CLOSE}\n")
}

/// Byte span of block `id`: from its begin marker to just past its end line.
fn find(text: &str, id: &str) -> Result<Option<std::ops::Range<usize>>, MergeError> {
    let begins: Vec<usize> = line_starts(text)
        .filter(|&i| is_marker(&text[i..], BEGIN, id))
        .collect();
    let ends: Vec<usize> = line_starts(text)
        .filter(|&i| is_marker(&text[i..], END, id))
        .collect();
    match (begins.as_slice(), ends.as_slice()) {
        ([], []) => Ok(None),
        ([b], [e]) if b < e => {
            let end_line = text[*e..].find('\n').map_or(text.len(), |i| e + i + 1);
            Ok(Some(*b..end_line))
        }
        _ => Err(MergeError::Malformed(format!(
            "block {id:?} has {} begin and {} end markers, or they are out of order",
            begins.len(),
            ends.len()
        ))),
    }
}

fn line_starts(text: &str) -> impl Iterator<Item = usize> + '_ {
    std::iter::once(0)
        .chain(text.match_indices('\n').map(|(i, _)| i + 1))
        .filter(move |&i| i < text.len())
}

fn is_marker(line: &str, kind: &str, id: &str) -> bool {
    let line = line.split('\n').next().unwrap_or_default();
    let Some(rest) = line.strip_prefix(kind).and_then(|r| r.strip_suffix(CLOSE)) else {
        return false;
    };
    rest == id || (kind == BEGIN && rest.strip_suffix(ADDED_NL) == Some(id))
}

fn check_id(id: &str) -> Result<(), MergeError> {
    if !id.is_empty()
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        Ok(())
    } else {
        Err(MergeError::Malformed(format!(
            "block id {id:?} must be [A-Za-z0-9_-]+"
        )))
    }
}

fn check_content(content: &str) -> Result<(), MergeError> {
    if content.contains(BEGIN) || content.contains(END) {
        Err(MergeError::Malformed(
            "block content contains a mewkit marker".into(),
        ))
    } else {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    #[test]
    fn appends_then_replaces_in_place() {
        let once = merge("# Mine\n", "meowkit", "v1").unwrap();
        assert_eq!(
            once,
            "# Mine\n<!-- mewkit:begin meowkit -->\nv1\n<!-- mewkit:end meowkit -->\n"
        );
        let user_after = format!("{once}tail\n");
        let twice = merge(&user_after, "meowkit", "v2\n").unwrap();
        assert!(twice.contains("v2\n") && !twice.contains("v1") && twice.ends_with("tail\n"));
    }

    #[test]
    fn strip_restores_a_file_without_trailing_newline() {
        let merged = merge("no newline", "x", "c").unwrap();
        assert!(merged.contains("+nl"));
        assert_eq!(strip(&merged, "x").unwrap(), "no newline");
        assert_eq!(strip(&merge("", "x", "c").unwrap(), "x").unwrap(), "");
    }

    #[test]
    fn malformed_markers_are_errors() {
        let dup = format!("{0}{0}", merge("", "x", "c").unwrap());
        assert!(merge(&dup, "x", "d").is_err());
        assert!(strip("<!-- mewkit:begin x -->\nno end\n", "x").is_err());
        assert!(merge("", "bad id", "c").is_err());
        assert!(merge("", "x", "<!-- mewkit:end x -->").is_err());
    }

    proptest! {
        #[test]
        fn strip_inverts_merge(user in "[a-z#\\- \n]{0,40}", content in "[a-z \n]{0,20}") {
            let merged = merge(&user, "meowkit", &content).unwrap();
            prop_assert_eq!(strip(&merged, "meowkit").unwrap(), user.clone());
            // Re-merging replaces in place; strip still restores the user text.
            let again = merge(&merged, "meowkit", "other").unwrap();
            prop_assert_eq!(strip(&again, "meowkit").unwrap(), user);
        }
    }
}
