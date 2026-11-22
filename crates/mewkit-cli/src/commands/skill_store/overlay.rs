//! `skill overlay <name>`: store the user's version of chosen kit files of a
//! skill outside the kit-owned tree, so upgrades keep it.
//!
//! Without `--file`, the files edited since install are the overlay. The skill
//! itself is not written: the files on disk already hold the user's version.
//! An overlay made here is approved here as it is made.
use std::collections::BTreeMap;

use mewkit_core::fsx::sha256_hex;
use mewkit_core::skill_store::{
    Overlay, OverlayFile, Sidecar, State, StoredFile, Write, apply, overlay_to_json, stored_copy,
};

use super::{Store, matching, open, overlay_approve};
use crate::commands::skill::SkillArgs;
use crate::failure::{Failure, OK};
use crate::place::Place;

pub fn run(place: &Place, args: &SkillArgs) -> Result<u8, Failure> {
    let name = args
        .skill
        .as_deref()
        .ok_or_else(|| Failure::usage("`mewkit skill overlay` needs a skill name"))?;
    if args.approve {
        return overlay_approve::run(place, name, args.yes);
    }
    let store = open(place)?;
    let (mut next, survey) = store.index(&store.checked())?;
    let keys = matching(&next, name)?;
    let mut overlays = store.overlays.clone();
    let mut approvals = store.approvals.clone();
    let mut writes = Vec::new();
    let mut removes = Vec::new();
    let mut done = Vec::new();
    for key in &keys {
        let record = &next.records[key];
        if record.unverified {
            return Err(Failure::failed(format!(
                "{key} is unverified (the ownership ledger changed without the skill store); \
                 `mewkit skill rollback {name}` settles it first"
            )));
        }
        if !matches!(record.state, State::Kit | State::Overlaid) {
            return Err(Failure::failed(format!(
                "{key} is {}: it is yours already, so edit it in place",
                record.state.label()
            )));
        }
        let seen = &survey[key];
        let chosen: Vec<String> = if args.file.is_empty() {
            seen.edited.clone()
        } else {
            args.file.clone()
        };
        if chosen.is_empty() {
            continue;
        }
        let on_disk: BTreeMap<&str, &str> = seen
            .files
            .iter()
            .map(|f| (f.path.as_str(), f.sha256.as_str()))
            .collect();
        let mut overlay = Overlay {
            name: record.name.clone(),
            files: BTreeMap::new(),
        };
        let mut view = BTreeMap::new();
        for path in &chosen {
            let kit_hash = seen.owned.get(path).ok_or_else(|| {
                Failure::usage(format!("{key}/{path} is not a file the kit installed"))
            })?;
            let rel = mewkit_core::fsx::RelPath::new(&format!("{key}/{path}"))?;
            let bytes = std::fs::read(store.layout.resolve(&rel))
                .map_err(|e| Failure::failed(format!("cannot read {rel}: {e}")))?;
            let sha = sha256_hex(&bytes);
            if on_disk.get(path.as_str()) != Some(&sha.as_str()) {
                return Err(Failure::failed(format!("{rel} changed while it was read")));
            }
            // A file overlaid before keeps its newest upstream hash as its base:
            // storing it again says the user has taken that upstream change in.
            let base = record
                .overlay
                .get(path)
                .map_or_else(|| kit_hash.clone(), |f| f.upstream.clone());
            writes.push(Write {
                path: stored_copy(&store.paths.overlays, key, path)?,
                bytes,
                mode: None,
            });
            view.insert(
                path.clone(),
                OverlayFile {
                    base: base.clone(),
                    upstream: base.clone(),
                    projected: sha.clone(),
                },
            );
            overlay
                .files
                .insert(path.clone(), StoredFile { sha256: sha, base });
        }
        if let Some(old) = overlays.overlays.get(key) {
            for path in old.files.keys().filter(|p| !overlay.files.contains_key(*p)) {
                removes.push(stored_copy(&store.paths.overlays, key, path)?);
            }
        }
        approvals.approved.insert(key.clone(), overlay.identity());
        overlays.overlays.insert(key.clone(), overlay);
        let entry = next.records.get_mut(key).expect("matched");
        entry.state = State::Overlaid;
        entry.overlay = view;
        done.push((key.clone(), chosen));
    }
    if done.is_empty() {
        return Err(Failure::failed(format!(
            "nothing to overlay: no file of {name} differs from the kit; edit one first or \
             name it with --file"
        )));
    }
    commit(&store, &next, &overlays, &approvals, writes, removes)?;
    for (key, files) in &done {
        println!(
            "overlaid {key}: {} (stored in {})",
            files.join(", "),
            store.paths.overlays
        );
    }
    Ok(OK)
}

/// Write the stored copies, the overlay store, this machine's approvals and
/// the sidecar as one change.
fn commit(
    store: &Store,
    next: &Sidecar,
    overlays: &mewkit_core::skill_store::OverlayStore,
    approvals: &mewkit_core::skill_store::Approvals,
    mut writes: Vec<Write>,
    mut removes: Vec<mewkit_core::fsx::RelPath>,
) -> Result<(), Failure> {
    let manifest = store.overlay_manifest();
    let approved = store.approvals_file();
    writes.push(Write {
        path: manifest.clone(),
        bytes: overlay_to_json(overlays),
        mode: None,
    });
    writes.push(Write {
        path: approved.clone(),
        bytes: overlay_to_json(approvals),
        mode: None,
    });
    let (sidecar_writes, sidecar_removes) = store.sidecar_change(next);
    writes.extend(sidecar_writes);
    removes.extend(sidecar_removes);
    let backed: Vec<&mewkit_core::fsx::RelPath> = writes
        .iter()
        .map(|w| &w.path)
        .chain(removes.iter())
        .collect();
    apply(&store.layout, &store.paths, &writes, &removes, &backed)?;
    Ok(())
}
