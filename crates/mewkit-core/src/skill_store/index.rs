//! Indexing: what is installed now, as records. Reads skill files, writes none.
use std::collections::{BTreeMap, BTreeSet};
use std::io;

use sha2::{Digest, Sha256};

use super::HISTORY_LIMIT;
use super::digest::{TreeFile, read_tree, tree_digest};
use super::record::{Sidecar, SkillRecord, State};
use crate::fsx::RelPath;
use crate::layout::Layout;
use crate::ownership::OwnershipIndex;

/// Every ledger at one scope, by runtime name.
pub type Ledgers = [(String, OwnershipIndex)];

/// What indexing saw in one skill directory.
#[derive(Clone, Debug, Default)]
pub struct Observed {
    pub files: Vec<TreeFile>,
    /// Ledger-owned files whose bytes differ from the recorded hash.
    pub edited: Vec<String>,
    /// Ledger-owned files that are gone.
    pub missing: Vec<String>,
    /// Ledger hash for each owned file, by path inside the skill.
    pub owned: BTreeMap<String, String>,
}

pub type Survey = BTreeMap<String, Observed>;

/// The skill directory a root-relative path lies in: everything up to and
/// including the directory after the first `skills` component that is not the
/// first component, when a file sits below it.
pub fn skill_key_of(path: &str) -> Option<&str> {
    let mut offset = 0;
    let mut parts = path.split('/').peekable();
    while let Some(part) = parts.next() {
        offset += part.len() + 1;
        if part == "skills" && offset > "skills/".len() {
            let dir = parts.next()?;
            parts.peek()?;
            return Some(&path[..offset + dir.len()]);
        }
    }
    None
}

/// The ledger rows under one skill directory, across runtimes.
#[derive(Clone, Debug, Default)]
pub struct Rows {
    pub runtimes: BTreeSet<String>,
    /// Hash per path inside the skill.
    pub files: BTreeMap<String, String>,
    /// Hash of every row (runtime, path, hash): what a record is built from.
    pub hash: String,
}

/// Every ledger row grouped by the skill directory it lies in.
pub fn ledger_rows(ledgers: &Ledgers) -> BTreeMap<String, Rows> {
    let mut hashers: BTreeMap<String, (Rows, Sha256)> = BTreeMap::new();
    for (runtime, index) in ledgers {
        for (path, hash) in &index.paths {
            let Some(key) = skill_key_of(path) else {
                continue;
            };
            let (rows, h) = hashers
                .entry(key.to_owned())
                .or_insert_with(|| (Rows::default(), Sha256::new()));
            rows.runtimes.insert(runtime.clone());
            rows.files
                .insert(path[key.len() + 1..].to_owned(), hash.clone());
            for part in [runtime.as_str(), path, hash] {
                h.update(part.as_bytes());
                h.update([0]);
            }
            h.update(b"\n");
        }
    }
    hashers
        .into_iter()
        .map(|(key, (mut rows, h))| {
            rows.hash = hex(&h.finalize());
            (key, rows)
        })
        .collect()
}

