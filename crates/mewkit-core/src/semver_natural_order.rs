//! `localeCompare(…, { numeric: true, sensitivity: "base" })` for version
//! strings — the fallback `portable-manifest.ts` uses when either side is not
//! valid semver.
//!
//! Separate from the semver parser because it is a COLLATION, not a version
//! model: it must keep working on strings semver rejects.
use std::cmp::Ordering;

/// `localeCompare(b, undefined, { numeric: true, sensitivity: "base" })`, to the
/// extent a version string needs it: digit runs compare by value, everything else
/// case-insensitively, and a prefix sorts before the longer string.
///
/// Approximation, deliberately: full ICU root collation (where punctuation and
/// letters interleave by weight) is not reproduced. It only decides the order of
/// NON-semver manifest versions, where the TS behaviour is itself a fallback.
pub fn natural_compare(a: &str, b: &str) -> Ordering {
    let left = chunks(a);
    let right = chunks(b);
    for (l, r) in left.iter().zip(right.iter()) {
        let order = match (l, r) {
            (Chunk::Number(l), Chunk::Number(r)) => {
                // Compared without parsing, so an absurdly long run cannot overflow.
                let l = l.trim_start_matches('0');
                let r = r.trim_start_matches('0');
                l.len().cmp(&r.len()).then_with(|| l.cmp(r))
            }
            // Root collation puts digits before letters.
            (Chunk::Number(_), Chunk::Text(_)) => Ordering::Less,
            (Chunk::Text(_), Chunk::Number(_)) => Ordering::Greater,
            (Chunk::Text(l), Chunk::Text(r)) => l.cmp(r),
        };
        if order != Ordering::Equal {
            return order;
        }
    }
    left.len().cmp(&right.len())
}

enum Chunk {
    Number(String),
    /// Lower-cased, so `sensitivity: "base"` holds for ASCII.
    Text(String),
}

fn chunks(text: &str) -> Vec<Chunk> {
    let mut out = Vec::new();
    let mut rest = text;
    while !rest.is_empty() {
        let digits = rest.starts_with(|c: char| c.is_ascii_digit());
        let end = rest
            .find(|c: char| c.is_ascii_digit() != digits)
            .unwrap_or(rest.len());
        let (head, tail) = rest.split_at(end);
        out.push(if digits {
            Chunk::Number(head.to_string())
        } else {
            Chunk::Text(head.to_lowercase())
        });
        rest = tail;
    }
    out
}
