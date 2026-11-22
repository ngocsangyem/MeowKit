//! What install, upgrade and uninstall keep: the ops a plan may not apply to
//! a skill the store records as the user's.
//!
//! A forked, local or unverified skill is left whole: no op writes or removes
//! anything in it. An overlaid skill takes the kit's new files except the
//! overlaid ones, and is never retired or uninstalled. `--force` does not
//! change any of this. The reasons below are reported as "kept"; none of them
//! names `--force`, so a kept skill does not by itself set the exit code that
//! says an edit was kept.
use std::collections::BTreeSet;

use super::record::{Sidecar, SkillRecord, State};
use super::rows::skill_key_of;
use crate::fsx::sha256_hex;
use crate::plan::Op;

pub const UNVERIFIED: &str = "unverified: the ownership ledger changed without the skill store \
     (another mewkit ran), so the skill stays as it is; see `mewkit skill status`";
pub const FORKED: &str = "forked: a skill under a user-owned name";
pub const LOCAL: &str = "local: a skill mewkit did not install";
pub const OVERLAID_SKILL: &str = "overlaid: the skill stays with your overlay";
pub const OVERLAID_FILE: &str = "overlaid: your version stays";
pub const OVERLAID_DRIFT: &str =
    "overlaid: your version stays; the kit changed this file since the overlay (drift)";

/// What [`keep`] took out of a plan.
#[derive(Debug, Default)]
pub struct Kept {
    /// (path or skill directory, reason), once each.
    pub kept: Vec<(String, String)>,
    /// Paths whose removal was dropped: they leave the ledger, the files stay.
    pub disowned: Vec<String>,
    /// (skill, file, hash) of the kit's bytes for each overlaid file.
    pub upstream: Vec<(String, String, String)>,
}

/// Why a whole skill is kept, if it is.
fn whole(record: &SkillRecord) -> Option<&'static str> {
    if record.unverified {
        Some(UNVERIFIED)
    } else if record.state == State::Forked {
        Some(FORKED)
    } else if record.state == State::Local && record.user_created {
        Some(LOCAL)
    } else {
        None
    }
}

/// Take out of `ops` every op that would overwrite or remove what `store`
/// records as the user's.
pub fn keep(store: &Sidecar, ops: &mut Vec<Op>) -> Kept {
    let mut out = Kept::default();
    let mut reported: BTreeSet<String> = BTreeSet::new();
    let mut report = |out: &mut Kept, path: &str, why: &str| {
        if reported.insert(path.to_owned()) {
            out.kept.push((path.to_owned(), why.to_owned()));
        }
    };
    ops.retain(|op| {
        let (path, written) = match op {
            Op::WriteFile { path, bytes, .. } => (path.as_str(), Some(bytes)),
            Op::RemoveFile { path } => (path.as_str(), None),
            _ => return true,
        };
        let Some(key) = skill_key_of(path) else {
            return true;
        };
        let Some(record) = store.records.get(key) else {
            return true;
        };
        let overlaid = record.state == State::Overlaid && !record.overlay.is_empty();
        if let Some(why) = whole(record) {
            report(&mut out, key, why);
        } else if overlaid && written.is_none() {
            report(&mut out, key, OVERLAID_SKILL);
        } else if let (true, Some(bytes)) = (overlaid, written) {
            let inside = &path[key.len() + 1..];
            let Some(file) = record.overlay.get(inside) else {
                return true;
            };
            let hash = sha256_hex(bytes);
            let why = if hash == file.base {
                OVERLAID_FILE
            } else {
                OVERLAID_DRIFT
            };
            out.upstream.push((key.to_owned(), inside.to_owned(), hash));
            report(&mut out, path, why);
            return false;
        } else {
            return true;
        }
        if written.is_none() {
            out.disowned.push(path.to_owned());
        }
        false
    });
    out
}
