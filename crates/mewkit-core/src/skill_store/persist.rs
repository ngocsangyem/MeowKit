//! Every store write reaches disk here: under the scope lock, backed up when
//! asked, through the rollback journal.
use std::io;
use std::path::PathBuf;

use super::StorePaths;
use super::record::StoreError;
use crate::backup;
use crate::fsx::{RelPath, check_no_links};
use crate::journal::Journal;
use crate::layout::Layout;
use crate::lock::ScopeLock;

/// One file to write: path, bytes, mode (`None`: 0644).
pub struct Write {
    pub path: RelPath,
    pub bytes: Vec<u8>,
    pub mode: Option<u32>,
}

/// Apply `writes` and `removes` as one change. Paths in `backed_up` that exist
/// are copied under the backups directory first; returns that backup. A
/// failure part way restores every path already touched.
pub fn apply(
    layout: &Layout,
    paths: &StorePaths,
    writes: &[Write],
    removes: &[RelPath],
    backed_up: &[&RelPath],
) -> Result<Option<PathBuf>, StoreError> {
    if writes.is_empty() && removes.is_empty() {
        return Ok(None);
    }
    for path in writes.iter().map(|w| &w.path).chain(removes) {
        layout
            .check_parents(path)
            .map_err(|e| StoreError::Refused(e.to_string()))?;
    }
    for own in [&paths.lock, &paths.backups] {
        check_no_links(layout.root(), own).map_err(|e| StoreError::Refused(e.to_string()))?;
    }
    let _lock = ScopeLock::acquire(&paths.lock.under(layout.root()))
        .map_err(|e| StoreError::Refused(e.to_string()))?;
    let backup = if backed_up.is_empty() {
        None
    } else {
        backup::take(layout, backed_up, &paths.backups.under(layout.root()))?
    };
    let mut journal = Journal::new(layout);
    for w in writes {
        journal
            .write(&w.path, &w.bytes, w.mode)
            .map_err(at(&w.path))?;
    }
    for path in removes {
        journal.remove(path).map_err(at(path))?;
    }
    journal.commit();
    Ok(backup)
}

fn at(path: &RelPath) -> impl FnOnce(io::Error) -> StoreError + '_ {
    move |source| StoreError::Io {
        path: path.to_string(),
        source,
    }
}
