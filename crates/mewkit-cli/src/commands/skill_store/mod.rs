//! The skill store on the command line: `skill status`, `overlay` and
//! `fork`, and what every lifecycle command does with the store around the
//! run that changes a ledger.
mod diff;
mod fork;
pub mod lifecycle;
mod overlay;
mod overlay_approve;
mod status;

use std::collections::BTreeMap;

use mewkit_adapters::contract::{OwnershipIndex, RelPath};
use mewkit_core::layout::Layout;
use mewkit_core::skill_store::{
    self, Approvals, Overlay, OverlayStore, Sidecar, State, StorePaths, Survey, Write,
};

use super::skill::SkillArgs;
use crate::failure::{Failure, USAGE};
use crate::place::Place;

/// The verbs this module answers, after `env`.
pub const VERBS: [&str; 3] = ["status", "overlay", "fork"];

pub fn run(sub: &str, args: &SkillArgs) -> Result<u8, Failure> {
    let place = Place::new(args.global)?;
    match sub {
        "status" => status::run(&place, args.json),
        "overlay" => overlay::run(&place, args),
        "fork" => fork::run(&place, args.skill.as_deref(), args.new_name.as_deref()),
        _ => Ok(USAGE),
    }
}

/// One scope's store, opened: its ledgers, its sidecar as last written, the
/// stored overlays and this machine's approvals.
pub struct Store {
    pub layout: Layout,
    pub paths: StorePaths,
    pub ledgers: Vec<(String, OwnershipIndex)>,
    pub sidecar: Sidecar,
    pub overlays: OverlayStore,
    pub approvals: Approvals,
    pub label: &'static str,
}

/// Read the ledgers, the sidecar and the overlays at `place`.
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
    let overlays = OverlayStore::load(&layout.resolve(&manifest_of(&paths)))?;
    let approvals = Approvals::load(&layout.resolve(&approvals_of(&paths)))?;
    Ok(Store {
        layout,
        paths,
        ledgers,
        sidecar,
        overlays,
        approvals,
        label: place.label(),
    })
}

fn manifest_of(paths: &StorePaths) -> RelPath {
    RelPath::new(&format!("{}/overlays.json", paths.overlays)).expect("static store path")
}

fn approvals_of(paths: &StorePaths) -> RelPath {
    RelPath::new(&format!("{}/approvals.json", paths.dir)).expect("static store path")
}

impl Store {
    pub fn overlay_manifest(&self) -> RelPath {
        manifest_of(&self.paths)
    }

    pub fn approvals_file(&self) -> RelPath {
        approvals_of(&self.paths)
    }

    /// The overlays this machine approved.
    pub fn active(&self) -> BTreeMap<String, Overlay> {
        self.overlays.active(&self.approvals)
    }

    /// Index what is installed now against `prior`.
    pub fn index(&self, prior: &Sidecar) -> Result<(Sidecar, Survey), Failure> {
        Ok(skill_store::build(
            &self.layout,
            &self.ledgers,
            prior,
            &self.active(),
        )?)
    }

    /// The sidecar as the user last saw it, with records whose ledger rows
    /// changed under it marked `unverified`, and each record's overlay as
    /// this machine's approvals make it: a committed sidecar cannot switch an
    /// overlay on that was never approved here.
    pub fn checked(&self) -> Sidecar {
        let mut out = skill_store::mark_unverified(&self.sidecar, &self.ledgers);
        let active = self.active();
        for (key, record) in &mut out.records {
            let kit = matches!(record.state, State::Kit | State::Overlaid);
            match active.get(key) {
                Some(overlay) if kit => {
                    record.overlay = skill_store::overlay_files(Some(record), overlay);
                    record.state = State::Overlaid;
                }
                _ if record.state == State::Overlaid => {
                    record.overlay.clear();
                    record.state = State::Kit;
                }
                _ => {}
            }
        }
        out
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

/// The skill directories `name` names: a directory itself
/// (`.claude/skills/fix`), or a skill name in every skills directory.
pub fn matching(records: &Sidecar, name: &str) -> Result<Vec<String>, Failure> {
    let keys: Vec<String> = records
        .records
        .iter()
        .filter(|(key, r)| {
            key.as_str() == name || r.name == name || key.rsplit('/').next() == Some(name)
        })
        .map(|(key, _)| key.clone())
        .collect();
    if keys.is_empty() {
        return Err(Failure::usage(format!(
            "no installed skill is named {name}; `mewkit skill status` lists them"
        )));
    }
    Ok(keys)
}

/// The first 12 hex digits of a digest, for display.
pub fn short(digest: &str) -> &str {
    &digest[..digest.len().min(12)]
}
