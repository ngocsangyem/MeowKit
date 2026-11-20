//! What an installed runtime loads from more than one place in this project.
//!
//! The surface table says which roots each runtime reads; the ownership
//! indexes say which entries under them the kit installed; the disk says what
//! is there now. Put together they answer two questions. A kit skill, agent
//! or hook set that two installs here both wrote and one runtime reads twice
//! is a known cost of that pair of runtimes: a warning, with the setting that
//! stops it where the vendor documents one. A copy of a kit skill or agent
//! that no install here recorded, under a second root a runtime reads, is a
//! leftover: it loads beside the installed one and no upgrade or uninstall
//! will ever touch it, so that row fails.
use std::collections::BTreeSet;

use mewkit_adapters::ScopeKind;
use mewkit_adapters::contract::Runtime;

use super::coexistence::installed;
use super::coexistence_scan as scan;
use super::overlap_survey::{Found, Owned, survey};
use super::{Check, Status};
use crate::place::Place;

const CROSS: &str = "coexistence: cross-runtime load";
const STRAY: &str = "kit copies: unrecorded";

/// Every installed runtime among `targets`, with what it loads twice here.
fn surveys(places: &[&Place], targets: &[Runtime]) -> Vec<(Runtime, Found)> {
    let Some(place) = places.iter().find(|p| p.scope.kind == ScopeKind::Project) else {
        return Vec::new();
    };
    let owned = Owned::at(place);
    targets
        .iter()
        .filter(|r| installed(place, **r).is_some())
        .map(|r| (*r, survey(place, *r, &owned)))
        .collect()
}

/// The warning row and the failing row, in that order.
pub fn checks(places: &[&Place], targets: &[Runtime]) -> [Check; 2] {
    let found = surveys(places, targets);
    let lines = |pick: fn(&Found) -> &Vec<String>| -> Vec<String> {
        found
            .iter()
            .filter(|(_, f)| !pick(f).is_empty())
            .map(|(r, f)| format!("{}: {}", r.name(), pick(f).join(", ")))
            .collect()
    };
    let cap = scan::truncation_note(found.iter().any(|(_, f)| f.truncated));
    let (doubles, maybe, same) = (
        lines(|f| &f.doubles),
        lines(|f| &f.maybe),
        lines(|f| &f.same_name),
    );
    let mut notes = String::new();
    if !maybe.is_empty() {
        notes += &format!(
            "; may load twice, the vendor does not settle whether the root is read — {}",
            maybe.join("; ")
        );
    }
    if !same.is_empty() {
        notes += &format!(
            "; one name under two roots, not installed by the kit — {}",
            same.join("; ")
        );
    }
    let cross = if doubles.is_empty() {
        Check::new(
            CROSS,
            Status::Ok,
            format!(
                "no installed runtime loads the kit's skills, agents or hooks from two roots in this project{notes}{cap}"
            ),
        )
    } else {
        Check::new(
            CROSS,
            Status::Warn,
            format!(
                "the kit loads twice where one runtime also reads another's tree — {}; \
                 every matching hook runs once per copy{notes}{cap}",
                doubles.join("; ")
            ),
        )
    };
    let strays: Vec<String> = found
        .iter()
        .flat_map(|(_, f)| f.strays.iter().cloned())
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect();
    let stray = if strays.is_empty() {
        Check::new(
            STRAY,
            Status::Ok,
            format!(
                "every kit skill and agent found under a root an installed runtime reads is one an install here recorded{cap}"
            ),
        )
    } else {
        Check::new(
            STRAY,
            Status::Fail,
            format!(
                "recorded by no install here, yet under a second root an installed runtime reads, so each loads \
                 beside the installed one and no upgrade or uninstall removes it: {}; delete what is listed",
                scan::sample(&strays)
            ),
        )
    };
    [cross, stray]
}