/// The hash a record carries when no ledger row lies under it.
pub fn no_rows_hash() -> String {
    hex(&Sha256::new().finalize())
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

/// `prior` with every record whose ledger rows changed since it was written
/// marked `unverified`: the ledgers were changed by something that did not
/// update the store (an older binary). Reads no skill file.
pub fn mark_unverified(prior: &Sidecar, ledgers: &Ledgers) -> Sidecar {
    let rows = ledger_rows(ledgers);
    let empty = no_rows_hash();
    let mut out = prior.clone();
    for (key, record) in &mut out.records {
        let now = rows.get(key).map_or(empty.as_str(), |r| r.hash.as_str());
        if record.ledger_hash != now {
            record.unverified = true;
        }
    }
    out
}

/// Index every skill directory the ledgers own, every other directory beside
/// them, and every directory `prior` records. A record's `unverified` flag is
/// carried from `prior` (see [`mark_unverified`]); `overlaid` names the
/// skills with an active overlay.
pub fn build(
    layout: &Layout,
    ledgers: &Ledgers,
    prior: &Sidecar,
    overlaid: &BTreeSet<String>,
) -> io::Result<(Sidecar, Survey)> {
    let mut owned = ledger_rows(ledgers);
    let mut keys: BTreeSet<String> = owned.keys().cloned().collect();
    keys.extend(prior.records.keys().cloned());
    let roots: BTreeSet<String> = keys
        .iter()
        .filter_map(|k| k.rsplit_once('/').map(|(root, _)| root.to_owned()))
        .collect();
    for root in &roots {
        keys.extend(child_dirs(layout, root)?);
    }

    let mut next = Sidecar::default();
    let mut survey = Survey::new();
    for key in keys {
        let Ok(rel) = RelPath::new(&key) else {
            continue;
        };
        let dir = layout.resolve(&rel);
        if !std::fs::symlink_metadata(&dir).is_ok_and(|m| m.is_dir()) {
            continue;
        }
        let files = read_tree(&dir)?;
        let before = prior.records.get(&key);
        let rows = owned.remove(&key).unwrap_or_default();
        let has_skill_md = files.iter().any(|f| f.path == "SKILL.md");
        if rows.files.is_empty() && before.is_none() && !has_skill_md {
            continue;
        }
        let seen = observe(files, &rows.files);
        let digest = tree_digest(&seen.files);
        let kit = !rows.files.is_empty();
        let pristine = kit
            && seen.edited.is_empty()
            && seen.missing.is_empty()
            && seen.files.len() == rows.files.len();
        let dir_name = key.rsplit('/').next().unwrap_or(&key).to_owned();
        let record = SkillRecord {
            name: match dir_name.strip_prefix("mk-") {
                Some(name) if kit => name.to_owned(),
                _ => dir_name.clone(),
            },
            state: if before.is_some_and(|b| b.state == State::Forked) {
                State::Forked
            } else if overlaid.contains(&key) && kit {
                State::Overlaid
            } else if kit {
                State::Kit
            } else {
                State::Local
            },
            owners: if kit {
                rows.runtimes.iter().cloned().collect()
            } else {
                vec!["user".to_owned()]
            },
            base: if pristine {
                Some(digest.clone())
            } else {
                before.and_then(|b| b.base.clone())
            },
            history: next_history(before, &digest),
            ledger_hash: if kit { rows.hash } else { no_rows_hash() },
            unverified: before.is_some_and(|b| b.unverified),
            user_created: before.map_or(!kit, |b| b.user_created),
            fork_of: before.and_then(|b| b.fork_of.clone()),
            overlay: before.map(|b| b.overlay.clone()).unwrap_or_default(),
            digest,
        };
        survey.insert(key.clone(), seen);
        next.records.insert(key, record);
    }
    Ok((next, survey))
}

/// `files` against the ledger's hash for each owned file.
fn observe(files: Vec<TreeFile>, owned: &BTreeMap<String, String>) -> Observed {
    let by_path: BTreeMap<&str, &str> = files
        .iter()
        .map(|f| (f.path.as_str(), f.sha256.as_str()))
        .collect();
    let mut seen = Observed {
        owned: owned.clone(),
        ..Observed::default()
    };
    for (path, hash) in owned {
        match by_path.get(path.as_str()) {
            None => seen.missing.push(path.clone()),
            Some(actual) if actual != hash => seen.edited.push(path.clone()),
            Some(_) => {}
        }
    }
    seen.files = files;
    seen
}

/// `before`'s history with its digest appended when the tree moved on.
fn next_history(before: Option<&SkillRecord>, digest: &str) -> Vec<String> {
    let Some(before) = before else {
        return Vec::new();
    };
    let mut history = before.history.clone();
    if before.digest != digest {
        history.retain(|d| d != digest && *d != before.digest);
        history.push(before.digest.clone());
    }
    let excess = history.len().saturating_sub(HISTORY_LIMIT);
    history.drain(..excess);
    history
}

/// Directories directly under `root` (not symlinks), as root-relative keys.
fn child_dirs(layout: &Layout, root: &str) -> io::Result<Vec<String>> {
    let Ok(rel) = RelPath::new(root) else {
        return Ok(Vec::new());
    };
    let entries = match std::fs::read_dir(layout.resolve(&rel)) {
        Ok(entries) => entries,
        Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(e) => return Err(e),
    };
    let mut out = Vec::new();
    for entry in entries {
        let entry = entry?;
        if !entry.file_type()?.is_dir() {
            continue;
        }
        if let Ok(name) = entry.file_name().into_string() {
            out.push(format!("{root}/{name}"));
        }
    }
    Ok(out)
}
