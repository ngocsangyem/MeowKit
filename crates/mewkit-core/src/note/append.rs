//! The append itself: two store files, one lock each, one blank line between
//! entries.
use std::io::Write;
use std::path::{Path, PathBuf};

use crate::memory::{MEMORY_FILE_MAX_LINES, count_lines};
use crate::sidecar_lock::{SidecarLock, SidecarLockError};
use crate::state_paths::{StateClass, resolve_state_dir};

use super::shape::js_trim;

/// The two-file contract. Anything else is not memory.
pub const NOTE_FILES: [&str; 2] = ["decisions", "gotchas"];

/// Which of the two store files an entry is for.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NoteFile {
    Decisions,
    Gotchas,
}

impl NoteFile {
    pub fn from_name(name: &str) -> Option<Self> {
        match name {
            "decisions" => Some(Self::Decisions),
            "gotchas" => Some(Self::Gotchas),
            _ => None,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Decisions => "decisions",
            Self::Gotchas => "gotchas",
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum NoteError {
    /// The append would push the file over the lint's line cap. Refusing here
    /// keeps the failure at WRITE time, where the fix (prune) is obvious,
    /// instead of surfacing later as a blocked commit in the pre-ship hook.
    #[error("{0}")]
    Cap(String),
    /// The lock could not be taken. Nothing was written — which is the whole
    /// point of taking it. A lock held by a crashed process is reclaimed by the
    /// stamp rule (see [`crate::sidecar_lock`]), so this is a real contender or
    /// a filesystem problem, not a stale file.
    #[error("{0}")]
    Lock(#[from] SidecarLockError),
    #[error("cannot append to the memory store: {0}")]
    Io(#[from] std::io::Error),
}

/// The lock path for one store file.
///
/// It lives under the `state` class, NEVER inside the memory directory. That
/// directory is committed and grep-read; a lock sidecar in there would show up
/// in the PR diff, in the read surface, and in the lint's own scan.
pub fn note_lock_path(project_root: &Path, file: NoteFile) -> PathBuf {
    resolve_state_dir(project_root, StateClass::State)
        .join("locks")
        .join(format!("memory-{}.lock", file.as_str()))
}

/// Append `entry` to the store file under the write lock. Returns the
/// project-relative path that was written.
pub fn append_note(project_root: &Path, file: NoteFile, entry: &str) -> Result<String, NoteError> {
    let memory_dir = resolve_state_dir(project_root, StateClass::Memory);
    let target = memory_dir.join(format!("{}.md", file.as_str()));
    let lock_path = note_lock_path(project_root, file);
    if let Some(dir) = lock_path.parent() {
        std::fs::create_dir_all(dir)?;
    }
    std::fs::create_dir_all(&memory_dir)?;

    // Exactly one trailing newline, so the separator logic below is
    // deterministic for every writer.
    let body = format!("{}\n", js_trim(entry));

    let _held = SidecarLock::acquire(&lock_path)?;
    let existing = match std::fs::read_to_string(&target) {
        Ok(text) => text,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => String::new(),
        Err(e) => return Err(e.into()),
    };
    // One blank line between entries; a file that does not end in a newline
    // gets the terminator it is missing as well.
    let prefix = if existing.is_empty() {
        ""
    } else if existing.ends_with('\n') {
        "\n"
    } else {
        "\n\n"
    };
    let after = count_lines(&format!("{existing}{prefix}{body}"));
    if after > MEMORY_FILE_MAX_LINES {
        let name = target
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default();
        return Err(NoteError::Cap(format!(
            "{name} would reach {after} lines, over the {MEMORY_FILE_MAX_LINES}-line cap — \
             run /mk:memory --prune first"
        )));
    }
    // Opened with O_APPEND, so the write is positioned at end-of-file by the
    // kernel at write time: a concurrent holder's append cannot be overwritten
    // even if one slipped past the lock.
    let mut handle = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&target)?;
    handle.write_all(prefix.as_bytes())?;
    handle.write_all(body.as_bytes())?;

    Ok(target
        .strip_prefix(project_root)
        .unwrap_or(&target)
        .display()
        .to_string())
}
