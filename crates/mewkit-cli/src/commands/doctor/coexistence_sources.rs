//! The two rows about what a host reads before anyone asks it to: the
//! instruction files it loads at launch, and the skill listing it spends a
//! shared budget on.
//!
//! Neither is about correctness. Both are about a resource two toolkits divide
//! between them. A second always-on instruction file is more standing text in
//! every session, and neither file overrides the other — they are simply both
//! read. A second toolkit's skills sit in the same listing as this kit's, and
//! when the listing is long the model sees fewer of either. So these rows print
//! raw numbers rather than a verdict: the numbers are the thing a reader needs.
use mewkit_adapters::ScopeKind;
use mewkit_adapters::contract::{OwnershipIndex, Runtime};

use super::coexistence::{at, installed, trees};
use super::coexistence_scan as scan;
use super::{Check, Status};
use crate::place::Place;

const INSTRUCTIONS: &str = "coexistence: instruction files";
const LISTING: &str = "coexistence: skill listing";

/// Characters of skill names and descriptions above which the row warns.
///
/// No host documents the size of its listing, so the figure is not derived from
/// one. It is set where this kit's own listing for a single runtime sits below
/// it and a second source pushes it over, which is the pressure the row exists
/// to report; and it is round, because a precise number would imply a precision
/// nobody has published. The row prints every component either way, so a reader
/// with a larger or smaller context window can judge against their own.
const LISTING_BUDGET: usize = 30_000;

/// Every always-on instruction source at the scopes read that this install did
/// not write, with its size, plus any rule file whose name appears at both
/// scopes — where both copies load and neither overrides the other.
pub fn instruction_files(places: &[&Place], targets: &[Runtime]) -> Check {
    let mut sources: Vec<String> = Vec::new();
    let mut bytes = 0u64;
    let mut both_scopes: Vec<String> = Vec::new();
    let mut cut = false;
    for &runtime in targets {
        let mut rule_names: Vec<Vec<String>> = Vec::new();
        for place in places {
            let tree = trees(runtime, place.scope.kind);
            let index = installed(place, runtime);
            // Only the user-level file counts as a second source. A project's
            // own instruction file is the baseline every row here is measured
            // against, whoever wrote it.
            if place.scope.kind == ScopeKind::Global
                && !tree.instructions.is_empty()
                && let Some(size) = foreign_file(place, tree.instructions, index.as_ref())
            {
                bytes += size;
                sources.push(format!(
                    "{} {} ({})",
                    place.label(),
                    tree.instructions,
                    scan::kb(size)
                ));
            }
            let rules = scan::files(&at(place, tree.rules));
            cut |= rules.truncated;
            rule_names.push(rules.entries.iter().map(scan::Entry::file_name).collect());
            let (count, size) = rules
                .entries
                .iter()
                .filter(|e| !owns(index.as_ref(), &format!("{}/{}", tree.rules, e.file_name())))
                .fold((0usize, 0u64), |(n, b), e| (n + 1, b + e.bytes));
            if count > 0 {
                bytes += size;
                sources.push(format!(
                    "{count} rule {} in {} {} ({})",
                    if count == 1 { "file" } else { "files" },
                    place.label(),
                    tree.rules,
                    scan::kb(size)
                ));
            }
        }
        let [here, there, ..] = rule_names.as_slice() else {
            continue;
        };
        both_scopes.extend(here.iter().filter(|n| there.contains(n)).cloned());
    }
    let cap = scan::truncation_note(cut);
    if sources.is_empty() && both_scopes.is_empty() {
        return Check::new(
            INSTRUCTIONS,
            Status::Ok,
            format!("no always-on instruction source beyond the ones this install wrote{cap}"),
        );
    }
    let mut parts = Vec::new();
    if !sources.is_empty() {
        parts.push(format!(
            "also read in every session: {} — {} in all",
            sources.join(", "),
            scan::kb(bytes)
        ));
    }
    if !both_scopes.is_empty() {
        both_scopes.sort_unstable();
        both_scopes.dedup();
        parts.push(format!(
            "the same rule file name at both scopes ({}), where both copies load and neither \
             overrides the other",
            scan::sample(&both_scopes)
        ));
    }
    Check::new(INSTRUCTIONS, Status::Warn, parts.join("; "))
}

/// How many skills each source offers and what their names and descriptions
/// cost, against the listing every installed toolkit draws on.
pub fn skill_listing(places: &[&Place], targets: &[Runtime]) -> Check {
    let mut per_source: Vec<String> = Vec::new();
    let (mut skills, mut chars, mut unread) = (0usize, 0usize, 0usize);
    let mut cut = false;
    for place in places {
        for &runtime in targets {
            let tree = trees(runtime, place.scope.kind);
            let found = scan::dirs(&at(place, tree.skills));
            cut |= found.truncated;
            if found.entries.is_empty() {
                continue;
            }
            let mut cost = 0usize;
            for entry in &found.entries {
                match scan::listing_cost(&entry.path.join("SKILL.md")) {
                    Some(c) => cost += c,
                    None => unread += 1,
                }
            }
            skills += found.len();
            chars += cost;
            per_source.push(format!(
                "{} {}: {} skill{}, {cost} chars",
                place.label(),
                tree.skills,
                found.len(),
                if found.len() == 1 { "" } else { "s" }
            ));
        }
    }
    let unread_note = if unread == 0 {
        String::new()
    } else {
        format!("; {unread} with no frontmatter block this read could reach")
    };
    let sources = if per_source.is_empty() {
        String::new()
    } else {
        format!(" — {}", per_source.join("; "))
    };
    let detail = format!(
        "{skills} skills offering {chars} characters of name and description to the listing every \
         installed toolkit shares{sources}{unread_note}{}",
        scan::truncation_note(cut)
    );
    if chars > LISTING_BUDGET {
        return Check::new(
            LISTING,
            Status::Warn,
            format!(
                "{detail}; above {LISTING_BUDGET} characters a host may drop descriptions, and \
                 which ones it drops is not yours to choose — disable the packs you do not use"
            ),
        );
    }
    Check::new(LISTING, Status::Ok, detail)
}

/// `rel`'s size at `place` when the file is there and this install did not
/// write it; `None` otherwise. A symlink is not followed: the row reports what
/// a host reads in the directory it was pointed at.
fn foreign_file(place: &Place, rel: &str, index: Option<&OwnershipIndex>) -> Option<u64> {
    if owns(index, rel) {
        return None;
    }
    let meta = std::fs::symlink_metadata(at(place, rel)).ok()?;
    meta.is_file().then_some(meta.len())
}

fn owns(index: Option<&OwnershipIndex>, rel: &str) -> bool {
    index.is_some_and(|i| i.paths.contains_key(rel))
}
