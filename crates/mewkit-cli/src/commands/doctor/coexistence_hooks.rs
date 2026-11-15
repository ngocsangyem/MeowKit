//! The `coexistence: foreign hooks` row.
//!
//! Hooks come from every source a host reads, all of them run, and a deny wins
//! — so another toolkit's hook cannot talk a MeowKit guard out of a refusal.
//! What it can do is act on the same events: add latency before a tool call,
//! add refusals of its own, or rewrite a file the guard has just approved. So
//! the row names them, by program only; `hook_lines` is what decides what may
//! be printed as a name.
use std::collections::BTreeSet;

use mewkit_adapters::contract::{OwnershipIndex, Runtime};

use super::coexistence::installed;
use super::coexistence_scan as scan;
use super::hook_commands::script_token;
use super::hook_lines::registrations;
use super::hooks;
use super::{Check, Status};
use crate::place::Place;

const NAME: &str = "coexistence: foreign hooks";

pub fn foreign(places: &[&Place], targets: &[Runtime]) -> Check {
    // Which events the kit uses is settled first, across every scope where it
    // is installed, because the file that carries a foreign hook need not be
    // the one the kit was installed into: a user-level settings file registers
    // hooks for a project that has no install at that scope, and the host runs
    // them all the same.
    let mut owned: BTreeSet<String> = BTreeSet::new();
    let mut ours: BTreeSet<(&str, String)> = BTreeSet::new();
    let mut unread: Vec<String> = Vec::new();
    for place in places {
        for &runtime in targets {
            let Some(index) = installed(place, runtime) else {
                continue;
            };
            let names = owned_names(&index);
            owned.extend(names.iter().cloned());
            let Some((_, doc)) = hooks::hook_doc(place, runtime) else {
                unread.push(format!("{} ({})", runtime.name(), place.label()));
                continue;
            };
            ours.extend(
                registrations(&doc)
                    .iter()
                    .filter(|r| r.owned_by(&names))
                    .map(|r| r.on(runtime)),
            );
        }
    }
    let mut found: Vec<String> = Vec::new();
    for place in places {
        for &runtime in targets {
            let Some((_, doc)) = hooks::hook_doc(place, runtime) else {
                continue;
            };
            found.extend(
                registrations(&doc)
                    .iter()
                    .filter(|r| ours.contains(&r.on(runtime)) && !r.owned_by(&owned))
                    .map(|r| r.shown(place.label())),
            );
        }
    }
    let note = if unread.is_empty() {
        String::new()
    } else {
        format!(
            "; no hook file to read for {} (`mewkit upgrade --force` registers them again)",
            unread.join(", ")
        )
    };
    if found.is_empty() {
        return Check::new(
            NAME,
            Status::Ok,
            format!(
                "no hook from another source on the {} events this install registers{note}",
                ours.len()
            ),
        );
    }
    found.sort_unstable();
    found.dedup();
    Check::new(
        NAME,
        Status::Warn,
        format!(
            "hooks this install does not own, on events it also uses — {}; program names only, \
             arguments not read. Every matching hook runs and a deny wins, so these cannot \
             override a MeowKit guard; they do run alongside it{note}",
            scan::sample(&found)
        ),
    )
}

/// The file names this install's hook scripts have. A registration naming one
/// of them is the kit's own at either scope, whatever the path in front of the
/// name looks like — a global install writes absolute paths, a project install
/// writes the project root's own spelling.
fn owned_names(index: &OwnershipIndex) -> BTreeSet<String> {
    index
        .paths
        .keys()
        .filter_map(|p| script_token(p))
        .map(|p| scan::base(&p))
        .collect()
}
