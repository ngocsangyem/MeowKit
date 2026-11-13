//! The plan-approval receipt, ported from `.claude/hooks/lib/approval-receipt.cjs`.
//!
//! Threat model: ANTI-ACCIDENTAL (deter and detect, not unforgeable). The
//! receipt is agent-writable by design — it proves "an approval was stamped
//! against THIS plan revision", never "a human approved". The value is the
//! revision BINDING: editing the plan body after approval invalidates the
//! stamp, so an approval can never silently carry over to changed scope.
//!
//! ## Why this is a port and not a call
//!
//! The `.cjs` module is still the VERIFIER every write guard runs, so the hash
//! here must be the same hash there, for every byte sequence. That is a
//! contract, not an implementation detail, and it is pinned by a test that
//! stamps with this code and verifies with that file under Node. Shelling out
//! instead would have made a Rust CLI need Node to clear Gate 1.
//!
//! The body hash EXCLUDES YAML frontmatter on purpose: the stamp lives IN the
//! frontmatter, so stamping never invalidates itself, while any edit to the
//! plan's actual content does — which is the whole point.
use std::path::Path;
use std::sync::LazyLock;

use regex::Regex;

use crate::fsx::sha256_hex;

/// Verify outcomes. The numbers are the contract with the guard, not an enum
/// detail: the `.cjs` verifier exits with them and a hook branches on them.
pub const FRESH: u8 = 0;
pub const NO_RECEIPT: u8 = 10;
pub const STALE: u8 = 11;
pub const UNREADABLE: u8 = 12;

static APPROVAL_KEY: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^approval:[ \t]*$").expect("static approval-key pattern"));
static PLAN_HASH: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^[ \t]+plan_hash:[ \t]*(.*)$").expect("static plan-hash pattern")
});

/// What a receipt operation produced: the guard's code, and the line the CLI
/// prints (on stdout for [`FRESH`], on stderr otherwise).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Receipt {
    pub code: u8,
    pub status: String,
}

/// Split a file into the lines a line-oriented reader would see: a trailing
/// newline terminates the last line rather than starting an empty one.
fn to_lines(content: &str) -> Vec<&str> {
    let mut lines: Vec<&str> = content.split('\n').collect();
    if lines.last() == Some(&"") {
        lines.pop();
    }
    lines
}

/// True for a line that starts a new top-level key, which is how the end of the
/// `approval:` block is recognised. An EMPTY line does not end it, matching
/// `/^[^\s]/`.
fn starts_at_column_zero(line: &str) -> bool {
    line.chars().next().is_some_and(|c| !c.is_whitespace())
}

/// Everything after the closing `---` of YAML frontmatter. A file with no
/// frontmatter is entirely body, which keeps a plan that predates the stamp
/// hashable rather than unreadable.
///
/// A CRLF file has no frontmatter BY THIS RULE: its first line is `---\r`, not
/// `---`. The whole file is then the body, which is why a CRLF plan hashes but
/// cannot be stamped.
pub fn plan_body(content: &str) -> String {
    let mut out = String::new();
    let mut in_frontmatter = false;
    for (index, line) in to_lines(content).iter().enumerate() {
        if index == 0 && *line == "---" {
            in_frontmatter = true;
            continue;
        }
        if in_frontmatter && *line == "---" {
            in_frontmatter = false;
            continue;
        }
        if in_frontmatter {
            continue;
        }
        // Every emitted line is newline-terminated, matching what a line
        // printer feeds a digest.
        out.push_str(line);
        out.push('\n');
    }
    out
}

pub fn plan_hash(content: &str) -> String {
    sha256_hex(plan_body(content).as_bytes())
}

/// The `plan_hash` recorded in an existing `approval:` block, or empty when
/// there is none.
pub fn stored_hash(content: &str) -> String {
    let mut in_approval = false;
    for line in to_lines(content) {
        if APPROVAL_KEY.is_match(line) {
            in_approval = true;
            continue;
        }
        if in_approval {
            if let Some(caps) = PLAN_HASH.captures(line) {
                return caps
                    .get(1)
                    .map(|m| m.as_str().chars().filter(|c| !c.is_whitespace()).collect())
                    .unwrap_or_default();
            }
            // A key at column zero ends the block, so a later `plan_hash:`
            // elsewhere is not ours.
            if starts_at_column_zero(line) {
                in_approval = false;
            }
        }
    }
    String::new()
}

