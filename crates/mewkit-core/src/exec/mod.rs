//! The one executor: every emitter's plan reaches disk through [`execute`].
//!
//! validate → decide → (dry run: report) | lock → backup → journal apply →
//! ownership index → commit. Mutation paths, dry-run output and the backup set
//! are all derived from the same decisions, so they cannot drift apart.
mod decide;
mod interrupted;

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use crate::backup;
use crate::fsx::{PathError, RelPath, check_parents, check_within, is_never_delete};
use crate::journal::Journal;
use crate::layout::{Layout, Mount};
use crate::lock::{LockError, ScopeLock};
use crate::ownership::OwnershipIndex;
use crate::plan::Plan;
use crate::report::EmitReport;
use decide::{Action, Record, decide};

/// Where one target's install lives at one scope.
pub struct Scope {
    /// The project root, or the home directory for a global install.
    pub root: PathBuf,
    /// Prefixes resolved outside `root` (a global runtime directory
    /// elsewhere); empty for a project.
    pub mounts: Vec<Mount>,
    /// The only places this target's ops may touch.
    pub roots: Vec<RelPath>,
    /// The ownership index file, e.g. `.meowkit/state/ownership/codex.json`.
    pub index_file: RelPath,
    pub lock_file: RelPath,
    pub backups_dir: RelPath,
}

#[derive(Clone, Copy, Debug, Default)]
pub struct ExecOptions {
    pub dry_run: bool,
    /// Overwrite or remove files the user edited.
    pub force: bool,
}

