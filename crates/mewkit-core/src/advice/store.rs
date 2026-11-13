//! Durable continuity for one supervised run: read, mutate and write the
//! dossier under a lock the npm CLI and the shell hooks contend on too.
//!
//! `read` then `write` is NOT equivalent to [`update_dossier`]: two processes
//! that each read, mutate and write lose one of the two updates, and the update
//! being lost is a committed checkpoint — a spent cap slot that comes back. So
//! the read, the mutation and the rename all happen inside one lock.
//!
//! Every read fails CLOSED. A damaged record is CORRUPT, never an absent run:
//! treating it as "no history" would reset every cap, so the cheapest way to buy
//! unlimited supervision would be to break the file that counts it.

use std::path::{Path, PathBuf};

use crate::schema::dossier::{CheckpointMarker, CheckpointState, Dossier, validate_dossier};
use crate::schema::dossier_doc::{dossier_path, render_dossier};
use crate::schema::dossier_parse::{DossierRead, parse_dossier};
use crate::schema::supervision_protocol::{Disposition, SupervisionStage};
use crate::sidecar_lock::SidecarLock;

/// Separator for never-auto-loaded history kept below the active summary.
const HISTORY_MARKER: &str = "\n<!-- supervision-history (never auto-loaded) -->\n";

/// Why an update could not land.
#[derive(Debug)]
pub enum StoreError {
    /// A dossier exists but cannot be read. Distinct from "no such run".
    Corrupt {
        run_id: String,
        detail: String,
    },
    /// The mutation produced a record the schema refuses, so nothing was written.
    Invalid(String),
    /// The caller's own refusal, surfaced unchanged.
    Refused(String),
    Io(String),
}

impl std::fmt::Display for StoreError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Corrupt { run_id, detail } => {
                write!(
                    f,
                    "supervision state for run \"{run_id}\" is unreadable ({detail})"
                )
            }
            Self::Invalid(errors) => write!(f, "invalid supervision dossier: {errors}"),
            Self::Refused(message) => f.write_str(message),
            Self::Io(message) => f.write_str(message),
        }
    }
}

fn io(error: std::io::Error) -> StoreError {
    StoreError::Io(error.to_string())
}

/// Read a run's dossier from its deterministic path. Absent is not corrupt.
pub fn read_dossier(project_root: &Path, run_id: &str) -> Result<DossierRead, String> {
    let target = dossier_path(project_root, run_id)?;
    match std::fs::read(&target) {
        Ok(bytes) => Ok(parse_dossier(&String::from_utf8_lossy(&bytes))),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(DossierRead::Absent),
        Err(e) => Err(e.to_string()),
    }
}

/// Every supervision run recorded in the project, by deterministic filename.
///
/// Corrupt records are RETURNED rather than skipped: this answers "is another
/// run for this skill already escalated", and silently ignoring a damaged
/// sibling would restore the bypass that check exists to close. Sorted by name
/// because a directory order is not a contract either runtime can promise.
pub fn list_supervision_runs(project_root: &Path) -> Vec<(String, DossierRead)> {
    const SUFFIX: &str = "-athena-supervision.md";
    let dir = project_root.join("tasks").join("reports");
    let Ok(entries) = std::fs::read_dir(&dir) else {
        return Vec::new();
    };
    let mut found: Vec<(String, DossierRead)> = entries
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let name = entry.file_name().to_string_lossy().into_owned();
            let run_id = name.strip_suffix(SUFFIX)?.to_string();
            let bytes = std::fs::read(entry.path()).ok()?;
            Some((run_id, parse_dossier(&String::from_utf8_lossy(&bytes))))
        })
        .collect();
    found.sort_by(|a, b| a.0.cmp(&b.0));
    found
}

fn lock_path(project_root: &Path, run_id: &str) -> PathBuf {
    project_root
        .join("tasks")
        .join("reports")
        .join(format!(".{run_id}-supervision.lock"))
}

/// Temp+rename so a crash mid-write cannot leave a half-written dossier.
fn atomic_write(target: &Path, body: &str) -> Result<(), StoreError> {
    let mut scratch = target.as_os_str().to_os_string();
    scratch.push(format!(".tmp-{}", std::process::id()));
    let scratch = PathBuf::from(scratch);
    std::fs::write(&scratch, body).map_err(io)?;
    if let Err(e) = std::fs::rename(&scratch, target) {
        let _ = std::fs::remove_file(&scratch);
        return Err(io(e));
    }
    Ok(())
}

