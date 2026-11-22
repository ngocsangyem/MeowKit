//! What `init`, `upgrade`, `uninstall` and `pack` do with the skill store
//! around the run that changes a ledger.
//!
//! Before: the sidecar is read and every record whose ledger rows changed
//! under it is marked `unverified` (an older binary ran). Then each plan
//! loses the ops that would overwrite or remove a skill that is the user's
//! (see [`mewkit_core::skill_store::keep`]). After: the store is
//! indexed again against that, so the rows this run changed are recorded as
//! its own and are not mistaken for another binary's next time. A store that
//! cannot be read is left alone: the run goes ahead as an older binary's would.
use mewkit_adapters::contract::{OwnershipIndex, Plan};
use mewkit_core::skill_store::{self, Sidecar, skill_key_of};

use crate::place::Place;

/// The sidecar as this run found it, checked against the ledgers; `None` when
/// it cannot be read (the run then leaves it untouched).
pub fn before(place: &Place) -> Option<Sidecar> {
    match super::open(place) {
        Ok(store) => Some(store.checked()),
        Err(e) => {
            eprintln!(
                "note: the skill store was not read, so it is not updated: {}",
                e.message
            );
            None
        }
    }
}

/// Take out of `plan` every op that would overwrite or remove a skill the
/// store records as the user's, and return what was kept, with why, for the
/// report. A removal that is dropped lets the path go from `index`: the file
/// stays and is the user's from now on.
pub fn keep(
    store: Option<&mut Sidecar>,
    plan: &mut Plan,
    index: &mut OwnershipIndex,
) -> Vec<(String, String)> {
    let Some(store) = store else {
        return Vec::new();
    };
    let kept = skill_store::keep::keep(store, &mut plan.ops);
    for path in &kept.disowned {
        index.paths.remove(path);
        let record = skill_key_of(path).and_then(|key| store.records.get_mut(key));
        if let Some(record) = record {
            record.user_created = true;
        }
    }
    for (key, file, hash) in kept.upstream {
        let entry = store
            .records
            .get_mut(&key)
            .and_then(|r| r.overlay.get_mut(&file));
        if let Some(entry) = entry {
            entry.upstream = hash;
        }
    }
    kept.kept
}

/// Index the store again after the run, carrying what `before` found.
pub fn after(place: &Place, before: Option<&Sidecar>) {
    let Some(prior) = before else {
        return;
    };
    let result = super::open(place).and_then(|store| {
        let (next, _) = store.index(prior)?;
        store.save(&next)
    });
    if let Err(e) = result {
        eprintln!("note: the skill store was not updated: {}", e.message);
    }
}
