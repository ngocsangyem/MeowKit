//! What a guarded merge may never change: the frontmatter block, and any
//! line that reads as a gate.
//!
//! Frontmatter carries a skill's name, description and trigger wording; a
//! change there decides when the skill loads, so neither side's change to it
//! is merged. Gate lines are the kit's stop and refuse wording. The list is
//! deliberately wide, because a false match only means the merge falls back
//! to keeping the user's file, while a miss could merge a weakened gate. It
//! is drawn from the markers the kit's skills and rules use:
//!
//! - case-sensitive: `STOP` (incl. `HARD_STOP`), `HARD` (`HARD CAP`,
//!   `HARD GATE`), `BLOCK` (`BLOCK`, `BLOCKING`, `BLOCKED`), `MUST`, `NEVER`;
//! - any case: a word starting `gate` (`gate`, `gates`, `gated`, `Gate 1`),
//!   `non-negotiable`, `must not`, `injection`, `untrusted`.

/// Every substring that marks a gate line when it appears with this case.
const CASED: [&str; 5] = ["STOP", "HARD", "BLOCK", "MUST", "NEVER"];
/// Every substring that marks a gate line in any case (matched lowercased).
const ANY_CASE: [&str; 4] = ["non-negotiable", "must not", "injection", "untrusted"];

/// Whether `line` reads as a gate line.
pub fn is_gate_line(line: &str) -> bool {
    if CASED.iter().any(|m| line.contains(m)) {
        return true;
    }
    let lower = line.to_lowercase();
    if ANY_CASE.iter().any(|m| lower.contains(m)) {
        return true;
    }
    // `gate` at the start of a word: `delegate` and `navigate` do not count.
    lower.match_indices("gate").any(|(at, _)| {
        lower[..at]
            .chars()
            .next_back()
            .is_none_or(|c| !c.is_alphanumeric())
    })
}

/// How many leading lines of `lines` are its frontmatter block: from an
/// opening `---` on the first line through its closing `---`, both included;
/// 0 when there is none. An opening fence that never closes makes the whole
/// text the block, so no change to such a file is merged.
pub fn frontmatter_len(lines: &[&str]) -> usize {
    let fence = |l: &str| l.trim_end() == "---";
    match lines.first() {
        Some(first) if fence(first) => lines[1..]
            .iter()
            .position(|l| fence(l))
            .map_or(lines.len(), |close| close + 2),
        _ => 0,
    }
}
