//! Guarded line-based three-way merge (diff3) of a user's edit with the kit's.
//!
//! diff3 gives a clean and unique result only when the two sides' edits are
//! separated by an unchanged region holding a line that appears once, so
//! this merge refuses everything else: hunks from the two sides that overlap
//! or adjoin, a separating region with no unique line, and any hunk that
//! touches frontmatter or a gate line ([`super::text3_guard`]). A refusal is
//! not an error: the caller keeps the user's file as it is.
use super::line_diff::{Hunk, hunks, lines};
use super::text3_guard::frontmatter_len;
pub(crate) use super::text3_guard::is_gate_line;

/// Why two edits were not merged.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum Refusal {
    #[error("the file is too large or changed too much to diff")]
    TooLarge,
    #[error("your edit and the kit's change overlap or touch")]
    Overlap,
    #[error("no unchanged line that appears once separates your edit from the kit's change")]
    NoAnchor,
    #[error("an edit touches the frontmatter")]
    Frontmatter,
    #[error("an edit touches a gate line")]
    GateLine,
}

/// `base` with both `ours` and `theirs` applied, or why not.
pub fn merge3(base: &str, ours: &str, theirs: &str) -> Result<String, Refusal> {
    let b = lines(base);
    let o = lines(ours);
    let t = lines(theirs);
    let front = frontmatter_len(&b);
    if b[..front] != o[..frontmatter_len(&o)] || b[..front] != t[..frontmatter_len(&t)] {
        return Refusal::Frontmatter.into_err();
    }
    let ours_h = hunks(&b, &o).ok_or(Refusal::TooLarge)?;
    let theirs_h = hunks(&b, &t).ok_or(Refusal::TooLarge)?;
    for h in ours_h.iter().chain(&theirs_h) {
        if h.start < front {
            return Refusal::Frontmatter.into_err();
        }
        let removed = b[h.start..h.end].iter().copied();
        if removed
            .chain(h.lines.iter().map(String::as_str))
            .any(is_gate_line)
        {
            return Refusal::GateLine.into_err();
        }
    }
    for x in &ours_h {
        for y in &theirs_h {
            let (first, second) = if x.start <= y.start { (x, y) } else { (y, x) };
            // Strictly before: at least one unchanged base line between them.
            if first.end >= second.start {
                return Refusal::Overlap.into_err();
            }
            let gap = &b[first.end..second.start];
            if !gap.iter().any(|l| unique_in(l, [&b, &o, &t])) {
                return Refusal::NoAnchor.into_err();
            }
        }
    }
    let mut all: Vec<&Hunk> = ours_h.iter().chain(&theirs_h).collect();
    all.sort_by_key(|h| h.start);
    let mut out = String::with_capacity(ours.len().max(theirs.len()));
    let mut at = 0;
    for h in all {
        out.extend(b[at..h.start].iter().copied());
        out.extend(h.lines.iter().map(String::as_str));
        at = h.end;
    }
    out.extend(b[at..].iter().copied());
    Ok(out)
}

/// A non-blank line that occurs exactly once in each text.
fn unique_in(line: &str, texts: [&[&str]; 3]) -> bool {
    !line.trim().is_empty()
        && texts
            .iter()
            .all(|t| t.iter().filter(|l| **l == line).count() == 1)
}

/// Whether `a` and `b` open with the same frontmatter block (or neither has one).
pub fn same_frontmatter(a: &str, b: &str) -> bool {
    let (a, b) = (lines(a), lines(b));
    a[..frontmatter_len(&a)] == b[..frontmatter_len(&b)]
}

impl Refusal {
    fn into_err<T>(self) -> Result<T, Self> {
        Err(self)
    }
}

#[cfg(test)]
#[path = "text3_tests.rs"]
mod tests;
