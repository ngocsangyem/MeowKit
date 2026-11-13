//! `note` — append a lint-checked entry to the committed team-memory store.
//!
//! Argument parsing and the stdin read only; the validation, the content scan
//! and the locked append live in [`mewkit_core::note`].
use std::io::Read;

use clap::Args;
use mewkit_core::note::{resolve_note_file, resolve_project_root};

use crate::failure::{FAILED, Failure, OK};

#[derive(Args, Debug)]
pub struct NoteArgs {
    /// Which store file to append to: `decisions` or `gotchas`.
    //
    // Optional to CLAP, required by the command: a missing argument is the
    // command's own refusal (exit 1) with the usage block, not a parser error
    // (exit 2), because that is what the npm CLI does and what its callers
    // check for. Written as a plain comment so the rationale stays out of the
    // help text a user reads.
    #[arg(value_name = "decisions|gotchas")]
    pub file: Option<String>,
}

pub fn run(args: &NoteArgs) -> Result<u8, Failure> {
    // The file argument is judged BEFORE stdin is read: a caller holding a pipe
    // open must get the refusal rather than block on a write nothing will
    // accept.
    let file = match resolve_note_file(args.file.as_deref()) {
        Ok(file) => file,
        Err(text) => {
            eprint!("{text}");
            return Ok(FAILED);
        }
    };

    // Entry text arrives on stdin, not in a flag, so a multi-line entry never
    // has to survive shell quoting.
    let mut raw = Vec::new();
    std::io::stdin()
        .read_to_end(&mut raw)
        .map_err(|e| Failure::failed(format!("cannot read the entry from stdin: {e}")))?;
    // Decoded LOSSILY, the way `Buffer#toString("utf-8")` is: a byte sequence
    // that is not UTF-8 becomes a replacement character and is then judged by
    // the shape and content checks like any other text. Failing the read
    // instead would refuse the same entry with a different message.
    let entry = String::from_utf8_lossy(&raw);

    let cwd = std::env::current_dir()?;
    let project_root = resolve_project_root(&cwd).unwrap_or(cwd);
    match mewkit_core::note::note(&project_root, file, &entry) {
        Ok(text) => {
            print!("{text}");
            Ok(OK)
        }
        Err(text) => {
            eprint!("{text}");
            Ok(FAILED)
        }
    }
}
