//! Which folder `eval run` reads its cases from, and whether it may.
//!
//! Cases run model turns, some with a shell, so a folder is read without
//! `--trust-cases` only when its contents are known to be the kit's:
//!
//! - this project's `.claude/skills`, the kit's own source in a checkout;
//! - the installed eval pack in `.meowkit/eval/`, but only when every file in
//!   it is one an install wrote, byte for byte. The ownership index records the
//!   SHA-256 of each file the kit wrote, and the kit those files came from was
//!   checked against its release checksum before install, so a match ties each
//!   case back to a verified release. A file the index does not record, or one
//!   whose bytes changed since, is not the kit's: the pack is refused rather
//!   than run, and `--case-root` with `--trust-cases` remains the way to run
//!   such a folder on purpose.
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use mewkit_adapters::eval_pack::INSTALL_DIR;
use mewkit_core::fsx::sha256_hex;

use crate::failure::Failure;
use crate::place::Place;

/// The folder to read cases from.
pub fn resolve(project: &Path, flag: Option<&Path>, trust_cases: bool) -> Result<PathBuf, Failure> {
    let skills = project.join(".claude/skills");
    if let Some(root) = flag {
        let outside = root.canonicalize().ok() != skills.canonicalize().ok();
        if outside && !trust_cases {
            return Err(Failure::usage(format!(
                "{} is not this project's .claude/skills; its cases run model turns. Read them, then pass --trust-cases",
                root.display()
            )));
        }
        return Ok(root.to_path_buf());
    }
    let pack = project.join(INSTALL_DIR);
    let Ok(meta) = std::fs::symlink_metadata(&pack) else {
        return Ok(skills);
    };
    if !meta.is_dir() {
        return Err(Failure::failed(format!(
            "{INSTALL_DIR} is not a folder the kit installed; remove it, or pass --case-root"
        )));
    }
    let recorded = recorded_hashes(project)?;
    if let Some(stray) = first_unrecorded(project, &pack, &recorded)? {
        return Err(Failure::failed(format!(
            "{stray} is not a file the kit installed (unrecorded or edited), so {INSTALL_DIR} is not trusted as kit content. \
             Delete it, or restore the kit's copy with `mewkit upgrade --force`; or read the folder and pass --case-root {INSTALL_DIR} --trust-cases"
        )));
    }
    Ok(pack)
}

/// Every path the install indexes here record, with the hash each wrote.
fn recorded_hashes(project: &Path) -> Result<BTreeMap<String, String>, Failure> {
    let place = Place::project(project);
    let mut out = BTreeMap::new();
    for runtime in place.installed()? {
        if let Some(index) = place.index(runtime)? {
            out.extend(index.paths);
        }
    }
    Ok(out)
}

/// The first file under `dir` that no index records with its current bytes.
fn first_unrecorded(
    project: &Path,
    dir: &Path,
    recorded: &BTreeMap<String, String>,
) -> Result<Option<String>, Failure> {
    let mut entries: Vec<_> = std::fs::read_dir(dir)?.collect::<Result<_, _>>()?;
    entries.sort_by_key(|e| e.file_name());
    for entry in entries {
        let path = entry.path();
        let rel = path
            .strip_prefix(project)
            .unwrap_or(&path)
            .to_string_lossy()
            .replace('\\', "/");
        let kind = entry.file_type()?;
        if kind.is_dir() {
            if let Some(found) = first_unrecorded(project, &path, recorded)? {
                return Ok(Some(found));
            }
            continue;
        }
        // A symlink is never kit content: the kit installs regular files only.
        let matches =
            kind.is_file() && recorded.get(&rel) == Some(&sha256_hex(&std::fs::read(&path)?));
        if !matches {
            return Ok(Some(rel));
        }
    }
    Ok(None)
}
