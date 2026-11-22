//! Which skill trees to keep for rollback when the store is saved: every
//! digest a record names now or in its history, captured the first time
//! indexing sees it, and nothing else.
use std::collections::BTreeSet;

use mewkit_adapters::contract::RelPath;
use mewkit_core::skill_store::{Sidecar, Survey, Write, capture, tree_file};

use super::Store;
use crate::failure::Failure;

/// The trees to write (digests seen for the first time) and to delete
/// (digests no record names any more).
pub fn changes(
    store: &Store,
    next: &Sidecar,
    survey: &Survey,
) -> Result<(Vec<Write>, Vec<RelPath>), Failure> {
    let mut writes = Vec::new();
    for (key, record) in &next.records {
        let file = tree_file(&store.paths.dir, &record.digest);
        if store.layout.resolve(&file).exists() {
            continue;
        }
        let Some(seen) = survey.get(key) else {
            continue;
        };
        let dir = store.layout.resolve(&RelPath::new(key)?);
        if let Some(bytes) = capture(&dir, &seen.files)? {
            writes.push(Write {
                path: file,
                bytes,
                mode: None,
            });
        }
    }
    let named: BTreeSet<&str> = next
        .records
        .values()
        .flat_map(|r| std::iter::once(&r.digest).chain(&r.history))
        .map(String::as_str)
        .collect();
    let trees = RelPath::new(&format!("{}/trees", store.paths.dir))?;
    let mut removes = Vec::new();
    if let Ok(entries) = std::fs::read_dir(store.layout.resolve(&trees)) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().into_owned();
            let Some(digest) = name.strip_suffix(".json") else {
                continue;
            };
            let path = RelPath::new(&format!("{trees}/{name}"));
            if let (false, true, Ok(path)) = (named.contains(digest), entry.path().is_file(), path)
            {
                removes.push(path);
            }
        }
    }
    Ok((writes, removes))
}
