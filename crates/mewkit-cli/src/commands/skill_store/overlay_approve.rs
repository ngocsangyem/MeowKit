//! `skill overlay <name> --approve`: show an overlay this machine has not
//! approved, and on a yes, place it in the skill and record the approval.
//!
//! An overlay that reached this project another way (a clone, a copied
//! directory) changes nothing until this runs here: the stored copies are
//! checked against their record, every file must be one the kit installed in
//! that skill, and the diff against what is installed is printed first.
use mewkit_core::fsx::{RelPath, sha256_hex};
use mewkit_core::skill_store::{State, Write, apply, overlay_files, overlay_to_json, stored_copy};

use super::diff;
use super::{matching, open};
use crate::failure::{Failure, OK};
use crate::place::Place;
use crate::prompt::{Ask, Flag, PromptError, default_prompt};

pub fn run(place: &Place, name: &str, yes: bool) -> Result<u8, Failure> {
    let store = open(place)?;
    let (prior, survey) = store.index(&store.checked())?;
    let keys = matching(&prior, name)?;
    let pending = store.overlays.pending(&store.approvals);
    let waiting: Vec<&String> = keys.iter().filter(|k| pending.contains(*k)).collect();
    if waiting.is_empty() {
        println!("no overlay of {name} is waiting for approval here");
        return Ok(OK);
    }
    let mut writes = Vec::new();
    let mut backed = Vec::new();
    let mut approvals = store.approvals.clone();
    let mut next = prior.clone();
    for key in waiting {
        let overlay = &store.overlays.overlays[key];
        let record = &prior.records[key];
        if !matches!(record.state, State::Kit | State::Overlaid) || record.unverified {
            return Err(Failure::failed(format!(
                "{key} is {}, so an overlay cannot be placed in it",
                if record.unverified {
                    "unverified"
                } else {
                    record.state.label()
                }
            )));
        }
        println!("overlay of {key} ({} file(s)):", overlay.files.len());
        for (path, stored) in &overlay.files {
            if !survey[key].owned.contains_key(path) {
                return Err(Failure::failed(format!(
                    "{key}/{path} is not a file the kit installed; the overlay is refused"
                )));
            }
            let copy = stored_copy(&store.paths.overlays, key, path)?;
            let bytes = std::fs::read(store.layout.resolve(&copy))
                .map_err(|e| Failure::failed(format!("cannot read {copy}: {e}")))?;
            if sha256_hex(&bytes) != stored.sha256 {
                return Err(Failure::failed(format!(
                    "{copy} does not match its record; the overlay is refused"
                )));
            }
            let target = RelPath::new(&format!("{key}/{path}"))?;
            let installed = std::fs::read(store.layout.resolve(&target)).unwrap_or_default();
            println!("--- {target} (installed)\n+++ {target} (overlay)");
            for line in diff::render(
                &String::from_utf8_lossy(&installed),
                &String::from_utf8_lossy(&bytes),
            ) {
                println!("{line}");
            }
            let exec = survey[key].files.iter().any(|f| f.path == *path && f.exec);
            writes.push(Write {
                path: target,
                bytes,
                mode: exec.then_some(0o755),
            });
        }
        approvals.approved.insert(key.clone(), overlay.identity());
        let entry = next.records.get_mut(key).expect("matched");
        entry.state = State::Overlaid;
        entry.overlay = overlay_files(None, overlay);
        // The kit installed here is the newest upstream this machine has seen.
        for (path, file) in &mut entry.overlay {
            if let Some(kit) = survey[key].owned.get(path) {
                file.upstream.clone_from(kit);
            }
        }
    }
    if !yes && !confirmed("Place this overlay in the skill and approve it on this machine?")? {
        println!("Nothing was changed.");
        return Ok(OK);
    }
    backed.extend(writes.iter().map(|w| w.path.clone()));
    writes.push(Write {
        path: store.approvals_file(),
        bytes: overlay_to_json(&approvals),
        mode: None,
    });
    backed.push(store.approvals_file());
    let backed_refs: Vec<&RelPath> = backed.iter().collect();
    let backup = apply(&store.layout, &store.paths, &writes, &[], &backed_refs)?;
    // Index again so the record carries the placed tree's digest.
    let store = open(place)?;
    let (indexed, _) = store.index(&next)?;
    store.save(&indexed)?;
    println!("approved and placed the overlay of {name}");
    if let Some(dir) = backup {
        println!("backup: {}", dir.display());
    }
    Ok(OK)
}

/// Ask before placing. No terminal means `--yes` is the only way to say so.
fn confirmed(message: &str) -> Result<bool, Failure> {
    match default_prompt().confirm(&Ask::new(message, Flag::new("--yes")), false) {
        Ok(answer) => Ok(answer),
        Err(PromptError::Cancelled { .. }) => Ok(false),
        Err(other) => Err(other.into()),
    }
}
