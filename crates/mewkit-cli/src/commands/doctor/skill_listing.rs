//! What each installed runtime's skill listing costs, against that runtime's
//! documented budget.
//!
//! A host lists every skill's name and some description text in each session.
//! Claude Code gives that listing 1% of the context window and drops the
//! descriptions of the least-used skills first; Codex gives it 2% and shortens
//! descriptions, then omits skills. Neither unit is exact for this row, so
//! sizes are characters from the installed frontmatter and token figures are
//! an estimate (4 characters per token). A runtime whose vendor documents no
//! budget is reported as `unknown` rather than given a figure.
//!
//! The text a runtime lists is read from what is installed. Claude Code lists
//! `description` and `when_to_use` together, truncated at 1,536 characters;
//! every other runtime lists `description`, which the adapters project to
//! carry `when_to_use` already.
//!
//! Advisory only: a listing over budget is a warning and never fails a run.
use mewkit_adapters::contract::Runtime;

use super::coexistence::{at, installed, trees};
use super::coexistence_scan::{self as scan, MAX_FIELD};
use super::{Check, Status};
use crate::place::Place;

/// Context windows the row reports against, in tokens.
const WINDOWS: [(&str, u64); 2] = [("200K", 200_000), ("1M", 1_000_000)];
/// Characters Claude Code keeps of one entry's `description` plus `when_to_use`.
const CLAUDE_ENTRY_CAP: usize = 1_536;
/// The estimate behind every token figure here.
const CHARS_PER_TOKEN: u64 = 4;

/// A runtime's documented listing budget.
enum Budget {
    /// A share of the context window, with where the vendor states it.
    Percent {
        pct: u64,
        source: &'static str,
    },
    Unknown,
}

fn budget(runtime: Runtime) -> Budget {
    match runtime {
        Runtime::ClaudeCode => Budget::Percent {
            pct: 1,
            source: "code.claude.com/docs/en/skills",
        },
        Runtime::Codex => Budget::Percent {
            pct: 2,
            source: "Codex config reference, skills.max_context_tokens",
        },
        _ => Budget::Unknown,
    }
}

/// One skill as the listing carries it, in characters.
struct Entry {
    name: String,
    name_chars: usize,
    text_chars: usize,
}

fn entry(runtime: Runtime, fields: &scan::SkillFields) -> Entry {
    let desc = fields.description.chars().count();
    let when = fields.when_to_use.chars().count();
    let text_chars = if runtime == Runtime::ClaudeCode {
        // One space joins the two fields in the listing.
        let both = if when == 0 { desc } else { desc + 1 + when };
        both.min(CLAUDE_ENTRY_CAP)
    } else {
        desc
    };
    Entry {
        name: scan::safe(&fields.name, MAX_FIELD),
        name_chars: fields.name.chars().count(),
        text_chars,
    }
}

fn tokens(chars: usize) -> u64 {
    (chars as u64).div_ceil(CHARS_PER_TOKEN)
}

/// Skills that would lose their description, largest description first, until
/// the listing fits `budget_chars`; `None` when names alone do not fit.
fn drops(entries: &[Entry], budget_chars: usize) -> Option<Vec<&Entry>> {
    let mut total: usize = entries.iter().map(|e| e.name_chars + e.text_chars).sum();
    let names: usize = entries.iter().map(|e| e.name_chars).sum();
    if names > budget_chars {
        return None;
    }
    let mut order: Vec<&Entry> = entries.iter().collect();
    order.sort_by(|a, b| b.text_chars.cmp(&a.text_chars).then(a.name.cmp(&b.name)));
    let mut lost = Vec::new();
    for e in order {
        if total <= budget_chars {
            break;
        }
        total -= e.text_chars;
        lost.push(e);
    }
    Some(lost)
}

/// The note for one window, and whether the listing is over its budget.
fn window_note(
    entries: &[Entry],
    total: usize,
    label: &str,
    window: u64,
    pct: u64,
) -> (String, bool) {
    let budget_tokens = window * pct / 100;
    let budget_chars = (budget_tokens * CHARS_PER_TOKEN) as usize;
    if total <= budget_chars {
        return (format!("{label}: within {budget_tokens} tokens"), false);
    }
    let head = format!(
        "{label}: over the {budget_tokens}-token budget by ~{} tokens",
        tokens(total - budget_chars)
    );
    let tail = match drops(entries, budget_chars) {
        None => "; names alone exceed it, so skills themselves may be omitted".to_owned(),
        Some(lost) => {
            let names: Vec<String> = lost.iter().map(|e| e.name.clone()).collect();
            format!(
                "; {} would lose their description: {}",
                lost.len(),
                scan::sample(&names)
            )
        }
    };
    (head + &tail, true)
}

