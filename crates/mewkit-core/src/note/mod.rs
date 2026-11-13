//! `note` — the serialized write path for the committed team-memory store.
//!
//! Port of `commands/note.ts`. Entry text arrives on stdin (the CLI reads it);
//! this module validates the shape, runs the SAME content scan the memory lint
//! runs, takes the memory write lock and appends.
//!
//! Why a command and not an agent `Edit`: `decisions.md` / `gotchas.md` are the
//! only durable shared artifacts in the repo, and an `Edit` is read-whole →
//! replace → write-whole. Two agents appending at once (parallel runs, or a fix
//! plus a background review) silently lose one entry, and the lint cannot see a
//! missing entry.
//!
//! Why the scan runs BEFORE the write: a rejected entry must leave the store
//! byte-identical, so a poisoned or secret-bearing entry never lands and never
//! has to be removed from git history. And the rejection names the finding KIND
//! and LINE only — never the matched text — because a secret echoed into a
//! terminal or a CI log is the leak the check exists to prevent.
mod append;
mod shape;

use std::path::Path;

pub use crate::project_root::{resolve_project_root, resolve_project_root_bounded};
pub use append::{NOTE_FILES, NoteError, NoteFile, append_note, note_lock_path};
pub use shape::{USAGE, validate_note_shape};

use crate::memory::scan_memory_content_capped;

/// An entry is a handful of lines. A cap this size rejects a pasted log BEFORE
/// it is scanned, so an oversized paste costs nothing to refuse.
pub const NOTE_MAX_BYTES: usize = 16 * 1024;

/// Which store file to append to, resolved before stdin is read.
///
/// The order matters: the npm CLI refuses a bad argument without touching
/// stdin, so a caller that holds a pipe open never blocks on a rejected
/// invocation. Reading stdin first would turn that refusal into a hang.
pub fn resolve_note_file(file: Option<&str>) -> Result<NoteFile, String> {
    match file {
        Some(name) => NoteFile::from_name(name)
            .ok_or_else(|| refusal(&format!("Unknown memory file \"{name}\"."))),
        None => Err(refusal("Missing the memory file argument.")),
    }
}

/// Validate, scan and append one entry. `Ok` is what to print on stdout; `Err`
/// is what to print on stderr before exiting non-zero.
pub fn note(project_root: &Path, file: NoteFile, entry: &str) -> Result<String, String> {
    if let Some(problem) = validate_note_shape(entry) {
        return Err(refusal(&format!("Rejected: {problem}.")));
    }

    let findings = scan_memory_content_capped(entry, NOTE_MAX_BYTES);
    if !findings.is_empty() {
        let mut out = format!(
            "Rejected: {} finding(s) — nothing was written.\n",
            findings.len()
        );
        for finding in &findings {
            // Kind and location only. The matched text is deliberately NOT
            // printed: this output lands in terminals and CI logs.
            let where_ = if finding.line > 0 {
                format!("line {}", finding.line)
            } else {
                "whole entry".to_string()
            };
            out.push_str(&format!("  {}: {where_}\n", finding.kind));
        }
        return Err(out);
    }

    match append_note(project_root, file, entry) {
        Ok(written) => Ok(format!("appended to {written}\n")),
        Err(NoteError::Cap(message)) => Err(format!("Rejected: {message}. Nothing was written.\n")),
        // A lock we could not take or a store we could not write is not a
        // refusal of the ENTRY: it is reported as the failure it is.
        Err(other) => Err(format!("Fatal: {other}\n")),
    }
}

/// A headline plus the usage block, the way the npm CLI prints both.
fn refusal(headline: &str) -> String {
    format!("{headline}\n{USAGE}\n")
}

#[cfg(test)]
#[path = "note_tests.rs"]
mod tests;