#[derive(Debug, thiserror::Error)]
pub enum ExecError {
    #[error(transparent)]
    Path(#[from] PathError),
    #[error(transparent)]
    Lock(#[from] LockError),
    #[error("cannot merge into {0}: {1}")]
    Merge(String, String),
    #[error("{action} failed; every change was rolled back: {source}")]
    Io {
        action: String,
        source: std::io::Error,
    },
}

/// Apply `plan` to `scope`, updating `index` only if everything succeeded.
/// `kit_hash` answers the SHA-256 of the bytes the kit installs at a path
/// (`None`: not shipped): what the emitter writes, after any rewrite.
pub fn execute(
    plan: &Plan,
    scope: &Scope,
    index: &mut OwnershipIndex,
    kit_hash: &dyn Fn(&RelPath) -> Option<String>,
    opts: ExecOptions,
) -> Result<EmitReport, ExecError> {
    let layout = Layout::new(&scope.root, scope.mounts.clone());
    for op in &plan.ops {
        check_within(op.path(), &scope.roots)?;
        layout.check_parents(op.path())?;
        // User and machine state is off limits to every op, not only removals.
        if is_never_delete(op.path()) {
            return Err(PathError::NeverDelete(op.path().to_string()).into());
        }
    }
    for own in [&scope.index_file, &scope.lock_file, &scope.backups_dir] {
        check_parents(&scope.root, own)?;
    }
    let _lock = if opts.dry_run {
        None
    } else {
        Some(ScopeLock::acquire(&scope.lock_file.under(&scope.root))?)
    };
    let record = interrupted::record_file(&scope.lock_file).under(&scope.root);
    let io = |action: &str| {
        let action = action.to_owned();
        move |source| ExecError::Io { action, source }
    };
    let mut notices = Vec::new();
    if opts.dry_run {
        if interrupted::pending(&record) {
            notices.push(
                "an earlier run was interrupted; the next run restores its files first, \
                 so this preview may differ from what it does"
                    .to_owned(),
            );
        }
    } else if let Some(restored) =
        interrupted::recover(&layout, &record).map_err(io("recovering an interrupted run"))?
    {
        for path in &restored {
            prune_empty_parents(&layout, path);
        }
        notices.push(format!(
            "restored {} file(s) an interrupted run had changed",
            restored.len()
        ));
        // The caller read the index before recovery. Keep what it says about
        // the kit, but own exactly what the restored index owns.
        let saved = OwnershipIndex::load(&scope.index_file.under(&scope.root))
            .map_err(|e| ExecError::Io {
                action: "reloading the ownership index".into(),
                source: std::io::Error::other(e.to_string()),
            })?
            .unwrap_or_else(|| OwnershipIndex::new("", "", index.origin));
        index.paths = saved.paths;
        index.hooks = saved.hooks;
        index.mcp_servers = saved.mcp_servers;
        index.sections = saved.sections;
    }

    // Decide every op against disk as earlier ops will have left it.
    let mut work = index.clone();
    let mut pending: HashMap<RelPath, Option<Vec<u8>>> = HashMap::new();
    let mut decisions = Vec::new();
    for op in &plan.ops {
        let current = match pending.get(op.path()) {
            Some(bytes) => bytes.clone(),
            None => read_opt(&layout.resolve(op.path()))?,
        };
        let d = decide(op, current, &work, kit_hash, opts.force)?;
        match &d.action {
            Action::Write { bytes, .. } => {
                pending.insert(d.path.clone(), Some(bytes.clone()));
            }
            Action::Remove => {
                pending.insert(d.path.clone(), None);
            }
            Action::Unchanged | Action::Preserve(_) => {}
        }
        apply_record(&mut work, &d.path, &d.record);
        decisions.push(d);
    }

    let mut report = EmitReport {
        dry_run: opts.dry_run,
        notices: notices
            .into_iter()
            .chain(plan.notices.iter().cloned())
            .collect(),
        dropped_hooks: plan.dropped_hooks.clone(),
        narrowed_hooks: plan.narrowed_hooks.clone(),
        unsupported: plan.unsupported.clone(),
        ..EmitReport::default()
    };
    for d in &decisions {
        report.replaced.extend(d.replaced.iter().cloned());
        match &d.action {
            Action::Write { .. } => push_once(&mut report.written, &d.path),
            Action::Remove => push_once(&mut report.removed, &d.path),
            Action::Preserve(why) => report.preserved.push((d.path.to_string(), why.clone())),
            Action::Unchanged => {}
        }
    }
    if opts.dry_run {
        return Ok(report);
    }

    // The index rides along so an interrupted run can be put back whole.
    let changing: Vec<&RelPath> = decisions
        .iter()
        .filter(|d| matches!(d.action, Action::Write { .. } | Action::Remove))
        .map(|d| &d.path)
        .chain([&scope.index_file])
        .collect();
    report.backup = backup::take(&layout, &changing, &scope.backups_dir.under(&scope.root))
        .map_err(io("backup"))?;
    interrupted::begin(&record, report.backup.as_deref(), &changing)
        .map_err(io("recording the run"))?;

    let mut journal = Journal::new(&layout);
    for d in &decisions {
        match &d.action {
            Action::Write { bytes, mode } => journal
                .write(&d.path, bytes, *mode)
                .map_err(io(&format!("writing {}", d.path)))?,
            Action::Remove => journal
                .remove(&d.path)
                .map_err(io(&format!("removing {}", d.path)))?,
            Action::Unchanged | Action::Preserve(_) => {}
        }
    }
    if work.paths.is_empty()
        && work.sections.is_empty()
        && work.hooks.is_empty()
        && work.mcp_servers.is_empty()
    {
        journal
            .remove(&scope.index_file)
            .map_err(io("removing the ownership index"))?;
    } else {
        journal
            .write(&scope.index_file, &work.to_json(), None)
            .map_err(io("writing the ownership index"))?;
    }
    journal.commit();
    interrupted::end(&record).map_err(io("finishing the run"))?;
    // A removal that found its file already gone (a rerun after a crash)
    // prunes too: the crashed run never got that far.
    for d in decisions.iter().filter(|d| {
        matches!(d.action, Action::Remove)
            || matches!(
                (&d.action, &d.record),
                (Action::Unchanged, Record::DisownFile)
            )
    }) {
        prune_empty_parents(&layout, &d.path);
    }
    *index = work;
    Ok(report)
}

/// After a removal, take out the directories it left empty, innermost first,
/// stopping at the first one that still holds anything and never reaching
/// [`Layout::prune_floor`]. Best effort: the install is already committed,
/// and an empty directory left behind is harmless.
fn prune_empty_parents(layout: &Layout, path: &RelPath) {
    let root = layout.prune_floor(path);
    let mut dir = layout.resolve(path);
    while dir.pop() && dir != root && dir.starts_with(root) {
        if std::fs::remove_dir(&dir).is_err() {
            break;
        }
    }
}

fn apply_record(index: &mut OwnershipIndex, path: &RelPath, record: &Record) {
    let key = path.to_string();
    match record {
        Record::None => {}
        Record::OwnFile(hash) => {
            index.paths.insert(key, hash.clone());
        }
        Record::DisownFile => {
            index.paths.remove(&key);
        }
        Record::AddSection(id, section) => {
            index
                .sections
                .entry(key)
                .or_default()
                .insert(id.clone(), section.clone());
        }
        Record::DropSection(id) => {
            if let Some(file) = index.sections.get_mut(&key) {
                file.remove(id);
                if file.is_empty() {
                    index.sections.remove(&key);
                }
            }
        }
    }
}

fn read_opt(path: &Path) -> Result<Option<Vec<u8>>, ExecError> {
    match std::fs::read(path) {
        Ok(b) => Ok(Some(b)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(source) => Err(ExecError::Io {
            action: format!("reading {}", path.display()),
            source,
        }),
    }
}

fn push_once(list: &mut Vec<String>, path: &RelPath) {
    if !list.iter().any(|p| p == path.as_str()) {
        list.push(path.to_string());
    }
}
