//! The skill store on the command line: `skill status` and the refresh every
//! lifecycle command runs after it changes a ledger.
pub mod lifecycle;
mod status;

use std::collections::BTreeSet;

use mewkit_adapters::contract::{OwnershipIndex, RelPath};
use mewkit_core::layout::Layout;
use mewkit_core::skill_store::{self, Sidecar, StorePaths, Survey, Write};

use super::skill::SkillArgs;
use crate::failure::{Failure, USAGE};
use crate::place::Place;

/// The verbs this module answers, after `env`.
pub const VERBS: [&str; 1] = ["status"];

pub fn run(sub: &str, args: &SkillArgs) -> Result<u8, Failure> {
    let place = Place::new(args.global)?;
    match sub {
        "status" => status::run(&place, args.json),
        _ => Ok(USAGE),
    }
}

/// One scope's store, opened: its ledgers and its sidecar as last written.
pub struct Store {
    pub layout: Layout,
    pub paths: StorePaths,
    pub ledgers: Vec<(String, OwnershipIndex)>,
    pub sidecar: Sidecar,
    pub label: &'static str,
}

/// Read the ledgers and the sidecar at `place`.
pub fn open(place: &Place) -> Result<Store, Failure> {
    let mut ledgers = Vec::new();
    for runtime in mewkit_adapters::registry::emitted() {
        if let Some(index) = place.index(runtime)? {
            ledgers.push((runtime.name().to_owned(), index));
        }
    }
    let layout = place.scope.layout();
    let paths = place.store_paths();
    let sidecar = Sidecar::load(&layout.resolve(&paths.sidecar))?;
    Ok(Store {
        layout,
        paths,
        ledgers,
        sidecar,
        label: place.label(),
    })
}

impl Store {
    /// Index what is installed now against `prior`.
    pub fn index(&self, prior: &Sidecar) -> Result<(Sidecar, Survey), Failure> {
        let overlaid = BTreeSet::new();
        Ok(skill_store::build(
            &self.layout,
            &self.ledgers,
            prior,
            &overlaid,
        )?)
    }

    /// The sidecar as the user last saw it, with records whose ledger rows
    /// changed under it marked `unverified`.
    pub fn checked(&self) -> Sidecar {
        skill_store::mark_unverified(&self.sidecar, &self.ledgers)
    }

    /// The write (or removal, for an empty store) that records `next`;
    /// nothing when the bytes on disk already say it.
    pub fn sidecar_change(&self, next: &Sidecar) -> (Vec<Write>, Vec<RelPath>) {
        let file = self.layout.resolve(&self.paths.sidecar);
        let on_disk = std::fs::read(&file).ok();
        if next.records.is_empty() {
            let removes = on_disk.map(|_| self.paths.sidecar.clone());
            return (Vec::new(), removes.into_iter().collect());
        }
        let bytes = next.to_json();
        if on_disk.as_deref() == Some(bytes.as_slice()) {
            return (Vec::new(), Vec::new());
        }
        let write = Write {
            path: self.paths.sidecar.clone(),
            bytes,
            mode: None,
        };
        (vec![write], Vec::new())
    }

    /// Record `next` as the sidecar.
    pub fn save(&self, next: &Sidecar) -> Result<(), Failure> {
        let (writes, removes) = self.sidecar_change(next);
        skill_store::apply(&self.layout, &self.paths, &writes, &removes, &[])?;
        Ok(())
    }
}

/// The first 12 hex digits of a digest, for display.
pub fn short(digest: &str) -> &str {
    &digest[..digest.len().min(12)]
}