/// One row per installed runtime at each place.
pub fn checks(places: &[&Place], targets: &[Runtime]) -> Vec<Check> {
    let mut out = Vec::new();
    for place in places {
        for &runtime in targets {
            if installed(place, runtime).is_none() {
                continue;
            }
            let found = scan::dirs(&at(place, trees(runtime, place.scope.kind).skills));
            let entries: Vec<Entry> = found
                .entries
                .iter()
                .filter_map(|e| scan::skill_fields(&e.path.join("SKILL.md")))
                .map(|f| entry(runtime, &f))
                .collect();
            if entries.is_empty() {
                continue;
            }
            let name = format!("skill listing: {} ({})", runtime.name(), place.label());
            out.push(row(name, runtime, &entries, found.truncated));
        }
    }
    out
}

fn row(name: String, runtime: Runtime, entries: &[Entry], cut: bool) -> Check {
    let total: usize = entries.iter().map(|e| e.name_chars + e.text_chars).sum();
    let size = format!(
        "{} skills, {total} chars (~{} tokens est.)",
        entries.len(),
        tokens(total)
    );
    let cut = scan::truncation_note(cut);
    let Budget::Percent { pct, source } = budget(runtime) else {
        return Check::new(
            name,
            Status::Ok,
            format!("{size}; budget unknown: no figure is documented for this runtime{cut}"),
        );
    };
    let mut over = false;
    let notes: Vec<String> = WINDOWS
        .iter()
        .map(|(label, window)| {
            let (note, is_over) = window_note(entries, total, label, *window, pct);
            over |= is_over;
            note
        })
        .collect();
    let order = if over {
        "; drop order shown is largest description first because no usage data is read, \
         so the real set differs when the host drops by use"
    } else {
        ""
    };
    let detail = format!(
        "{size}; budget {pct}% of the window ({source}): {}{order}{cut}",
        notes.join(" | ")
    );
    Check::new(name, if over { Status::Warn } else { Status::Ok }, detail)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fields(name: &str, desc: usize, when: usize) -> scan::SkillFields {
        scan::SkillFields {
            name: name.into(),
            description: "d".repeat(desc),
            when_to_use: "w".repeat(when),
        }
    }

    #[test]
    fn only_claude_code_lists_when_to_use_separately_and_caps_the_pair() {
        let f = fields("a", 1000, 1000);
        assert_eq!(entry(Runtime::ClaudeCode, &f).text_chars, CLAUDE_ENTRY_CAP);
        assert_eq!(entry(Runtime::Codex, &f).text_chars, 1000);
        assert_eq!(
            entry(Runtime::ClaudeCode, &fields("a", 10, 5)).text_chars,
            16
        );
    }

    #[test]
    fn the_largest_descriptions_go_first_until_the_listing_fits() {
        let entries: Vec<Entry> = [("a", 100), ("b", 300), ("c", 200)]
            .iter()
            .map(|(n, d)| entry(Runtime::Codex, &fields(n, *d, 0)))
            .collect();
        // Total 603; 400 chars fits once "b" (300) is gone.
        let lost = drops(&entries, 400).expect("names fit");
        assert_eq!(
            lost.iter().map(|e| e.name.as_str()).collect::<Vec<_>>(),
            ["b"]
        );
        assert!(drops(&entries, 2).is_none(), "names alone exceed 2 chars");
    }

    #[test]
    fn a_runtime_with_no_documented_budget_is_unknown() {
        let entries = [entry(Runtime::Cursor, &fields("a", 10, 0))];
        let check = row("r".into(), Runtime::Cursor, &entries, false);
        assert_eq!(check.status, Status::Ok);
        assert!(check.detail.contains("budget unknown"));
    }

    #[test]
    fn an_over_budget_listing_warns_for_one_window_and_names_the_skills() {
        // 200K window at 1%: 2,000 tokens = 8,000 chars; 40 skills of 400 chars is over it,
        // and still within the 1M window's 10,000 tokens.
        let entries: Vec<Entry> = (0..40)
            .map(|i| entry(Runtime::ClaudeCode, &fields(&format!("s{i:02}"), 400, 0)))
            .collect();
        let check = row("r".into(), Runtime::ClaudeCode, &entries, false);
        assert_eq!(check.status, Status::Warn);
        let d = &check.detail;
        assert!(d.contains("200K: over the 2000-token budget"), "{d}");
        assert!(d.contains("1M: within 10000 tokens"), "{d}");
        assert!(d.contains("would lose their description"), "{d}");
        assert!(d.contains("largest description first"), "{d}");
    }
}
