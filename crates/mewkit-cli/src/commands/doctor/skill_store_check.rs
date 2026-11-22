//! The `skill store` row: does the store still agree with the ownership
//! ledgers it was built from?
//!
//! A record whose ledger rows changed under it was left by another binary
//! (an older mewkit that does not know the store); a skill the ledgers own
//! that has no record was installed by one. Either is `warn`: nothing is
//! broken, and `mewkit skill status` says what to do. An overlay waiting for
//! this machine's approval is reported the same way. Reads only.
use mewkit_core::skill_store::ledger_rows;

use super::{Check, Status};
use crate::commands::skill_store::open;
use crate::place::Place;

const NAME: &str = "skill store";

pub fn check(places: &[&Place]) -> Check {
    let mut findings = Vec::new();
    let mut recorded = 0usize;
    for place in places {
        let store = match open(place) {
            Ok(store) => store,
            Err(e) => {
                findings.push(format!("{}: {}", place.label(), e.message));
                continue;
            }
        };
        if store.sidecar.records.is_empty() {
            continue;
        }
        recorded += store.sidecar.records.len();
        let checked = store.checked();
        let unverified: Vec<&String> = checked
            .records
            .iter()
            .filter(|(_, r)| r.unverified)
            .map(|(k, _)| k)
            .collect();
        let unindexed: Vec<String> = ledger_rows(&store.ledgers)
            .into_keys()
            .filter(|k| !checked.records.contains_key(k))
            .collect();
        let pending = store.overlays.pending(&store.approvals);
        let label = place.label();
        if !unverified.is_empty() {
            findings.push(format!(
                "{label}: {} unverified (the ledger changed without the store): {}",
                unverified.len(),
                list(unverified.iter().map(|k| k.as_str()))
            ));
        }
        if !unindexed.is_empty() {
            findings.push(format!(
                "{label}: {} installed skill(s) not recorded: {}",
                unindexed.len(),
                list(unindexed.iter().map(String::as_str))
            ));
        }
        if !pending.is_empty() {
            findings.push(format!(
                "{label}: overlay(s) waiting for approval here: {}",
                list(pending.iter().map(String::as_str))
            ));
        }
    }
    if findings.is_empty() {
        let detail = if recorded == 0 {
            "not built yet; `mewkit skill status` builds it".to_owned()
        } else {
            format!("{recorded} skill(s) recorded, in step with the ownership ledgers")
        };
        return Check::new(NAME, Status::Ok, detail);
    }
    Check::new(
        NAME,
        Status::Warn,
        format!("{}; `mewkit skill status` explains", findings.join("; ")),
    )
}

/// Up to five names, then a count of the rest.
fn list<'a>(names: impl Iterator<Item = &'a str>) -> String {
    let names: Vec<&str> = names.collect();
    let shown = names.iter().take(5).copied().collect::<Vec<_>>().join(", ");
    match names.len().saturating_sub(5) {
        0 => shown,
        rest => format!("{shown} and {rest} more"),
    }
}
