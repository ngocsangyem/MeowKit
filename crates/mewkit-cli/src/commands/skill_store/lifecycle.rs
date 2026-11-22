//! What `init`, `upgrade`, `uninstall` and `pack` do with the skill store
//! around the run that changes a ledger.
//!
//! Before: the sidecar is read and every record whose ledger rows changed
//! under it is marked `unverified` (an older binary ran). After: the store is
//! indexed again against that, so the rows this run changed are recorded as
//! its own and are not mistaken for another binary's next time. A store that
//! cannot be read is left alone: the run goes ahead as an older binary's would.
use mewkit_core::skill_store::Sidecar;

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
