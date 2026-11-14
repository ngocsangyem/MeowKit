//! What the install says about its packs.
use mewkit_adapters::contract::{OwnershipIndex, Runtime};
use mewkit_core::validate::{BASE_PACK, PackManifest};

use crate::place::Place;

pub struct Installed {
    pub index: Option<OwnershipIndex>,
    /// Installed pack names, `base` first. No record of a selection means a
    /// full install, so every pack the manifest lists.
    pub packs: Vec<String>,
}

impl Installed {
    pub fn non_base(&self) -> Vec<String> {
        self.packs
            .iter()
            .filter(|p| *p != BASE_PACK)
            .cloned()
            .collect()
    }

    pub fn has(&self, pack: &str) -> bool {
        self.packs.iter().any(|p| p == pack)
    }
}

/// An index that names no pack records a full install; one that does records
/// a subset, with `base` written first as the marker that tells the two apart.
pub fn stored(next_non_base: &[String]) -> Vec<String> {
    let mut packs = vec![BASE_PACK.to_owned()];
    packs.extend(next_non_base.iter().cloned());
    packs
}

pub fn read(place: &Place, manifest: &PackManifest) -> Result<Installed, String> {
    let index = place.index(Runtime::ClaudeCode).map_err(|e| e.message)?;
    let mut packs = vec![BASE_PACK.to_owned()];
    match index.as_ref().filter(|i| !i.packs.is_empty()) {
        Some(i) => {
            for p in i.packs.iter().filter(|p| *p != BASE_PACK) {
                if !packs.contains(p) {
                    packs.push(p.clone());
                }
            }
        }
        None => packs.extend(manifest.available_packs().iter().map(|p| (*p).to_owned())),
    }
    Ok(Installed { index, packs })
}