fn read_plan(file: &Path) -> Option<String> {
    if !file.is_file() {
        return None;
    }
    std::fs::read_to_string(file).ok()
}

/// `fresh`, `no-receipt`, `stale` or `unreadable` for one plan file.
pub fn verify(file: &Path) -> Receipt {
    let Some(content) = read_plan(file) else {
        return Receipt {
            code: UNREADABLE,
            status: format!("unreadable: {}", file.display()),
        };
    };
    let stored = stored_hash(&content);
    if stored.is_empty() {
        return Receipt {
            code: NO_RECEIPT,
            status: "no-receipt".to_string(),
        };
    }
    if stored == plan_hash(&content) {
        Receipt {
            code: FRESH,
            status: "fresh".to_string(),
        }
    } else {
        Receipt {
            code: STALE,
            status: "stale".to_string(),
        }
    }
}

/// Write (or replace) the `approval:` block inside the plan's frontmatter.
///
/// Refuses a plan with no closing frontmatter fence rather than reporting
/// success on an unstamped file: an unstamped plan reads back as no-receipt and
/// blocks, which is safe, but a success message would be a lie.
///
/// `date` is `YYYY-MM-DD` — injected, so the caller owns the clock.
pub fn stamp(file: &Path, approver: &str, date: &str) -> Receipt {
    let Some(content) = read_plan(file) else {
        return Receipt {
            code: UNREADABLE,
            status: format!("not a file: {}", file.display()),
        };
    };
    let lines = to_lines(&content);
    if lines.first() != Some(&"---") {
        return Receipt {
            code: UNREADABLE,
            status: format!("{} has no YAML frontmatter to stamp", file.display()),
        };
    }

    let digest = plan_hash(&content);
    let mut out: Vec<String> = Vec::new();
    let mut in_frontmatter = false;
    let mut skipping_old_block = false;
    let mut stamped = false;
    for (index, line) in lines.iter().enumerate() {
        if index == 0 && *line == "---" {
            in_frontmatter = true;
            out.push((*line).to_string());
            continue;
        }
        if in_frontmatter && *line == "---" {
            out.push("approval:".to_string());
            out.push(format!("  approved_by: {approver}"));
            out.push(format!("  date: {date}"));
            out.push(format!("  plan_hash: {digest}"));
            out.push((*line).to_string());
            in_frontmatter = false;
            stamped = true;
            continue;
        }
        if in_frontmatter && skipping_old_block {
            if line.starts_with([' ', '\t']) {
                continue;
            }
            if starts_at_column_zero(line) {
                skipping_old_block = false;
            }
        }
        if in_frontmatter && APPROVAL_KEY.is_match(line) {
            skipping_old_block = true;
            continue;
        }
        out.push((*line).to_string());
    }

    if !stamped {
        return Receipt {
            code: UNREADABLE,
            status: format!(
                "{} has no closing frontmatter fence — nothing stamped",
                file.display()
            ),
        };
    }
    // A plain write, like the `.cjs` writer: an atomic replace would change the
    // file's mode and inode on a file the human owns and edits, for a durability
    // guarantee the verifier does not need (an interrupted stamp reads back as
    // no-receipt, which BLOCKS).
    if let Err(error) = std::fs::write(file, format!("{}\n", out.join("\n"))) {
        return Receipt {
            code: UNREADABLE,
            status: format!("cannot write {}: {error}", file.display()),
        };
    }
    Receipt {
        code: FRESH,
        status: format!(
            "Stamped approval on {} (plan_hash {}…, approved_by: {approver}, date: {date})",
            file.display(),
            &digest[..10.min(digest.len())]
        ),
    }
}

#[cfg(test)]
#[path = "receipt_tests.rs"]
mod tests;