/// Read → mutate → write for one run, all inside the same lock.
///
/// `mutate` receives `None` when no run exists yet, so creation and update take
/// the same guarded path, and may refuse by returning `Err`.
pub fn update_dossier<F>(
    project_root: &Path,
    run_id: &str,
    mutate: F,
) -> Result<Dossier, StoreError>
where
    F: FnOnce(Option<Dossier>) -> Result<Dossier, String>,
{
    let target = dossier_path(project_root, run_id).map_err(StoreError::Refused)?;
    let reports = project_root.join("tasks").join("reports");
    std::fs::create_dir_all(&reports).map_err(io)?;
    let _lock = SidecarLock::acquire(&lock_path(project_root, run_id))
        .map_err(|e| StoreError::Io(e.to_string()))?;

    let (existing, history) = match std::fs::read(&target) {
        Ok(bytes) => {
            let raw = String::from_utf8_lossy(&bytes).into_owned();
            // Fail closed inside the lock too: a damaged record must not be
            // silently replaced by a fresh one, which would hand the run a
            // brand-new budget.
            let dossier = match parse_dossier(&raw) {
                DossierRead::Found(dossier) => *dossier,
                DossierRead::Corrupt(detail) => {
                    return Err(StoreError::Corrupt {
                        run_id: run_id.to_string(),
                        detail,
                    });
                }
                DossierRead::Absent => {
                    return Err(StoreError::Corrupt {
                        run_id: run_id.to_string(),
                        detail: "unreadable".to_string(),
                    });
                }
            };
            let tail = raw
                .find(HISTORY_MARKER)
                .map(|idx| raw[idx..].to_string())
                .unwrap_or_default();
            (Some(dossier), tail)
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => (None, String::new()),
        Err(e) => return Err(io(e)),
    };

    let next = mutate(existing).map_err(StoreError::Refused)?;
    let candidate = serde_json::to_value(&next).expect("a dossier serializes");
    let check = validate_dossier(&candidate);
    if !check.ok {
        return Err(StoreError::Invalid(check.errors.join("; ")));
    }
    atomic_write(&target, &format!("{}{history}", render_dossier(&next)))?;
    Ok(next)
}

/// Mark a checkpoint `pending` before delegating. If the process dies mid-call,
/// the pending marker is what lets a resuming parent recognise the checkpoint as
/// already-attempted instead of spending another slot on it.
pub fn begin_checkpoint(
    dossier: Dossier,
    checkpoint_id: String,
    stage: SupervisionStage,
    partition: Option<String>,
) -> Dossier {
    Dossier {
        stage,
        checkpoint: Some(CheckpointMarker {
            checkpoint_id,
            stage,
            state: CheckpointState::Pending,
            partition,
        }),
        ..dossier
    }
}

/// What a committed call records.
pub struct CommitResult {
    pub latest_directive: String,
    pub next_safe_action: String,
    pub disposition: Disposition,
    pub receipt_pointer: Option<String>,
    pub corrections: u64,
}

/// Commit a delivered result, advancing the directive and correction count and
/// appending the call to `history`.
///
/// The history entry is what a later call counts against the caps, so it is
/// written here — at the same moment the checkpoint becomes `committed` — rather
/// than left to the caller: a committed call that never reached the history
/// would be a free slot. Re-committing the same id REPLACES its entry, so a
/// retry cannot inflate the count it is exempt from. The partition comes from
/// the marker, never from the commit call: the budget a call spends is decided
/// when the slot is claimed.
pub fn commit_checkpoint(mut dossier: Dossier, result: &CommitResult) -> Dossier {
    if let Some(cp) = dossier.checkpoint.take() {
        let entry = crate::schema::dossier::CheckpointHistory {
            checkpoint_id: cp.checkpoint_id.clone(),
            stage: cp.stage,
            disposition: result.disposition,
            partition: cp.partition.clone(),
        };
        dossier
            .history
            .retain(|h| h.checkpoint_id != entry.checkpoint_id);
        dossier.history.push(entry);
        dossier.checkpoint = Some(CheckpointMarker {
            state: CheckpointState::Committed,
            ..cp
        });
    }
    if let Some(pointer) = &result.receipt_pointer
        && !dossier.receipt_pointers.contains(pointer)
    {
        dossier.receipt_pointers.push(pointer.clone());
    }
    dossier.latest_directive = result.latest_directive.clone();
    dossier.next_safe_action = result.next_safe_action.clone();
    dossier.correction_count += result.corrections;
    dossier
}

#[cfg(test)]
#[path = "store_tests.rs"]
mod tests;
