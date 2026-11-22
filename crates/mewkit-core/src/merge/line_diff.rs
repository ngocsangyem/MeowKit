//! Line diff for the three-way merge: the hunks that turn `base` into `side`.
//!
//! A longest-common-subsequence table over the lines left once the common
//! prefix and suffix are trimmed. Quadratic, so a middle larger than
//! [`MAX_CELLS`] is refused rather than diffed slowly; a skill file that
//! differs that much is not a candidate for a guarded merge anyway.

/// The largest LCS table built (lines × lines of the differing middle).
const MAX_CELLS: usize = 4_000_000;

/// Base lines `start..end` are replaced by `lines`. `start == end` is a pure
/// insertion before base line `start`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Hunk {
    pub start: usize,
    pub end: usize,
    pub lines: Vec<String>,
}

/// Lines with their terminators kept, so joining them gives the text back.
pub fn lines(text: &str) -> Vec<&str> {
    text.split_inclusive('\n').collect()
}

/// The hunks from `base` to `side`, in base order; `None` when the differing
/// middle is too large to diff.
pub fn hunks(base: &[&str], side: &[&str]) -> Option<Vec<Hunk>> {
    let prefix = base.iter().zip(side).take_while(|(a, b)| a == b).count();
    let rest = base.len().min(side.len()) - prefix;
    let suffix = base
        .iter()
        .rev()
        .zip(side.iter().rev())
        .take(rest)
        .take_while(|(a, b)| a == b)
        .count();
    let b = &base[prefix..base.len() - suffix];
    let s = &side[prefix..side.len() - suffix];
    if b.is_empty() && s.is_empty() {
        return Some(Vec::new());
    }
    if (b.len() + 1).saturating_mul(s.len() + 1) > MAX_CELLS {
        return None;
    }
    // lcs[i][j]: length of the LCS of b[i..] and s[j..].
    let width = s.len() + 1;
    let mut lcs = vec![0u32; (b.len() + 1) * width];
    for i in (0..b.len()).rev() {
        for j in (0..s.len()).rev() {
            lcs[i * width + j] = if b[i] == s[j] {
                lcs[(i + 1) * width + j + 1] + 1
            } else {
                lcs[(i + 1) * width + j].max(lcs[i * width + j + 1])
            };
        }
    }
    let mut out: Vec<Hunk> = Vec::new();
    let (mut i, mut j) = (0, 0);
    let mut open: Option<Hunk> = None;
    while i < b.len() || j < s.len() {
        if i < b.len() && j < s.len() && b[i] == s[j] {
            out.extend(open.take());
            i += 1;
            j += 1;
            continue;
        }
        let hunk = open.get_or_insert_with(|| Hunk {
            start: prefix + i,
            end: prefix + i,
            lines: Vec::new(),
        });
        let take_side =
            j < s.len() && (i == b.len() || lcs[i * width + j + 1] >= lcs[(i + 1) * width + j]);
        if take_side {
            hunk.lines.push(s[j].to_owned());
            j += 1;
        } else {
            i += 1;
            hunk.end = prefix + i;
        }
    }
    out.extend(open);
    Some(out)
}
