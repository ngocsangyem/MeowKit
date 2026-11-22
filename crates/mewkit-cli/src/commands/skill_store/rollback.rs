//! `skill rollback <name> [--to <digest>]`: put a skill's files back as they
//! were at a digest its record remembers.
//!
//! Without `--to`, the most recent earlier digest. `--to` takes any digest in
//! the history, or the one on disk now (which restores nothing and settles an
//! `unverified` skill as it is), by a unique prefix. The files come from the
//! tree kept for that digest; every write goes through the backup and the
//! journal, so a failure part way puts the skill back as it was. A rollback
//! that leaves every overlaid file as the kit installed it withdraws this
//! machine's approval of the overlay: the stored copy stays, inert, until
//! `skill overlay --approve` places it again.
use std::collections::BTreeMap;

use mewkit_core::fsx::RelPath;
use mewkit_core::skill_store::{SkillRecord, Write, apply, load_tree, overlay_to_json, tree_file};

use super::{matching, open, short};
use crate::failure::{Failure, OK};
use crate::place::Place;

/// The shortest digest prefix `--to` accepts.
const MIN_PREFIX: usize = 7;

pub fn run(place: &Place, name: Option<&str>, to: Option<&str>) -> Result<u8, Failure> {
    let name = name.ok_or_else(|| Failure::usage("`mewkit skill rollback` needs a skill name"))?;
    let store = open(place)?;
    let (current, survey) = store.index(&store.checked())?;
    let keys = matching(&current, name)?;
    let (key, target) = choose(&keys, &current.records, to)?;
    let record = &current.records[&key];
    let seen = &survey[&key];
    let mut next = current.clone();
    let entry = next.records.get_mut(&key).expect("matched");
    entry.unverified = false;
    if target == record.digest {
        let (indexed, survey) = store.index(&next)?;
        store.save(&indexed, &survey)?;
        println!("{key} is already at {}; kept as it is", short(&target));
        return Ok(OK);
    }
    let file = store.layout.resolve(&tree_file(&store.paths.dir, &target));
    let files = load_tree(&file, &target)?.ok_or_else(|| {
        Failure::failed(format!(
            "the files of {key} at {} are not kept on this machine",
            short(&target)
        ))
    })?;
    let mut writes = Vec::new();
    let mut restored: BTreeMap<&str, String> = BTreeMap::new();
    for f in &files {
        let same = seen
            .files
            .iter()
            .any(|d| d.path == f.path && d.exec == f.exec && d.sha256 == sha(&f.bytes));
        restored.insert(f.path.as_str(), sha(&f.bytes));
        if !same {
            writes.push(Write {
                path: RelPath::new(&format!("{key}/{}", f.path))?,
                bytes: f.bytes.clone(),
                mode: f.exec.then_some(0o755),
            });
        }
    }
    let mut removes = Vec::new();
    for d in seen
        .files
        .iter()
        .filter(|d| !restored.contains_key(d.path.as_str()))
    {
        removes.push(RelPath::new(&format!("{key}/{}", d.path))?);
    }
    let mut backed: Vec<RelPath> = writes.iter().map(|w| w.path.clone()).collect();
    backed.extend(removes.iter().cloned());
    let back_to_kit = !record.overlay.is_empty()
        && record
            .overlay
            .keys()
            .all(|p| restored.get(p.as_str()) == seen.owned.get(p));
    if back_to_kit {
        let mut approvals = store.approvals.clone();
        approvals.approved.remove(&key);
        writes.push(Write {
            path: store.approvals_file(),
            bytes: overlay_to_json(&approvals),
            mode: None,
        });
        backed.push(store.approvals_file());
    }
    let backed: Vec<&RelPath> = backed.iter().collect();
    let backup = apply(&store.layout, &store.paths, &writes, &removes, &backed)?;
    let store = open(place)?;
    let (indexed, survey) = store.index(&next)?;
    store.save(&indexed, &survey)?;
    println!("rolled back {key} to {}", short(&target));
    if back_to_kit {
        println!(
            "  the overlay is no longer applied here; `mewkit skill overlay {name} --approve` places it again"
        );
    }
    if let Some(dir) = backup {
        println!("  backup: {}", dir.display());
    }
    Ok(OK)
}

/// The skill and the digest to restore.
fn choose(
    keys: &[String],
    records: &BTreeMap<String, SkillRecord>,
    to: Option<&str>,
) -> Result<(String, String), Failure> {
    let Some(prefix) = to else {
        let [key] = keys else {
            return Err(Failure::usage(format!(
                "{} skills match; name one: {}",
                keys.len(),
                keys.join(", ")
            )));
        };
        let last = records[key].history.last().ok_or_else(|| {
            Failure::failed(format!("{key} has no earlier digest to roll back to"))
        })?;
        return Ok((key.clone(), last.clone()));
    };
    if prefix.len() < MIN_PREFIX {
        return Err(Failure::usage(format!(
            "--to needs at least {MIN_PREFIX} hex digits of a digest"
        )));
    }
    let mut found = Vec::new();
    for key in keys {
        let r = &records[key];
        for digest in r.history.iter().chain(std::iter::once(&r.digest)) {
            if digest.starts_with(prefix) && !found.contains(&(key, digest)) {
                found.push((key, digest));
            }
        }
    }
    match found.as_slice() {
        [(key, digest)] => Ok(((*key).clone(), (*digest).clone())),
        [] => Err(Failure::failed(format!(
            "no recorded digest starts with {prefix}; `mewkit skill status --json` lists each \
             skill's history"
        ))),
        _ => Err(Failure::usage(format!(
            "{prefix} names more than one recorded digest; give more digits"
        ))),
    }
}

fn sha(bytes: &[u8]) -> String {
    mewkit_core::fsx::sha256_hex(bytes)
}
