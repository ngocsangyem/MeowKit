//! The ledger rows under each skill directory, and the hash a record keeps of
//! them so a ledger changed behind the store's back is noticed.
use std::collections::{BTreeMap, BTreeSet};

use sha2::{Digest, Sha256};

use super::record::Sidecar;
use crate::ownership::OwnershipIndex;

/// Every ledger at one scope, by runtime name.
pub type Ledgers = [(String, OwnershipIndex)];

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

#[cfg(test)]
mod tests {
    use super::skill_key_of;

    #[test]
    fn a_skill_directory_is_the_one_under_skills() {
        assert_eq!(
            skill_key_of(".claude/skills/fix/SKILL.md"),
            Some(".claude/skills/fix")
        );
        assert_eq!(
            skill_key_of(".agents/skills/mk-fix/references/a.md"),
            Some(".agents/skills/mk-fix")
        );
        assert_eq!(skill_key_of(".claude/skills/fix"), None);
        assert_eq!(skill_key_of("skills/fix/SKILL.md"), None);
        assert_eq!(skill_key_of(".claude/hooks/x.cjs"), None);
    }
}
