//! The snapshots `backups` lists and restores: a copy of every file a command
//! is about to change, under `.meowkit/backups/<id>/`.
//!
//! The format is the npm CLI's (`manifest.json` beside a `files/` tree), so a
//! snapshot taken by either CLI can be restored by the other. A restore is
//! itself a mutation and takes its own snapshot first; without that,
//! recovering from a bad upgrade would destroy whatever the user did between
//! the upgrade and the recovery.
//!
//! `.meowkit/cache/` is never snapshotted: it is re-fetchable, and copying it
//! would multiply every backup by the size of a whole kit.
use std::io;
use std::path::{Path, PathBuf};

use serde_json::{Value, json};
use sha2::{Digest, Sha256};

use crate::time_utc::{iso_seconds, now_millis};

/// Where snapshots live, relative to the project root.
pub const BACKUPS_REL: &str = ".meowkit/backups";
const MANIFEST: &str = "manifest.json";
const FILES_DIR: &str = "files";
const EXCLUDED_PREFIX: &str = ".meowkit/cache/";

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Entry {
    pub path: String,
    pub checksum: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Manifest {
    pub id: String,
    pub created_at: String,
    pub command: String,
    /// Printed as the manifest wrote it: a hand-edited manifest may not hold a number.
    pub file_count: Value,
    pub files: Vec<Entry>,
}

fn snapshot_dir(root: &Path, id: &str) -> PathBuf {
    root.join(BACKUPS_REL).join(id)
}

/// A relative path made only of ordinary names: no root, no drive, no `..`.
/// A manifest is a file on disk anyone could have edited, so this is what keeps
/// a restore inside the project. The npm CLI does not check; here it is refused.
fn is_inside(rel: &str) -> bool {
    use std::path::Component;
    !rel.is_empty()
        && Path::new(rel)
            .components()
            .all(|c| matches!(c, Component::Normal(_) | Component::CurDir))
}

/// The first manifest path a restore would write outside the project, if any.
pub fn outside_path(manifest: &Manifest) -> Option<&str> {
    manifest
        .files
        .iter()
        .map(|f| f.path.as_str())
        .find(|p| !is_inside(p))
}

/// Backup directories with no snapshot manifest: the plain copies `mewkit`
/// takes before `init`, `upgrade` and `uninstall` write. Listed so they are not
/// mistaken for "no backups"; this command does not restore them.
pub fn plain_copies(root: &Path) -> Vec<String> {
    let Ok(read) = std::fs::read_dir(root.join(BACKUPS_REL)) else {
        return Vec::new();
    };
    let mut ids: Vec<String> = read
        .filter_map(Result::ok)
        .filter(|e| e.path().is_dir() && !e.path().join(MANIFEST).exists())
        .map(|e| e.file_name().to_string_lossy().into_owned())
        .collect();
    ids.sort();
    ids
}

fn sha256_file(path: &Path) -> io::Result<String> {
    let digest = Sha256::digest(std::fs::read(path)?);
    Ok(digest.iter().map(|b| format!("{b:02x}")).collect())
}

/// Read one manifest, or `None` when the id names nothing readable.
pub fn read_snapshot(root: &Path, id: &str) -> Option<Manifest> {
    // One directory name under the backups dir, never a path that leaves it.
    if !is_inside(id) || Path::new(id).components().count() != 1 {
        return None;
    }
    let text = std::fs::read_to_string(snapshot_dir(root, id).join(MANIFEST)).ok()?;
    let v: Value = serde_json::from_str(&text).ok()?;
    let text_of = |key: &str| {
        v.get(key)
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string()
    };
    let files = v
        .get("files")
        .and_then(Value::as_array)
        .map(|list| {
            list.iter()
                .map(|f| Entry {
                    path: f
                        .get("path")
                        .and_then(Value::as_str)
                        .unwrap_or_default()
                        .to_string(),
                    checksum: f
                        .get("checksum")
                        .and_then(Value::as_str)
                        .unwrap_or_default()
                        .to_string(),
                })
                .collect()
        })
        .unwrap_or_default();
    Some(Manifest {
        id: text_of("id"),
        created_at: text_of("createdAt"),
        command: text_of("command"),
        file_count: v.get("fileCount").cloned().unwrap_or(Value::Null),
        files,
    })
}

/// Every readable snapshot, newest first.
pub fn list_snapshots(root: &Path) -> Vec<Manifest> {
    let Ok(read) = std::fs::read_dir(root.join(BACKUPS_REL)) else {
        return Vec::new();
    };
    let mut names: Vec<String> = read
        .filter_map(Result::ok)
        .filter(|e| e.path().is_dir())
        .map(|e| e.file_name().to_string_lossy().into_owned())
        .collect();
    names.sort();
    let mut found: Vec<Manifest> = names
        .iter()
        .filter_map(|n| read_snapshot(root, n))
        .collect();
    // Stable, like the npm CLI's sort: equal instants keep their listing order.
    found.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    found
}

/// `Date#toISOString`: the instant with its milliseconds.
pub fn iso_millis(unix_millis: i64) -> String {
    format!(
        "{}.{:03}Z",
        iso_seconds(unix_millis).trim_end_matches('Z'),
        unix_millis.rem_euclid(1000)
    )
}

/// A sortable id: the instant plus the command that took it.
fn snapshot_id(command: &str, now_ms: i64, suffix: &str) -> String {
    let secs = iso_seconds(now_ms).replace(['-', ':'], "");
    format!("{secs}-{command}{suffix}")
}

/// The id nothing has used yet, so two runs in the same second cannot collide.
fn free_id(root: &Path, command: &str, now_ms: i64) -> String {
    (0u32..)
        .map(|n| {
            snapshot_id(
                command,
                now_ms,
                &if n == 0 {
                    String::new()
                } else {
                    format!("-{n}")
                },
            )
        })
        .find(|id| !snapshot_dir(root, id).exists())
        .unwrap_or_default()
}

/// Files that exist and are worth recording, deduplicated and sorted. A target
/// not on disk is dropped: a snapshot answers "what did this file hold", and
/// for a path that held nothing the answer is a deletion, which a restore has
/// no mandate to perform.
fn resolve_targets(root: &Path, rel_paths: &[String]) -> Vec<String> {
    let mut seen: Vec<String> = rel_paths
        .iter()
        .filter(|rel| !rel.starts_with(EXCLUDED_PREFIX) && root.join(rel).exists())
        .cloned()
        .collect();
    seen.sort();
    seen.dedup();
    seen
}

/// Write the snapshot, or `None` when there is nothing to record. The manifest
/// goes LAST, so a run interrupted mid-copy leaves a directory without one
/// rather than a manifest promising files that are not there.
pub fn create_snapshot(
    root: &Path,
    command: &str,
    rel_paths: &[String],
) -> io::Result<Option<Manifest>> {
    let targets = resolve_targets(root, rel_paths);
    if targets.is_empty() {
        return Ok(None);
    }
    let now_ms = now_millis();
    let id = free_id(root, command, now_ms);
    let dir = snapshot_dir(root, &id);
    let mut files = Vec::new();
    for rel in &targets {
        let source = root.join(rel);
        let dest = dir.join(FILES_DIR).join(rel);
        if let Some(parent) = dest.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::copy(&source, &dest)?;
        files.push(Entry {
            path: rel.clone(),
            checksum: sha256_file(&source)?,
        });
    }
    let created_at = iso_millis(now_ms);
    let manifest = Manifest {
        id: id.clone(),
        created_at,
        command: command.to_string(),
        file_count: json!(files.len()),
        files,
    };
    let body = json!({
        "id": manifest.id,
        "createdAt": manifest.created_at,
        "command": manifest.command,
        "fileCount": manifest.file_count,
        "files": manifest.files.iter().map(|f| json!({"path": f.path, "checksum": f.checksum})).collect::<Vec<_>>(),
    });
    std::fs::create_dir_all(&dir)?;
    std::fs::write(
        dir.join(MANIFEST),
        format!(
            "{}\n",
            serde_json::to_string_pretty(&body).unwrap_or_default()
        ),
    )?;
    Ok(Some(manifest))
}

/// What a restore would do, without doing it: `(write, unchanged)`.
pub fn plan_restore(root: &Path, manifest: &Manifest) -> (Vec<String>, Vec<String>) {
    let (mut write, mut unchanged) = (Vec::new(), Vec::new());
    for entry in &manifest.files {
        let target = root.join(&entry.path);
        if target.exists() && sha256_file(&target).is_ok_and(|h| h == entry.checksum) {
            unchanged.push(entry.path.clone());
        } else {
            write.push(entry.path.clone());
        }
    }
    (write, unchanged)
}

pub struct Restored {
    pub restored: Vec<Entry>,
    pub unchanged: Vec<String>,
    /// The snapshot taken of the pre-restore state, so the restore is undoable.
    pub undo_id: Option<String>,
}

/// Restore one snapshot, after snapshotting what it will overwrite.
pub fn restore_snapshot(root: &Path, id: &str, manifest: &Manifest) -> io::Result<Restored> {
    if let Some(path) = outside_path(manifest) {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            format!("snapshot {id} names a path outside the project: {path}"),
        ));
    }
    let (write, unchanged) = plan_restore(root, manifest);
    let undo = if write.is_empty() {
        None
    } else {
        create_snapshot(root, "backups-restore", &write)?
    };
    let mut restored = Vec::new();
    for rel in write {
        let source = snapshot_dir(root, id).join(FILES_DIR).join(&rel);
        if !source.exists() {
            continue;
        }
        let target = root.join(&rel);
        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::copy(&source, &target)?;
        let checksum = manifest
            .files
            .iter()
            .find(|f| f.path == rel)
            .map(|f| f.checksum.clone())
            .unwrap_or_default();
        restored.push(Entry {
            path: rel,
            checksum,
        });
    }
    Ok(Restored {
        restored,
        unchanged,
        undo_id: undo.map(|m| m.id),
    })
}

#[cfg(test)]
#[path = "snapshot_tests.rs"]
mod snapshot_tests;
