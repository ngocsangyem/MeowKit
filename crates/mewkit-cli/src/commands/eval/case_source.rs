//! Which folder `eval run` reads its cases from, and whether it may.
//!
//! Eval cases live only in the kit's source: `.claude/skills/<skill>/eval/` in
//! a checkout of the MeowKit repository. No release or install carries them.
//! Cases run model turns, some with a shell, so without `--trust-cases` only
//! this project's `.claude/skills` is read; any other `--case-root` is a folder
//! the user must read first and accept on purpose.
use std::path::{Path, PathBuf};

use crate::failure::Failure;

/// The folder to read cases from.
pub fn resolve(project: &Path, flag: Option<&Path>, trust_cases: bool) -> Result<PathBuf, Failure> {
    let skills = project.join(".claude/skills");
    let Some(root) = flag else {
        return Ok(skills);
    };
    let outside = root.canonicalize().ok() != skills.canonicalize().ok();
    if outside && !trust_cases {
        return Err(Failure::usage(format!(
            "{} is not this project's .claude/skills; its cases run model turns. Read them, then pass --trust-cases",
            root.display()
        )));
    }
    Ok(root.to_path_buf())
}
